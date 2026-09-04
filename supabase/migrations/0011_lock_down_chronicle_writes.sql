-- Audit finding: locations/npcs/quests/timeline_events were still on their
-- original 0001 "any campaign member can write anything" policy. 0006
-- already flagged this exact class of problem ("wide open to any member
-- can write anything, which doesn't hold up once players are people other
-- than you") and fixed it for characters and session_notes, and 0003 fixed
-- it for battle_maps -- these four tables were simply missed. With real
-- friends now being invited as separate accounts, any player could
-- currently rewrite or delete any NPC/location/quest/timeline event via a
-- direct REST call with their own JWT, GM secrets included.
--
-- Nothing in the client ever writes to these tables anyway (confirmed: only
-- read via useChronicle/useSupabaseCollection) -- the only real writer is
-- the AI pipeline, which already runs on the service-role key and bypasses
-- RLS entirely. So this tightens the boundary with zero feature impact.
drop policy "members write locations" on locations;
create policy "gm writes locations" on locations
  for all using (auth.uid() = (select gm_id from campaigns where id = campaign_id))
  with check (auth.uid() = (select gm_id from campaigns where id = campaign_id));

drop policy "members write npcs" on npcs;
create policy "gm writes npcs" on npcs
  for all using (auth.uid() = (select gm_id from campaigns where id = campaign_id))
  with check (auth.uid() = (select gm_id from campaigns where id = campaign_id));

drop policy "members write quests" on quests;
create policy "gm writes quests" on quests
  for all using (auth.uid() = (select gm_id from campaigns where id = campaign_id))
  with check (auth.uid() = (select gm_id from campaigns where id = campaign_id));

drop policy "members write timeline" on timeline_events;
create policy "gm writes timeline" on timeline_events
  for all using (auth.uid() = (select gm_id from campaigns where id = campaign_id))
  with check (auth.uid() = (select gm_id from campaigns where id = campaign_id));
-- Reads ("members read locations/npcs/quests/timeline") from 0001 are unchanged.
