-- Battle map tokens, plus tightening battle_maps to GM-only writes (0001 had
-- it open to any member, same as the other chronicle tables — the map is the
-- one surface that needs a real GM/player split).

drop policy if exists "members write maps" on battle_maps;
create policy "gm manages maps" on battle_maps
  for all using (auth.uid() = (select gm_id from campaigns where id = campaign_id))
  with check (auth.uid() = (select gm_id from campaigns where id = campaign_id));
-- "members read maps" (select-only, any member) from 0001 is unchanged.

create table map_tokens (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  map_id uuid not null references battle_maps (id) on delete cascade,
  kind text not null check (kind in ('npc', 'character', 'monster', 'decoration', 'object')),
  label text not null default '',
  icon text not null default '❓',
  color text not null default '#7c6ce8',
  x integer not null default 0,
  y integer not null default 0,
  ref_npc_id uuid references npcs (id) on delete set null,
  ref_character_id uuid references characters (id) on delete set null,
  -- GM-only tokens (ambushes, hidden monsters) stay invisible to players
  -- until the GM flips this — same "AI writes, client never spoofs it"
  -- posture as the rest of the schema, just for fog instead of provenance.
  visible_to_players boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table map_tokens enable row level security;

create policy "members read visible tokens" on map_tokens
  for select using (
    is_campaign_member(campaign_id)
    and (visible_to_players or auth.uid() = (select gm_id from campaigns where id = campaign_id))
  );

create policy "gm manages tokens" on map_tokens
  for all using (auth.uid() = (select gm_id from campaigns where id = campaign_id))
  with check (auth.uid() = (select gm_id from campaigns where id = campaign_id));

-- The one thing a player can do without the GM: drag their own character's
-- token around. Everything else (add, delete, decorations, NPC/monster
-- tokens, visibility) stays GM-only via the policy above.
create policy "player moves own character token" on map_tokens
  for update using (
    is_campaign_member(campaign_id)
    and ref_character_id in (select id from characters where owner_id = auth.uid())
  )
  with check (
    ref_character_id in (select id from characters where owner_id = auth.uid())
  );

alter publication supabase_realtime add table battle_maps, map_tokens;
