-- Each saved project's MIDI file, next to its row in public.patterns.
-- A private bucket with one folder per account: <user id>/<pattern id>.mid.
insert into storage.buckets (id, name, public)
values ('midi', 'midi', false)
on conflict (id) do nothing;

-- Owner-only, like the patterns table. Replacing a file (upsert) needs
-- select, insert and update together.
create policy "midi owner select" on storage.objects
  for select to authenticated
  using (bucket_id = 'midi' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));
create policy "midi owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'midi' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));
create policy "midi owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'midi' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'))
  with check (bucket_id = 'midi' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));
create policy "midi owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'midi' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));
