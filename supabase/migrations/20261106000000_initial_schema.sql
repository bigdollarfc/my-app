create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  thumbnail_path text,
  caption text not null default '',
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  status text not null default 'published' check (status in ('draft', 'published', 'removed')),
  created_at timestamptz not null default now()
);

create table public.video_likes (
  video_id uuid not null references public.videos (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_no_self_follow check (follower_id <> followed_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index videos_feed_idx on public.videos (created_at desc) where status = 'published';
create index video_likes_user_idx on public.video_likes (user_id, created_at desc);
create index follows_followed_idx on public.follows (followed_id, created_at desc);
create index comments_video_idx on public.comments (video_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.video_likes enable row level security;
alter table public.follows enable row level security;
alter table public.comments enable row level security;

create policy "Profiles are visible to everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Published videos are visible to everyone"
  on public.videos for select using (status = 'published');

create policy "Users can create their own videos"
  on public.videos for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own videos"
  on public.videos for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own videos"
  on public.videos for delete to authenticated using (auth.uid() = user_id);

create policy "Likes are visible to everyone"
  on public.video_likes for select using (true);

create policy "Users can like videos as themselves"
  on public.video_likes for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can remove their own likes"
  on public.video_likes for delete to authenticated using (auth.uid() = user_id);

create policy "Follows are visible to everyone"
  on public.follows for select using (true);

create policy "Users can follow as themselves"
  on public.follows for insert to authenticated with check (auth.uid() = follower_id);

create policy "Users can unfollow as themselves"
  on public.follows for delete to authenticated using (auth.uid() = follower_id);

create policy "Comments are visible to everyone"
  on public.comments for select using (true);

create policy "Authenticated users can comment as themselves"
  on public.comments for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can remove their own comments"
  on public.comments for delete to authenticated using (auth.uid() = user_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  safe_username text;
begin
  requested_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(coalesce(new.email, 'creator'), '@', 1)
  );
  safe_username := trim(both '_' from regexp_replace(lower(requested_username), '[^a-z0-9_]+', '_', 'g'));
  safe_username := left(coalesce(nullif(safe_username, ''), 'creator'), 18) || '_' || left(replace(new.id::text, '-', ''), 6);

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    safe_username,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), requested_username)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();