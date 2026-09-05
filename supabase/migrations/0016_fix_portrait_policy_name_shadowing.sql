-- 0015's three write policies denied literally everyone, GM and owner
-- alike -- confirmed live: pg_policies showed the stored expression as
-- storage.foldername(c.name), not storage.foldername(objects.name).
-- Inside `... from characters c where ...`, the bare `name` I wrote is
-- ambiguous between storage.objects.name (the row the policy is actually
-- about) and characters.name (the character's own name, e.g. "Kaelen
-- Vharyn") -- and Postgres silently resolved it to the inner table's
-- column instead of erroring. So the check became "does this character's
-- id match a folder-segment of its own name string", which is never true
-- for anyone, regardless of who's asking. Fixed by qualifying it
-- explicitly as objects.name so it can never be shadowed again.
drop policy "gm or owner uploads portrait" on storage.objects;
create policy "gm or owner uploads portrait" on storage.objects
  for insert with check (
    bucket_id = 'portraits'
    and exists (
      select 1 from characters c
      where c.id::text = (storage.foldername(objects.name))[1]
        and (c.owner_id = auth.uid() or c.campaign_id in (select id from campaigns where gm_id = auth.uid()))
    )
  );

drop policy "gm or owner replaces portrait" on storage.objects;
create policy "gm or owner replaces portrait" on storage.objects
  for update using (
    bucket_id = 'portraits'
    and exists (
      select 1 from characters c
      where c.id::text = (storage.foldername(objects.name))[1]
        and (c.owner_id = auth.uid() or c.campaign_id in (select id from campaigns where gm_id = auth.uid()))
    )
  );

drop policy "gm or owner deletes portrait" on storage.objects;
create policy "gm or owner deletes portrait" on storage.objects
  for delete using (
    bucket_id = 'portraits'
    and exists (
      select 1 from characters c
      where c.id::text = (storage.foldername(objects.name))[1]
        and (c.owner_id = auth.uid() or c.campaign_id in (select id from campaigns where gm_id = auth.uid()))
    )
  );
