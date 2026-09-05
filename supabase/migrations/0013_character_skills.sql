-- Character creation was a 4-field stub (name/player/class/race) with no
-- ability scores, no way to add items or skills by hand — the AI note
-- pipeline could populate inventory, but a player had no manual path at
-- all. Skills as a jsonb array of {id, name, modifier} rather than a rigid
-- per-system list: the campaign's RPG system is a free choice
-- (Chroniques Oubliees, D&D 5e, Homebrew...) and they don't share a skill
-- list, so a named list a player fills in themselves is the only shape
-- that works across all of them.
alter table characters add column skills jsonb not null default '[]';
