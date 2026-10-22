-- PricePulse World: enforce administrator-only verification at the database layer.
-- Run in the Supabase SQL Editor. The only seeded administrator is the owner's intended admin email.

create table if not exists public.pricepulse_admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.pricepulse_admin_emails (email)
values ('bamgbosealiu856@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_pricepulse_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.pricepulse_admin_emails a
    where lower(trim(a.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

revoke all on function public.is_pricepulse_admin() from public, anon;
grant execute on function public.is_pricepulse_admin() to authenticated;

create or replace function public.guard_pricepulse_verification_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.verification_status is distinct from old.verification_status
     and not public.is_pricepulse_admin() then
    raise exception 'Only an authorized PricePulse World administrator can approve or reject submissions.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_shop_verification_changes on public.shops;
create trigger guard_shop_verification_changes
before update of verification_status on public.shops
for each row execute function public.guard_pricepulse_verification_changes();

drop trigger if exists guard_price_report_verification_changes on public.price_reports;
create trigger guard_price_report_verification_changes
before update of verification_status on public.price_reports
for each row execute function public.guard_pricepulse_verification_changes();

-- Do not expose the administrator allow-list to ordinary app users.
alter table public.pricepulse_admin_emails enable row level security;
revoke all on table public.pricepulse_admin_emails from anon, authenticated;
