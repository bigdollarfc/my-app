-- Run this whole file in Supabase > SQL Editor

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  bio text default '',
  role text not null default 'user' check (role in ('user','admin','owner')),
  banned boolean not null default false,
  created_at timestamptz default now()
);
create table videos (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  video_url text not null,
  caption text default '',
  hidden boolean not null default false,
  created_at timestamptz default now()
);
create table likes (
  user_id uuid references profiles(id) on delete cascade,
  video_id bigint references videos(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, video_id)
);
create table comments (
  id bigint generated always as identity primary key,
  video_id bigint references videos(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 300),
  created_at timestamptz default now()
);
create table follows (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

-- helpers
create function is_staff() returns boolean language sql security definer stable as
$$ select exists(select 1 from profiles where id = auth.uid() and role in ('admin','owner')) $$;
create function is_owner() returns boolean language sql security definer stable as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'owner') $$;
create function is_banned() returns boolean language sql security definer stable as
$$ select exists(select 1 from profiles where id = auth.uid() and banned) $$;

-- auto-create profile on signup
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles(id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), 'user' || substr(new.id::text,1,6)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- only staff can ban, only owner can change roles (SQL editor is exempt)
create function guard_profile() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if new.banned <> old.banned and not (is_staff() and old.role <> 'owner' and (is_owner() or old.role = 'user')) then raise exception 'not allowed'; end if;
    if new.role <> old.role and not is_owner() then raise exception 'not allowed'; end if;
  end if;
  return new;
end $$;
create trigger guard_profile_t before update on profiles
  for each row execute function guard_profile();

-- RLS
alter table profiles enable row level security;
alter table videos enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table follows enable row level security;

create policy p_sel on profiles for select using (true);
create policy p_upd on profiles for update using (id = auth.uid() or is_staff());

create policy v_sel on videos for select using (hidden = false or user_id = auth.uid() or is_staff());
create policy v_ins on videos for insert with check (user_id = auth.uid() and not is_banned());
create policy v_upd on videos for update using (is_staff());
create policy v_del on videos for delete using (user_id = auth.uid() or is_staff());

create policy l_sel on likes for select using (true);
create policy l_ins on likes for insert with check (user_id = auth.uid());
create policy l_del on likes for delete using (user_id = auth.uid());

create policy c_sel on comments for select using (true);
create policy c_ins on comments for insert with check (user_id = auth.uid() and not is_banned());
create policy c_del on comments for delete using (user_id = auth.uid() or is_staff());

create policy f_sel on follows for select using (true);
create policy f_ins on follows for insert with check (follower_id = auth.uid());
create policy f_del on follows for delete using (follower_id = auth.uid());

-- storage bucket for videos
insert into storage.buckets (id, name, public) values ('videos','videos',true);
create policy s_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text and not is_banned());
create policy s_del on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and ((storage.foldername(name))[1] = auth.uid()::text or is_staff()));

-- AFTER you sign up in the app, make yourself owner (replace the email):
-- update profiles set role = 'owner' where id = (select id from auth.users where email = 'you@example.com');
