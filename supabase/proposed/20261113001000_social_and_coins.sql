-- Run AFTER schema.sql, in Supabase > SQL Editor

alter table profiles add column coins int not null default 20, add column last_claim timestamptz;

create or replace function guard_profile() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if new.banned <> old.banned and not (is_staff() and old.role <> 'owner' and (is_owner() or old.role = 'user')) then raise exception 'not allowed'; end if;
    if new.role <> old.role and not is_owner() then raise exception 'not allowed'; end if;
    if (new.coins <> old.coins or new.last_claim is distinct from old.last_claim)
       and coalesce(current_setting('app.rpc', true), '') <> '1' then raise exception 'not allowed'; end if;
  end if;
  return new;
end $$;

create table stories (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  text text default '', media_url text not null, kind text default 'video',
  created_at timestamptz default now()
);
create table messages (
  id bigint generated always as identity primary key,
  from_id uuid not null references profiles(id) on delete cascade,
  to_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 1000),
  created_at timestamptz default now()
);
create table lives (
  id bigint generated always as identity primary key,
  host_id uuid not null references profiles(id) on delete cascade,
  title text not null, active boolean not null default true,
  created_at timestamptz default now()
);
create table reposts (
  user_id uuid references profiles(id) on delete cascade,
  video_id bigint references videos(id) on delete cascade,
  primary key (user_id, video_id)
);
create table saves (
  user_id uuid references profiles(id) on delete cascade,
  video_id bigint references videos(id) on delete cascade,
  primary key (user_id, video_id)
);
create table tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null, body text default '', kind text default 'ticket',
  status text not null default 'open' check (status in ('open','wait','done')),
  created_at timestamptz default now()
);

alter table stories enable row level security;
alter table messages enable row level security;
alter table lives enable row level security;
alter table reposts enable row level security;
alter table saves enable row level security;
alter table tickets enable row level security;

create policy st_sel on stories for select using (true);
create policy st_ins on stories for insert with check (user_id = auth.uid() and not is_banned());
create policy st_del on stories for delete using (user_id = auth.uid() or is_staff());

create policy m_sel on messages for select using (from_id = auth.uid() or to_id = auth.uid());
create policy m_ins on messages for insert with check (from_id = auth.uid() and not is_banned());

create policy lv_sel on lives for select using (true);
create policy lv_ins on lives for insert with check (host_id = auth.uid() and not is_banned());
create policy lv_upd on lives for update using (host_id = auth.uid() or is_staff());

create policy rp_sel on reposts for select using (user_id = auth.uid());
create policy rp_ins on reposts for insert with check (user_id = auth.uid());
create policy rp_del on reposts for delete using (user_id = auth.uid());
create policy sv_sel on saves for select using (user_id = auth.uid());
create policy sv_ins on saves for insert with check (user_id = auth.uid());
create policy sv_del on saves for delete using (user_id = auth.uid());

create policy tk_sel on tickets for select using (user_id = auth.uid() or is_staff());
create policy tk_ins on tickets for insert with check (user_id = auth.uid());
create policy tk_upd on tickets for update using (is_staff());

-- gifts: moves coins from the sender to the live host, atomically
create function send_gift(p_live bigint, p_cost int) returns int language plpgsql security definer as $$
declare h uuid; bal int;
begin
  if p_cost <= 0 or p_cost > 300 then raise exception 'bad gift'; end if;
  select host_id into h from lives where id = p_live and active;
  if h is null then raise exception 'This live has ended'; end if;
  perform set_config('app.rpc', '1', true);
  update profiles set coins = coins - p_cost where id = auth.uid() and coins >= p_cost returning coins into bal;
  if bal is null then raise exception 'Not enough coins'; end if;
  update profiles set coins = coins + p_cost where id = h;
  return bal;
end $$;

-- free daily coins (real payments need Stripe or similar)
create function claim_coins() returns int language plpgsql security definer as $$
declare bal int;
begin
  perform set_config('app.rpc', '1', true);
  update profiles set coins = coins + 20, last_claim = now()
    where id = auth.uid() and (last_claim is null or last_claim < now() - interval '1 day') returning coins into bal;
  if bal is null then raise exception 'Come back tomorrow for more coins'; end if;
  return bal;
end $$;

-- realtime for direct messages
alter publication supabase_realtime add table messages;
