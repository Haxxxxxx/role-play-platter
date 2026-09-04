-- Extends the map from a single tactical room into a scrollable "path" view
-- of the whole campaign: location-linked tokens, and edges connecting them
-- into a route the GM lays out (and can keep editing as the story grows).

alter table map_tokens drop constraint map_tokens_kind_check;
alter table map_tokens add constraint map_tokens_kind_check
  check (kind in ('npc', 'character', 'monster', 'decoration', 'object', 'location'));
alter table map_tokens add column ref_location_id uuid references locations (id) on delete set null;

create table map_edges (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  map_id uuid not null references battle_maps (id) on delete cascade,
  from_token_id uuid not null references map_tokens (id) on delete cascade,
  to_token_id uuid not null references map_tokens (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (map_id, from_token_id, to_token_id)
);

alter table map_edges enable row level security;

create policy "members read edges" on map_edges
  for select using (is_campaign_member(campaign_id));

create policy "gm manages edges" on map_edges
  for all using (auth.uid() = (select gm_id from campaigns where id = campaign_id))
  with check (auth.uid() = (select gm_id from campaigns where id = campaign_id));

alter publication supabase_realtime add table map_edges;
