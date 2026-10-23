-- PricePulse World shop connections and verification applications.
-- This migration adds database-backed shop follows, private shop messages, and
-- verification applications. It does not enable payment collection or auto-verify shops.
-- Apply only after reviewing the policies and confirming the admin authorization RPC is secure.

create table if not exists public.shop_follows (
  shop_id uuid not null references public.shops(id) on delete cascade,
  follower_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, follower_id)
);

create index if not exists shop_follows_follower_idx
  on public.shop_follows (follower_id, created_at desc);

alter table public.shop_follows enable row level security;

drop policy if exists "Shop follows are publicly readable" on public.shop_follows;
drop policy if exists "Users can read their own shop follows" on public.shop_follows;
create policy "Users can read their own shop follows"
  on public.shop_follows for select to authenticated
  using (auth.uid() = follower_id);

drop policy if exists "Users can follow shops as themselves" on public.shop_follows;
create policy "Users can follow shops as themselves"
  on public.shop_follows for insert to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow shops as themselves" on public.shop_follows;
create policy "Users can unfollow shops as themselves"
  on public.shop_follows for delete to authenticated
  using (auth.uid() = follower_id);

revoke all on public.shop_follows from anon;
grant select, insert, delete on public.shop_follows to authenticated;

create table if not exists public.shop_messages (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint shop_messages_no_self_message check (sender_id <> recipient_id)
);

create index if not exists shop_messages_conversation_idx
  on public.shop_messages (shop_id, created_at asc);

alter table public.shop_messages enable row level security;

drop policy if exists "Participants can read their shop messages" on public.shop_messages;
create policy "Participants can read their shop messages"
  on public.shop_messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Use a narrowly scoped SECURITY DEFINER helper for message authorization.
-- This avoids querying shop_messages from its own INSERT policy (RLS recursion).
create or replace function public.can_send_shop_message(
  p_shop_id uuid,
  p_sender_id uuid,
  p_recipient_id uuid
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_sender_id
     or p_recipient_id is null or p_recipient_id = p_sender_id then
    return false;
  end if;

  select s.owner_id into v_owner_id
  from public.shops s
  where s.id = p_shop_id;

  if v_owner_id is null then
    return false;
  end if;

  -- Customers may start a conversation with the shop owner.
  if p_sender_id <> v_owner_id and p_recipient_id = v_owner_id then
    return true;
  end if;

  -- Owners may reply only to a customer who has previously messaged this shop.
  if p_sender_id = v_owner_id and exists (
    select 1
    from public.shop_messages m
    where m.shop_id = p_shop_id
      and m.sender_id = p_recipient_id
      and m.recipient_id = p_sender_id
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.can_send_shop_message(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_send_shop_message(uuid, uuid, uuid) to authenticated;

drop policy if exists "Customers can message the shop owner" on public.shop_messages;
drop policy if exists "Shop owners can reply to customers" on public.shop_messages;
drop policy if exists "Participants can send authorized shop messages" on public.shop_messages;
create policy "Participants can send authorized shop messages"
  on public.shop_messages for insert to authenticated
  with check (
    public.can_send_shop_message(shop_id, sender_id, recipient_id)
  );

grant select, insert on public.shop_messages to authenticated;

create table if not exists public.shop_verification_applications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'verified'
    check (plan in ('verified', 'premium')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'payment_pending')),
  monthly_price_ngn integer not null
    check (monthly_price_ngn in (2000, 5000)),
  business_evidence text not null check (char_length(btrim(business_evidence)) between 10 and 2000),
  payment_reference text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint shop_verification_application_once_pending
    unique (shop_id, applicant_id, status)
);

create index if not exists shop_verification_applications_review_idx
  on public.shop_verification_applications (status, created_at asc);

alter table public.shop_verification_applications enable row level security;

drop policy if exists "Shop owners can read their verification applications" on public.shop_verification_applications;
create policy "Shop owners can read their verification applications"
  on public.shop_verification_applications for select to authenticated
  using (
    applicant_id = auth.uid()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "Shop owners can apply for verification" on public.shop_verification_applications;
create policy "Shop owners can apply for verification"
  on public.shop_verification_applications for insert to authenticated
  with check (
    applicant_id = auth.uid()
    and exists (
      select 1 from public.shops s
      where s.id = shop_id and s.owner_id = auth.uid()
    )
    and (
      (plan = 'verified' and monthly_price_ngn = 2000)
      or (plan = 'premium' and monthly_price_ngn = 5000)
    )
    and status in ('pending', 'payment_pending')
  );

-- Deliberately no client UPDATE policy: only a trusted, server-side administrator
-- workflow should approve/reject applications or activate paid benefits.
grant select, insert on public.shop_verification_applications to authenticated;
