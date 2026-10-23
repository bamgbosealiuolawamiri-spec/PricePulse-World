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
create policy "Shop follows are publicly readable"
  on public.shop_follows for select to anon, authenticated using (true);

drop policy if exists "Users can follow shops as themselves" on public.shop_follows;
create policy "Users can follow shops as themselves"
  on public.shop_follows for insert to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow shops as themselves" on public.shop_follows;
create policy "Users can unfollow shops as themselves"
  on public.shop_follows for delete to authenticated
  using (auth.uid() = follower_id);

grant select on public.shop_follows to anon, authenticated;
grant insert, delete on public.shop_follows to authenticated;

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

drop policy if exists "Customers can message the shop owner" on public.shop_messages;
create policy "Customers can message the shop owner"
  on public.shop_messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.shops s
      where s.id = shop_id
        and s.owner_id = recipient_id
        and s.owner_id <> auth.uid()
    )
  );

drop policy if exists "Shop owners can reply to customers" on public.shop_messages;
create policy "Shop owners can reply to customers"
  on public.shop_messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.shops s
      where s.id = shop_id
        and s.owner_id = auth.uid()
        and recipient_id <> auth.uid()
        and exists (
          select 1 from public.shop_messages prior
          where prior.shop_id = s.id
            and prior.sender_id = recipient_id
            and prior.recipient_id = auth.uid()
        )
    )
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
