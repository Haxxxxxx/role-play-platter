-- One AI-generated class/skill reference per campaign, so character
-- creation isn't starting from a blank page for whatever system/universe
-- the GM named. Generated content only, never a reproduction of a
-- copyrighted rulebook — see the system instruction in
-- api/generate-system-reference.ts. GM-only to (re)generate (same posture
-- as the rest of the AI pipeline: prep tooling, not a player action);
-- every member can read it, since it feeds character creation for anyone.
create table system_reference (
  campaign_id uuid primary key references campaigns (id) on delete cascade,
  classes jsonb not null default '[]',
  skills jsonb not null default '[]',
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table system_reference enable row level security;

create policy "members read system reference" on system_reference
  for select using (is_campaign_member(campaign_id));

create policy "gm writes system reference" on system_reference
  for all using (auth.uid() = (select gm_id from campaigns where id = campaign_id))
  with check (auth.uid() = (select gm_id from campaigns where id = campaign_id));

alter publication supabase_realtime add table system_reference;
