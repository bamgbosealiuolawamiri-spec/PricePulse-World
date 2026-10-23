-- PricePulse World social community: profiles, follows, posts, likes, and comments.
-- Apply this migration in Supabase SQL Editor before enabling the Community tab in production.
-- No demo posts are inserted; all feed content must come from real user submissions.

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text not null default '',
  add column if not exists avatar_url text;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

create or replace view public.public_profiles
with (security_barrier = true)
as
  select
    id,
    coalesce(nullif(btrim(username), ''), nullif(btrim(full_name), ''), 'PricePulse member') as display_name,
    username,
    bio,
    avatar_url
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists user_follows_following_idx
  on public.user_follows (following_id, created_at desc);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  price_report_id uuid references public.price_reports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_created_idx
  on public.community_posts (created_at desc);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists community_comments_post_created_idx
  on public.community_comments (post_id, created_at asc);

alter table public.user_follows enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_comments enable row level security;

drop policy if exists "Community posts are publicly readable" on public.community_posts;
create policy "Community posts are publicly readable"
  on public.community_posts for select to anon, authenticated using (true);

drop policy if exists "Users can publish their own community posts" on public.community_posts;
create policy "Users can publish their own community posts"
  on public.community_posts for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "Users can edit their own community posts" on public.community_posts;
create policy "Users can edit their own community posts"
  on public.community_posts for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "Users can delete their own community posts" on public.community_posts;
create policy "Users can delete their own community posts"
  on public.community_posts for delete to authenticated using (auth.uid() = author_id);

drop policy if exists "Community likes are publicly readable" on public.community_likes;
create policy "Community likes are publicly readable"
  on public.community_likes for select to anon, authenticated using (true);

drop policy if exists "Users can like as themselves" on public.community_likes;
create policy "Users can like as themselves"
  on public.community_likes for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own likes" on public.community_likes;
create policy "Users can remove their own likes"
  on public.community_likes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Community comments are publicly readable" on public.community_comments;
create policy "Community comments are publicly readable"
  on public.community_comments for select to anon, authenticated using (true);

drop policy if exists "Users can comment as themselves" on public.community_comments;
create policy "Users can comment as themselves"
  on public.community_comments for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.community_comments;
create policy "Users can delete their own comments"
  on public.community_comments for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Follows are publicly readable" on public.user_follows;
create policy "Follows are publicly readable"
  on public.user_follows for select to anon, authenticated using (true);

drop policy if exists "Users can follow as themselves" on public.user_follows;
create policy "Users can follow as themselves"
  on public.user_follows for insert to authenticated with check (auth.uid() = follower_id and follower_id <> following_id);

drop policy if exists "Users can unfollow as themselves" on public.user_follows;
create policy "Users can unfollow as themselves"
  on public.user_follows for delete to authenticated using (auth.uid() = follower_id);

grant select on public.user_follows, public.community_posts, public.community_likes, public.community_comments to anon, authenticated;
grant insert, update, delete on public.community_posts to authenticated;
grant insert, delete on public.user_follows, public.community_likes, public.community_comments to authenticated;
