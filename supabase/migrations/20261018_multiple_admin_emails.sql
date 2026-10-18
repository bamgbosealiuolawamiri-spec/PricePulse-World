-- PricePulse World: support multiple authorized administrator email accounts.
-- Run in Supabase SQL Editor. Only a trusted project owner should run this SQL.
-- Regular users cannot grant themselves administrator permissions.

create table if not exists public.pricepulse_admins (
  email text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.pricepulse_admins
  add column if not exists is_active boolean not null default true;

alter table public.pricepulse_admins enable row level security;
revoke all on table public.pricepulse_admins from anon, authenticated;

create or replace function public.is_pricepulse_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pricepulse_admins a
    where lower(trim(a.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(a.is_active, true) = true
  );
$$;

revoke all on function public.is_pricepulse_admin() from public, anon;
grant execute on function public.is_pricepulse_admin() to authenticated;

-- Keep the existing administrator and add the account used for the current dashboard.
-- These are explicit grants, not a self-service signup mechanism.
insert into public.pricepulse_admins (email, is_active)
select v.email, true
from (values
  ('wayup2389@gmail.com'),
  ('bamgbosealiuolawamiri@gmail.com')
) as v(email)
where not exists (
  select 1 from public.pricepulse_admins a
  where lower(trim(a.email)) = lower(trim(v.email))
);

-- Ensure existing entries remain enabled unless intentionally disabled.
update public.pricepulse_admins
set is_active = true
where lower(trim(email)) in ('wayup2389@gmail.com', 'bamgbosealiuolawamiri@gmail.com');
