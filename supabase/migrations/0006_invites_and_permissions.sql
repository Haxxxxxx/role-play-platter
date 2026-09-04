-- Two things blocking real multi-user play:
-- 1. Nobody but the GM could ever insert a campaign_members row — so there
--    was no way for a friend to actually join a campaign. An invite link is
--    just the campaign's (unguessable) id; visiting it self-inserts you as
--    a player.
-- 2. Several tables were wide open to "any member can write anything",
--    which doesn't hold up once players are people other than you.

create policy "self join via invite link" on campaign_members
  for insert with check (auth.uid() = user_id and role = 'player');

-- Characters: any member can still create one (a player adding their own
-- character), but only the GM or the character's own owner can edit/delete
-- it — a player shouldn't be able to rewrite someone else's sheet.
drop policy "members write characters" on characters;
create policy "members create characters" on characters
  for insert with check (is_campaign_member(campaign_id));
create policy "gm or owner update characters" on characters
  for update using (
    is_campaign_member(campaign_id)
    and (auth.uid() = (select gm_id from campaigns where id = campaign_id) or auth.uid() = owner_id)
  );
create policy "gm or owner delete characters" on characters
  for delete using (
    is_campaign_member(campaign_id)
    and (auth.uid() = (select gm_id from campaigns where id = campaign_id) or auth.uid() = owner_id)
  );

-- Session notes -> the AI chronicle pipeline is GM prep/recap tooling
-- ("help the MJ"), not a player-facing feature — restrict creation to the
-- GM. (Players can still read the resulting chronicle everywhere else.)
drop policy "members create their own pending notes" on session_notes;
create policy "gm creates pending notes" on session_notes
  for insert with check (
    auth.uid() = (select gm_id from campaigns where id = campaign_id)
    and author_id = auth.uid()
    and status = 'pending'
  );
