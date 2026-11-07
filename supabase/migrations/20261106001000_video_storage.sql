insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arc-videos',
  'arc-videos',
  true,
  104857600,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Published Arc videos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'arc-videos');

create policy "Users can upload videos to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'arc-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update videos in their own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'arc-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'arc-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete videos in their own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'arc-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );