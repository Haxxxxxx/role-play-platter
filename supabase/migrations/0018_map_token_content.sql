-- What a token actually hides: loot in a chest, a trap's effect, a secret
-- door, an NPC's hidden agenda, a bonus. GM-authored. No new RLS needed —
-- the existing "members read visible tokens" policy already gates the whole
-- row (this column included) on visible_to_players OR being the GM, so
-- while a token is hidden its content is invisible to players too, and the
-- one visibility toggle reveals both the token and what it holds.
alter table map_tokens add column content text not null default '';
