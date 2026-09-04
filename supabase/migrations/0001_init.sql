-- Role Play Platter — initial schema.
-- Run via `supabase db push` (Supabase CLI) or paste into the SQL editor at
-- app.supabase.com -> your project -> SQL Editor.

create extension if not exists "pgcrypto";

create type rpg_system as enum ('D&D 5e', 'Pathfinder 2e', 'Call of Cthulhu', 'Blades in the Dark', 'Custom / Homebrew');
create type session_note_kind as enum ('session-recap', 'item-update', 'freeform');
create type session_note_status as enum ('pending', 'processing', 'processed', 'error');
create type npc_disposition as enum ('ally', 'neutral', 'enemy', 'unknown');
create type quest_status as enum ('active', 'completed', 'failed');

-- ── campaigns ────────────────────────────────────────────────────────────
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  system rpg_system not null,
  description text not null default '',
  gm_id uuid not null references auth.users (id) on delete cascade,
  is_processing_notes boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membership as its own table (not an array column) — makes the RLS
-- "am I a member" check a plain EXISTS instead of an array-contains, and
-- lets us add per-member roles later without a schema change.
create table campaign_members (
  campaign_id uuid not null references campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'player', -- 'gm' | 'player'
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create or replace function is_campaign_member(target_campaign_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from campaign_members
    where campaign_id = target_campaign_id and user_id = auth.uid()
  );
$$;

-- ── party ────────────────────────────────────────────────────────────────
create table characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  name text not null,
  player_name text not null default '',
  owner_id uuid references auth.users (id) on delete set null,
  class_and_level text not null default '',
  race text not null default '',
  hp_current integer not null default 10,
  hp_max integer not null default 10,
  armor_class integer not null default 10,
  ability_scores jsonb not null default '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  -- Inventory as jsonb (array of {id,name,quantity,description,equipped,sourceNoteId})
  -- rather than a child table: it's always read/written whole with the
  -- character, and the AI writeback needs a single read-modify-write anyway.
  inventory jsonb not null default '[]',
  notes text not null default '',
  is_npc_controlled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── session notes (raw GM/player input) ─────────────────────────────────
create table session_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  kind session_note_kind not null,
  raw_text text not null,
  status session_note_status not null default 'pending',
  narrative_recap text,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── chronicle ────────────────────────────────────────────────────────────
create table locations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  name text not null,
  description text not null default '',
  source_note_id uuid references session_notes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  name text not null,
  description text not null default '',
  disposition npc_disposition not null default 'unknown',
  portrait_url text, -- text-only structuring for now; image-gen provider TBD
  source_note_id uuid references session_notes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  title text not null,
  description text not null default '',
  status quest_status not null default 'active',
  related_npc_ids uuid[] not null default '{}',
  related_location_ids uuid[] not null default '{}',
  source_note_id uuid references session_notes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  title text not null,
  description text not null default '',
  "order" bigint not null, -- monotonic in-fiction ordering, not wall-clock
  source_note_id uuid references session_notes (id) on delete set null,
  location_id uuid references locations (id) on delete set null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Phase 2 — battle map. Typed now so the schema doesn't shift later.
create table battle_maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  name text not null,
  grid_width integer not null default 20,
  grid_height integer not null default 20,
  background_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── row level security ──────────────────────────────────────────────────
alter table campaigns enable row level security;
alter table campaign_members enable row level security;
alter table characters enable row level security;
alter table session_notes enable row level security;
alter table locations enable row level security;
alter table npcs enable row level security;
alter table quests enable row level security;
alter table timeline_events enable row level security;
alter table battle_maps enable row level security;

create policy "members can read their campaigns" on campaigns
  for select using (is_campaign_member(id));
create policy "creator becomes gm" on campaigns
  for insert with check (auth.uid() = gm_id);
create policy "members can update, gm_id is immutable" on campaigns
  for update using (is_campaign_member(id)) with check (gm_id = (select gm_id from campaigns where id = campaigns.id));
create policy "only gm can delete" on campaigns
  for delete using (auth.uid() = gm_id);

create policy "members can read the roster" on campaign_members
  for select using (is_campaign_member(campaign_id));
create policy "gm manages membership" on campaign_members
  for insert with check (auth.uid() = (select gm_id from campaigns where id = campaign_id));
create policy "gm removes members" on campaign_members
  for delete using (auth.uid() = (select gm_id from campaigns where id = campaign_id));

-- Chronicle + party tables share one shape of policy: any campaign member
-- can read and write by hand, while the AI pipeline always runs through the
-- Vercel function using the service-role key (bypasses RLS entirely), so a
-- client can't spoof an "AI-structured" row with confidence it'll be trusted.
create policy "members read characters" on characters for select using (is_campaign_member(campaign_id));
create policy "members write characters" on characters for all using (is_campaign_member(campaign_id)) with check (is_campaign_member(campaign_id));

create policy "members read notes" on session_notes for select using (is_campaign_member(campaign_id));
create policy "members create their own pending notes" on session_notes
  for insert with check (is_campaign_member(campaign_id) and author_id = auth.uid() and status = 'pending');
create policy "authors edit their own pending notes" on session_notes
  for update using (is_campaign_member(campaign_id) and author_id = auth.uid() and status = 'pending')
  with check (author_id = auth.uid());

create policy "members read locations" on locations for select using (is_campaign_member(campaign_id));
create policy "members write locations" on locations for all using (is_campaign_member(campaign_id)) with check (is_campaign_member(campaign_id));

create policy "members read npcs" on npcs for select using (is_campaign_member(campaign_id));
create policy "members write npcs" on npcs for all using (is_campaign_member(campaign_id)) with check (is_campaign_member(campaign_id));

create policy "members read quests" on quests for select using (is_campaign_member(campaign_id));
create policy "members write quests" on quests for all using (is_campaign_member(campaign_id)) with check (is_campaign_member(campaign_id));

create policy "members read timeline" on timeline_events for select using (is_campaign_member(campaign_id));
create policy "members write timeline" on timeline_events for all using (is_campaign_member(campaign_id)) with check (is_campaign_member(campaign_id));

create policy "members read maps" on battle_maps for select using (is_campaign_member(campaign_id));
create policy "members write maps" on battle_maps for all using (is_campaign_member(campaign_id)) with check (is_campaign_member(campaign_id));

-- New campaign's creator is auto-enrolled as GM member, so is_campaign_member
-- works immediately without a second round-trip from the client.
create or replace function handle_new_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into campaign_members (campaign_id, user_id, role)
  values (new.id, new.gm_id, 'gm');
  return new;
end;
$$;

create trigger on_campaign_created
  after insert on campaigns
  for each row execute function handle_new_campaign();

-- ── realtime ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table campaigns, characters, session_notes, locations, npcs, quests, timeline_events;
