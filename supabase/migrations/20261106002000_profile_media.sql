alter table public.profiles
  add column if not exists banner_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arc-profiles',
  'arc-profiles',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Profile images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'arc-profiles');

create policy "Users can upload images to their own profile folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'arc-profiles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update images in their own profile folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'arc-profiles'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'arc-profiles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete images in their own profile folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'arc-profiles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );