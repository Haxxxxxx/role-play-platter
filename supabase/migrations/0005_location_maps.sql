-- Splits the single map into two tiers: the overworld path (location_id is
-- null) built in 0004, and one detail map per location (location_id set),
-- lazily created the same way the overworld map is.

alter table battle_maps add column location_id uuid references locations (id) on delete cascade;

-- At most one overworld map per campaign, and at most one detail map per location.
create unique index battle_maps_one_overworld on battle_maps (campaign_id) where location_id is null;
create unique index battle_maps_one_per_location on battle_maps (campaign_id, location_id) where location_id is not null;
