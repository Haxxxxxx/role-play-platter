-- Fixes "new row violates row-level security policy for table campaigns" on
-- campaign creation through the actual client (anon key + user JWT).
--
-- Root cause: the very first campaign ever created in this database was
-- inserted by a setup script using the service-role key, which bypasses RLS
-- entirely — so the "creator becomes gm" INSERT policy from 0001 was never
-- actually exercised by a real client request until now. Whatever the exact
-- reason it's missing or broken (0001 was pasted as one script; a partial
-- failure wouldn't necessarily roll back earlier statements), the fix is
-- the same either way: drop it if present and recreate it from scratch.
drop policy if exists "creator becomes gm" on campaigns;

create policy "creator becomes gm" on campaigns
  for insert with check (auth.uid() = gm_id);

-- Re-assert the rest of campaigns' policies too, same reasoning — cheap
-- insurance against the same class of "silently never applied" issue.
drop policy if exists "members can read their campaigns" on campaigns;
create policy "members can read their campaigns" on campaigns
  for select using (is_campaign_member(id));

drop policy if exists "members can update, gm_id is immutable" on campaigns;
create policy "members can update, gm_id is immutable" on campaigns
  for update using (is_campaign_member(id))
  with check (gm_id = (select gm_id from campaigns where id = campaigns.id));

drop policy if exists "only gm can delete" on campaigns;
create policy "only gm can delete" on campaigns
  for delete using (auth.uid() = gm_id);
