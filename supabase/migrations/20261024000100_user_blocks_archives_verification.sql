-- PricePulse World: database-backed user blocking, conversation archives, and user verification.
-- Apply in Supabase SQL Editor after reviewing. This migration does not deploy the frontend.

-- 1) Manual profile verification. Profiles remain unverified by default.
alter table public.profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz;

create or replace function public.guard_pricepulse_profile_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.is_verified is distinct from old.is_verified
      or new.verified_at is distinct from old.verified_at)
     and not public.is_pricepulse_admin() then
    raise exception 'Only an authorized PricePulse World administrator can verify user profiles.'
      using errcode = '42501';
  end if;
  if new.is_verified and new.verified_at is null then
    new.verified_at := now();
  elsif not new.is_verified then
    new.verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_pricepulse_profile_verification on public.profiles;
create trigger guard_pricepulse_profile_verification
before update of is_verified, verified_at on public.profiles
for each row execute function public.guard_pricepulse_profile_verification();

-- 2) A user can block another account; no self-blocking.
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id, blocker_id);

alter table public.user_blocks enable row level security;
drop policy if exists "Users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks"
  on public.user_blocks for select to authenticated
  using (auth.uid() = blocker_id);
drop policy if exists "Users can block accounts as themselves" on public.user_blocks;
create policy "Users can block accounts as themselves"
  on public.user_blocks for insert to authenticated
  with check (auth.uid() = blocker_id);
drop policy if exists "Users can unblock accounts as themselves" on public.user_blocks;
create policy "Users can unblock accounts as themselves"
  on public.user_blocks for delete to authenticated
  using (auth.uid() = blocker_id);
revoke all on public.user_blocks from anon;
grant select, insert, delete on public.user_blocks to authenticated;

-- Enforce blocking in the database so a client cannot bypass the UI.
create or replace function public.guard_blocked_shop_messages()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = new.sender_id and b.blocked_id = new.recipient_id)
       or (b.blocker_id = new.recipient_id and b.blocked_id = new.sender_id)
  ) then
    raise exception 'This message cannot be sent because one participant has blocked the other.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_blocked_shop_messages on public.shop_messages;
create trigger guard_blocked_shop_messages
before insert on public.shop_messages
for each row execute function public.guard_blocked_shop_messages();

-- 3) Per-user archive state for each shop conversation. Archiving never deletes messages.
create table if not exists public.shop_message_archives (
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  other_user_id uuid not null references auth.users(id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key (user_id, shop_id, other_user_id),
  constraint shop_message_archives_no_self check (user_id <> other_user_id)
);
alter table public.shop_message_archives enable row level security;
drop policy if exists "Users can read their own archived conversations" on public.shop_message_archives;
create policy "Users can read their own archived conversations"
  on public.shop_message_archives for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users can archive their own conversations" on public.shop_message_archives;
create policy "Users can archive their own conversations"
  on public.shop_message_archives for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "Users can restore their own conversations" on public.shop_message_archives;
create policy "Users can restore their own conversations"
  on public.shop_message_archives for delete to authenticated
  using (auth.uid() = user_id);
revoke all on public.shop_message_archives from anon;
grant select, insert, delete on public.shop_message_archives to authenticated;


-- Include the public verification state in the existing safe public profile view.
create or replace view public.public_profiles
with (security_barrier = true)
as
  select
    p.id,
    coalesce(nullif(btrim(p.username), ''), nullif(btrim(p.full_name), ''), 'PricePulse member') as display_name,
    p.username,
    p.bio,
    p.avatar_url,
    p.is_verified
  from public.profiles p;

grant select on public.public_profiles to anon, authenticated;
