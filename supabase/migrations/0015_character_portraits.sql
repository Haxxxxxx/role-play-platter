-- No AI image generation here -- checked live against every Gemini image
-- model (Nano Banana, Nano Banana Pro, Nano Banana 2/Lite): all return
-- limit: 0 on the free tier, billing-only. So this is manual upload: a
-- player or the GM drops in an image (fan art, a token, a photo, whatever)
-- to represent the hero on their own character page.
alter table characters add column portrait_url text;

insert into storage.buckets (id, name, public)
values ('portraits', 'portraits', true)
on conflict (id) do nothing;

-- Object path convention: <character_id>/<filename> -- storage.foldername
-- splits the path into segments, so (storage.foldername(name))[1] is the
-- character id. Public bucket means anyone with the URL can view (fine,
-- these are just illustrations, same posture as a profile avatar); write
-- access is still real RLS, scoped to whoever can already edit that
-- character (its owner or the campaign's GM -- same rule as the
-- characters table itself).
create policy "anyone can view portraits" on storage.objects
  for select using (bucket_id = 'portraits');

create policy "gm or owner uploads portrait" on storage.objects
  for insert with check (
    bucket_id = 'portraits'
    and exists (
      select 1 from characters c
      where c.id::text = (storage.foldername(name))[1]
        and (c.owner_id = auth.uid() or c.campaign_id in (select id from campaigns where gm_id = auth.uid()))
    )
  );

create policy "gm or owner replaces portrait" on storage.objects
  for update using (
    bucket_id = 'portraits'
    and exists (
      select 1 from characters c
      where c.id::text = (storage.foldername(name))[1]
        and (c.owner_id = auth.uid() or c.campaign_id in (select id from campaigns where gm_id = auth.uid()))
    )
  );

create policy "gm or owner deletes portrait" on storage.objects
  for delete using (
    bucket_id = 'portraits'
    and exists (
      select 1 from characters c
      where c.id::text = (storage.foldername(name))[1]
        and (c.owner_id = auth.uid() or c.campaign_id in (select id from campaigns where gm_id = auth.uid()))
    )
  );
