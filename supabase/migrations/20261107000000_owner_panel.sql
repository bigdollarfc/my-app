-- Owner / admin panel support
-- Run this in the Supabase SQL editor.

-- Columns used by the owner panel
alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists verified boolean not null default false,
  add column if not exists banned boolean not null default false;

-- Secure helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Admins can read every profile
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles"
  on public.profiles for select
  using (public.is_admin() or id = auth.uid());

-- Admins can update any profile (verify badge, ban, promote)
drop policy if exists "admins update all profiles" on public.profiles;
create policy "admins update all profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
-- BOOTSTRAP: make YOURSELF the first owner.
-- Replace the email below with yours and run once:
--
-- update public.profiles
--   set is_admin = true
--   where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
--
-- Then, inside the owner panel, you can promote co-workers too.
-- =============================================================
