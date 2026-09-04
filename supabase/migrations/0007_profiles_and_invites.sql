-- A queryable user directory: `auth.users` lives in a schema PostgREST/the
-- client can't read at all, so there was no way to look someone up to
-- invite them by email — only the blind copy-a-link flow. This mirrors the
-- bits of auth.users that are safe to expose (never anything auth-related)
-- into public.profiles, kept in sync by triggers, and lets the GM search it
-- when creating a campaign.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Any signed-in user can look anyone up — this is a private friend-group
-- app, not a public directory; the tradeoff is deliberately toward "easy to
-- invite" over "unlisted by default".
create policy "signed-in users read all profiles" on profiles
  for select using (auth.uid() is not null);

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, display_name, avatar_url, is_anonymous)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keeps the profile in sync when a guest links a Google account (email and
-- metadata change on the *same* auth.users row — same id, so their
-- campaigns stay theirs, but the profile needs to catch up).
create or replace function handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set
    email = new.email,
    display_name = coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', profiles.display_name),
    avatar_url = coalesce(new.raw_user_meta_data ->> 'avatar_url', profiles.avatar_url),
    is_anonymous = coalesce(new.is_anonymous, false),
    updated_at = now()
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function handle_user_updated();

-- Backfill: every user created before this migration existed.
insert into profiles (id, email, display_name, avatar_url, is_anonymous)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'), raw_user_meta_data ->> 'avatar_url', coalesce(is_anonymous, false)
from auth.users
on conflict (id) do nothing;

-- The GM can now add a *known* user (one who already has a profile) directly
-- when creating or managing a campaign, alongside the existing invite-link
-- self-join for people who don't have an account yet.
create policy "gm invites known users" on campaign_members
  for insert with check (
    auth.uid() = (select gm_id from campaigns where id = campaign_id)
    and role = 'player'
  );
