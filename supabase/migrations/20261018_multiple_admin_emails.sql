-- PricePulse World: authorize multiple administrator emails.
-- Run in Supabase SQL Editor as the project owner.
-- Uses a dedicated table name to avoid conflicts with any older pricepulse_admins table.

create table if not exists public.pricepulse_admin_emails (
  email text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.pricepulse_admin_emails
  add column if not exists is_active boolean not null default true;

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

-- Explicitly authorized accounts. Change/add email addresses here only as the project owner.
insert into public.pricepulse_admin_emails (email, is_active)
values
  ('wayup2389@gmail.com', true),
  ('bamgbosealiuolawamiri@gmail.com', true)
on conflict (email) do update set is_active = excluded.is_active;
