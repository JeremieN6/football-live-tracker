-- Logo de club : colonne logo_url + bucket de stockage public "club-logos"
-- pour les logos uploadés en drag-and-drop (les URL externes n'ont pas besoin
-- de stockage, juste enregistrées telles quelles dans logo_url).

alter table clubs add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('club-logos', 'club-logos', true)
on conflict (id) do nothing;

-- Lecture publique (bucket public de toute façon, policy explicite par clarté).
drop policy if exists "club_logos_public_read" on storage.objects;
create policy "club_logos_public_read" on storage.objects
  for select using (bucket_id = 'club-logos');

-- Écriture réservée au propriétaire du club, objets rangés sous "<club_id>/...".
drop policy if exists "club_logos_owner_write" on storage.objects;
create policy "club_logos_owner_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'club-logos'
    and exists (select 1 from clubs where clubs.id::text = (storage.foldername(name))[1] and clubs.owner_id = auth.uid())
  );

drop policy if exists "club_logos_owner_update" on storage.objects;
create policy "club_logos_owner_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'club-logos'
    and exists (select 1 from clubs where clubs.id::text = (storage.foldername(name))[1] and clubs.owner_id = auth.uid())
  );

drop policy if exists "club_logos_owner_delete" on storage.objects;
create policy "club_logos_owner_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'club-logos'
    and exists (select 1 from clubs where clubs.id::text = (storage.foldername(name))[1] and clubs.owner_id = auth.uid())
  );
