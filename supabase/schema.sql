-- PricePulse World shared database schema for Supabase.
-- Run in Supabase Dashboard > SQL Editor. Do not put service_role keys in the browser.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  country text not null default '',
  city text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  city text not null,
  country text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_reports (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  shop_id uuid references public.shops(id) on delete set null,
  shop_name text not null,
  location text not null,
  country text not null,
  currency_code text not null default 'NGN',
  price numeric(14,2) not null check (price > 0),
  date_seen date not null default current_date,
  verification_status text not null default 'pending' check (verification_status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_name)
);

create index if not exists price_reports_approved_product_idx on public.price_reports (product_name, country, date_seen desc) where verification_status = 'approved';
create index if not exists shops_verified_location_idx on public.shops (country, city, verification_status);
create index if not exists price_reports_user_idx on public.price_reports (submitted_by, created_at desc);

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.price_reports enable row level security;
alter table public.favorites enable row level security;

-- Profiles: users can read and edit only their own profile.
create policy "Profiles readable by owner" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Profiles insertable by owner" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Profiles updatable by owner" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Public visitors may read only verified shops. Owners can create and edit their own pending shops.
create policy "Anyone can read verified shops" on public.shops for select to anon, authenticated using (verification_status = 'verified' or auth.uid() = owner_id);
create policy "Signed-in users can register shops" on public.shops for insert to authenticated with check (auth.uid() = owner_id and verification_status = 'pending');
create policy "Owners can edit their pending shops" on public.shops for update to authenticated using (auth.uid() = owner_id and verification_status = 'pending') with check (auth.uid() = owner_id and verification_status = 'pending');

-- Public visitors may read approved prices. A signed-in user can read their own reports and submit pending reports.
create policy "Anyone can read approved prices" on public.price_reports for select to anon, authenticated using (verification_status = 'approved' or auth.uid() = submitted_by);
create policy "Signed-in users can submit pending prices" on public.price_reports for insert to authenticated with check (auth.uid() = submitted_by and verification_status = 'pending');
create policy "Users can manage own favorites" on public.favorites for select to authenticated using (auth.uid() = user_id);
create policy "Users can add own favorites" on public.favorites for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can remove own favorites" on public.favorites for delete to authenticated using (auth.uid() = user_id);

-- New accounts get a profile row automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, country, city)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'country', ''),
    coalesce(new.raw_user_meta_data ->> 'city', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
