-- Media storage. Object paths are always "<company_id>/<kind>/<file>".
-- artwork: public-read (album/DJ artwork); media: private, company members only (mixes, audio).
-- Guarded so the same migrations run against the local test stack, which has no storage service.
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'storage schema not present — skipping storage setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('artwork', 'artwork', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
    ('media', 'media', false, 209715200, array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'video/mp4'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  execute $p$
    create policy "artwork admin write" on storage.objects for all to authenticated
    using (bucket_id = 'artwork' and public.is_company_admin(((storage.foldername(name))[1])::uuid))
    with check (bucket_id = 'artwork' and public.is_company_admin(((storage.foldername(name))[1])::uuid))
  $p$;
  execute $p$
    create policy "media member read" on storage.objects for select to authenticated
    using (bucket_id = 'media' and public.is_company_member(((storage.foldername(name))[1])::uuid))
  $p$;
  execute $p$
    create policy "media admin write" on storage.objects for insert to authenticated
    with check (bucket_id = 'media' and public.is_company_admin(((storage.foldername(name))[1])::uuid))
  $p$;
  execute $p$
    create policy "media admin delete" on storage.objects for delete to authenticated
    using (bucket_id = 'media' and public.is_company_admin(((storage.foldername(name))[1])::uuid))
  $p$;
end $$;
