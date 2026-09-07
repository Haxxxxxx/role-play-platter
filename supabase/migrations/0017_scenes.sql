-- The prep spine the app was missing: a GM lays out a scenario as ordered
-- scenes *before* play, then runs the session from it. Fully GM-only --
-- prep is a GM tool, and read_aloud/gm_notes are meant to be revealed at
-- the table by the GM, not pulled by players. The bridge to what players
-- see is "push this scene into the chronicle" (creates a timeline_event),
-- not direct read access here.
create table scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  title text not null default 'Nouvelle scène',
  "order" integer not null default 0,
  read_aloud text not null default '',       -- boxed text the GM reads aloud
  gm_notes text not null default '',         -- secret prep
  encounter text not null default '',        -- freeform for now ("Melric + 3 bandits")
  npc_ids uuid[] not null default '{}',      -- planned NPCs (from npcs)
  location_ids uuid[] not null default '{}', -- planned locations
  done boolean not null default false,       -- GM ticks scenes off as they play through
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table scenes enable row level security;

create policy "gm reads scenes" on scenes
  for select using (auth.uid() = (select gm_id from campaigns where id = campaign_id));

create policy "gm writes scenes" on scenes
  for all using (auth.uid() = (select gm_id from campaigns where id = campaign_id))
  with check (auth.uid() = (select gm_id from campaigns where id = campaign_id));

alter publication supabase_realtime add table scenes;
