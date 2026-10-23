-- Secure PricePulse World administrator allow-list and shop verification review.
-- Apply this migration in Supabase only after reviewing the SQL.
-- Exactly one administrator email is enabled; payment remains postponed.

-- Application roles need row-level operations only; RLS does not restrict TRUNCATE.
revoke truncate, trigger, references on table public.shops from anon, authenticated;

alter table public.pricepulse_admin_emails
  add column if not exists is_active boolean not null default true;

insert into public.pricepulse_admin_emails (email, is_active)
values ('bamgbosealiu856@gmail.com', true)
on conflict (email) do update set is_active = true;

-- Disable all other entries so older migrations cannot leave extra administrators enabled.
update public.pricepulse_admin_emails
set is_active = (lower(trim(email)) = 'bamgbosealiu856@gmail.com');

alter table public.pricepulse_admin_emails enable row level security;
revoke all on table public.pricepulse_admin_emails from anon, authenticated;

create or replace function public.is_pricepulse_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pricepulse_admin_emails a
    where lower(trim(a.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and a.is_active = true
  );
$$;

revoke all on function public.is_pricepulse_admin() from public, anon;
grant execute on function public.is_pricepulse_admin() to authenticated;

-- Let the allow-listed administrator inspect pending shops and applications in the review queue.
drop policy if exists "Authorized admins can read shops" on public.shops;
create policy "Authorized admins can read shops"
  on public.shops for select to authenticated
  using (public.is_pricepulse_admin());

drop policy if exists "Authorized admins can read shop verification applications"
  on public.shop_verification_applications;
create policy "Authorized admins can read shop verification applications"
  on public.shop_verification_applications
  for select to authenticated
  using (public.is_pricepulse_admin());

-- Applications can only be reviewed by the allow-listed administrator.
drop policy if exists "Authorized admins can review shop verification applications"
  on public.shop_verification_applications;
create policy "Authorized admins can review shop verification applications"
  on public.shop_verification_applications
  for update to authenticated
  using (public.is_pricepulse_admin())
  with check (public.is_pricepulse_admin());

revoke update on public.shop_verification_applications from anon, authenticated;
grant update (status, reviewed_at) on public.shop_verification_applications to authenticated;

create or replace function public.guard_shop_verification_application_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not public.is_pricepulse_admin() then
      raise exception 'Only an authorized PricePulse World administrator can review shop verification applications.'
        using errcode = '42501';
    end if;

    if new.status not in ('approved', 'rejected') then
      raise exception 'Administrator review must approve or reject the application.'
        using errcode = '22023';
    end if;

    new.reviewed_at := now();

    if new.status = 'approved' then
      update public.shops
      set verification_status = 'verified'
      where id = new.shop_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_shop_verification_application_review
  on public.shop_verification_applications;
create trigger guard_shop_verification_application_review
before update of status on public.shop_verification_applications
for each row
execute function public.guard_shop_verification_application_review();

revoke all on function public.guard_shop_verification_application_review() from public, anon, authenticated;
