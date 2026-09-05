-- There was no way for a GM to actually start or wrap up a campaign — just
-- a name and a roster, forever in the same undifferentiated state. Adds a
-- real lifecycle: setup (still building it, inviting players) -> active
-- (playing) -> completed (done, kept for the record).
create type campaign_status as enum ('setup', 'active', 'completed');

alter table campaigns add column status campaign_status not null default 'setup';

-- Audit finding while touching this policy: it let *any* member update a
-- campaign's row (name/system/description, and now status), not just the
-- GM -- gm_id was pinned immutable, but nothing else was. Same class of gap
-- fixed for locations/npcs/quests/timeline in 0011; this table was missed
-- because the immutable-gm_id check reads like a full lockdown at a glance.
drop policy "members can update, gm_id is immutable" on campaigns;
create policy "gm updates their campaign" on campaigns
  for update using (auth.uid() = gm_id)
  with check (auth.uid() = gm_id);
