-- Social features: saves, reposts, stories, direct messages, support tickets, coins.
-- Run in Supabase > SQL Editor (needs a direct DB connection or the SQL editor; the anon key cannot run DDL).
-- Safe to re-run: every statement is guarded.

-- ----------------------------------------------------------------
-- Coins on profiles
-- ----------------------------------------------------------------
alter table public.profiles
  add column if not exists coins int not null default 20,
  add column if not exists last_claim timestamptz;

-- ----------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------
create table if not exists public.saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.reposts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_url text not null,
  text text not null default '',
  kind text not null default 'video' check (kind in ('image', 'video')),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 120),
  body text not null default '',
  kind text not null default 'ticket',
  status text not null default 'open' check (status in ('open', 'wait', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists saves_user_idx on public.saves (user_id, created_at desc);
create index if not exists reposts_user_idx on public.reposts (user_id, created_at desc);
create index if not exists stories_user_idx on public.stories (user_id, created_at desc);
create index if not exists messages_pair_idx on public.messages (from_id, to_id, created_at desc);
create index if not exists tickets_user_idx on public.tickets (user_id, created_at desc);

-- ----------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------
alter table public.saves enable row level security;
alter table public.reposts enable row level security;
alter table public.stories enable row level security;
alter table public.messages enable row level security;
alter table public.tickets enable row level security;

-- saves: private to the owner
drop policy if exists "Users read their own saves" on public.saves;
create policy "Users read their own saves"
  on public.saves for select using (user_id = auth.uid());

drop policy if exists "Users save as themselves" on public.saves;
create policy "Users save as themselves"
  on public.saves for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users unsave their own" on public.saves;
create policy "Users unsave their own"
  on public.saves for delete to authenticated using (user_id = auth.uid());

-- reposts: public list, own writes
drop policy if exists "Reposts are visible to everyone" on public.reposts;
create policy "Reposts are visible to everyone"
  on public.reposts for select using (true);

drop policy if exists "Users repost as themselves" on public.reposts;
create policy "Users repost as themselves"
  on public.reposts for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users undo their own reposts" on public.reposts;
create policy "Users undo their own reposts"
  on public.reposts for delete to authenticated using (user_id = auth.uid());

-- stories: public read, own write, own or admin delete
drop policy if exists "Stories are visible to everyone" on public.stories;
create policy "Stories are visible to everyone"
  on public.stories for select using (true);

drop policy if exists "Users post their own stories" on public.stories;
create policy "Users post their own stories"
  on public.stories for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users delete their own stories" on public.stories;
create policy "Users delete their own stories"
  on public.stories for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- messages: only the two people in the conversation
drop policy if exists "Users read their own messages" on public.messages;
create policy "Users read their own messages"
  on public.messages for select using (from_id = auth.uid() or to_id = auth.uid());

drop policy if exists "Users send messages as themselves" on public.messages;
create policy "Users send messages as themselves"
  on public.messages for insert to authenticated with check (from_id = auth.uid());

-- tickets: own tickets, staff can read and triage
drop policy if exists "Users read their own tickets" on public.tickets;
create policy "Users read their own tickets"
  on public.tickets for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users open tickets as themselves" on public.tickets;
create policy "Users open tickets as themselves"
  on public.tickets for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Admins update tickets" on public.tickets;
create policy "Admins update tickets"
  on public.tickets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------
-- Coins
-- ----------------------------------------------------------------
-- Profiles may not set their own coin balance; only claim_coins() moves coins.
create or replace function public.guard_profile_coins()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and new.coins is distinct from old.coins
     and coalesce(current_setting('app.rpc', true), '') <> '1' then
    raise exception 'Coins can only change through claim_coins()';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_coins_t on public.profiles;
create trigger guard_profile_coins_t
  before update on public.profiles
  for each row execute function public.guard_profile_coins();

-- Let the coin function move the balance despite the guard above.
create or replace function public.claim_coins()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  balance int;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in';
  end if;

  perform set_config('app.rpc', '1', true);

  update public.profiles
    set coins = coins + 20,
        last_claim = now()
    where id = auth.uid()
      and (last_claim is null or last_claim < now() - interval '1 day')
    returning coins into balance;

  if balance is null then
    raise exception 'Come back tomorrow for more coins';
  end if;

  return balance;
end;
$$;

-- ----------------------------------------------------------------
-- Realtime for direct messages
-- ----------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ----------------------------------------------------------------
-- Storage: stories reuse the existing videos bucket.
-- The app uploads to arc-videos/<user id>/<timestamp>.<ext>.
-- ----------------------------------------------------------------
do $$
begin
  if exists (select 1 from storage.buckets where id = 'arc-videos') then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname = 'Users upload to their own folder'
    ) then
      create policy "Users upload to their own folder"
        on storage.objects for insert to authenticated
        with check (
          bucket_id = 'arc-videos'
          and (storage.foldername(name))[1] = auth.uid()::text
        );
    end if;
  end if;
end $$;