# Role Play Platter

A living chronicle for tabletop RPG tables. The GM (or any player) drops in raw
session notes or a one-line item update; Gemini structures it into a shared,
real-time campaign timeline, NPC codex, quest log, and party inventory that
every connected player sees update live.

## Stack

- **Frontend**: Vite + React 19 + TypeScript (strict) + Tailwind CSS v4 + React Router + Zustand (UI state) + TanStack Query (mutations)
- **Backend**: Supabase — Postgres (real-time via `postgres_changes` + Row Level Security), Auth (Google OAuth)
- **Hosting / API**: Vercel — static hosting for the Vite build, one serverless function (`api/structure-gm-notes.ts`) for the AI pipeline
- **AI**: Gemini (`@google/genai`, free tier — no credit card) called only from the Vercel function — the API key never reaches the client
- **Data model**: `supabase/migrations/0001_init.sql` is the source of truth for schema + RLS; `src/types/database.ts` mirrors it for the app

## Architecture

```
Browser (React) --postgres_changes--> Supabase Postgres (RLS-scoped, real-time)
       |                                          ^
       | fetch('/api/structure-gm-notes',         | writes (timeline/npcs/locations/quests/inventory)
       |       Authorization: Bearer <jwt>)        | via the service-role key (bypasses RLS)
       v                                          |
Vercel function -------> Gemini (forced function call) -> zod-validated -> Postgres writes
```

The Vercel function is the only thing that talks to Gemini, and the only
thing that writes with the Supabase **service-role** key. It:
1. Verifies the caller's Supabase JWT and checks `campaign_members` for that user — RLS protects direct client reads/writes, but this function bypasses RLS (service-role), so it re-checks membership itself. Defense in depth, not the only check.
2. Gives Gemini the campaign's existing NPCs/locations/quests/party roster as context, so it reuses names instead of creating duplicates.
3. Forces a structured `record_campaign_update` tool call back, validates it with zod (model output is untrusted input, same as a client request).
4. Writes timeline events, NPC/location/quest upserts, and party inventory deltas.

## Local setup

1. **Create a Supabase project** at [database.new](https://database.new) (or your org: `app.supabase.com/org/<your-org>`).
2. **Run the schema**: Supabase dashboard → SQL Editor → paste the contents of `supabase/migrations/0001_init.sql` → Run. (Or `supabase db push` if you use the Supabase CLI.)
3. **Auth**: Authentication → Sign In / Providers →
   - **Google**: needs a Google Cloud OAuth client (console.cloud.google.com → APIs & Services → Credentials) with the Supabase callback URL added as an authorized redirect URI (Supabase shows you the exact URL on that page).
   - **Anonymous**: enable this too — it powers "Continue as a guest" on the login screen, for players who don't want to make an account just to join one session.
4. **Env vars**: `cp .env.example .env.local` and fill in:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Project Settings → API (public, safe in the client bundle)
   - `SUPABASE_URL` (same URL), `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API (**secret** — server only)
   - `GEMINI_API_KEY` — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free tier, no credit card)
5. Install deps and run:
   ```
   npm install
   npm run dev          # Vite only — UI works, but /api calls will 404
   # or, to also run the serverless function locally:
   npm i -g vercel
   vercel dev            # serves the app AND api/structure-gm-notes.ts together
   ```
6. **Deploy**: push to GitHub, import the repo in Vercel, then set the same env vars in the Vercel project (Settings → Environment Variables) — `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` especially should only ever live there, never in a committed file.

## What's built

- **Auth**: Google sign-in or guest (anonymous), with a one-click upgrade from guest to a real Google account that keeps the same campaigns (`linkIdentity`, not a fresh sign-in — a fresh sign-in would create a new user and orphan anything the guest owned)
- **profiles table**: mirrors the safe-to-expose bits of `auth.users` (email, display name, avatar), synced by triggers, backfilled for existing users — `auth.users` itself lives in a schema the client can't read, so this is what makes a user lookup possible at all
- **Invites**: two ways to add a player — search known users (via `profiles`) and add them directly when creating a campaign, or copy a join link (`/campaign/:id/join`) for someone who's never signed in yet; either way lands them in `campaign_members` as a player
- **GM/player permissions**: GM Notes (the AI pipeline) is GM-only end to end (hidden tab + RLS); characters can be edited by their owner or the GM, not any member; the world map lets the GM place/move/hide anything, a player can only drag their own character's token, and can only "enter" a location's detail map once their character has actually travelled near its pin (Chebyshev distance, tunable) — no teleporting across the map
- **GM Notes pipeline**: raw text in → Gemini structures it → timeline events, NPC codex entries, quest log entries, and party inventory changes, all written back and live everywhere
- **GM recommendations**: a pushed batch of suggestions (not a chat) — one button re-reads the campaign's current state and returns 3-6 categorized, specific ideas for the next session
- **Party roster**: character sheets (stats, HP, AC, inventory) — inventory updates automatically from notes, or by hand
- **Chronicle view**: real-time timeline + NPC codex + quest log, each with a link into the map centered on that element
- **Battle map**: a scrollable overworld path (location pins connected by an editable route) plus one tactical detail map per location, with decorative water/sand/dirt/forest/rock terrain generated from the location's own description text
- **Profile page**: account type, GM/player campaign counts, campaign list

## Roadmap (not built yet)

- **NPC portraits / map art**: Gemini's free-tier text model doesn't generate images. `npcs.portrait_url` is already in the schema; wiring in an image-gen model (Gemini/Imagen has one, just a different endpoint) is a separate, self-contained slice.
- **Mobile companion** (Expo): read-only character sheet + chronicle view for players at the table.
- **Real-time token position sync while dragging**: moves land on drop (not mid-drag) — fine for turn-based movement, not for watching someone else drag live.
- The writeback in `api/_lib/writeback.ts` writes sequentially rather than in one DB transaction (no multi-table transaction over the Supabase REST client without a Postgres function/RPC) — fine for a single note today, worth revisiting if atomicity matters more later.

## Project layout

```
src/
  types/database.ts      # app-facing (camelCase) shapes, mirrors the SQL schema
  lib/supabase.ts         # client SDK init
  lib/mappers.ts           # snake_case DB rows -> camelCase app types
  hooks/                    # real-time hooks (useSupabaseCollection is the primitive) + mutations
  store/useUiStore.ts       # Zustand — toasts only; campaign data is never duplicated into client state
  pages/                    # routed screens
  components/battlemap/    # MapGrid/TokenView, GmToolbar, terrain generation — shared by the world map and every location's detail map
api/
  structure-gm-notes.ts   # the GM Notes pipeline: auth check -> Gemini call -> validate -> write
  gm-recommendations.ts    # the pushed-recommendations endpoint
  _lib/genai.ts             # shared Gemini client + forced-function-call helper
  _lib/schema.ts             # zod schema + function declaration Gemini must fill (GM Notes)
  _lib/writeback.ts           # Postgres upsert/matching logic (underscore prefix: not routed by Vercel)
vite-plugins/api-dev.ts   # dev-only middleware serving api/*.ts under plain `npm run dev` (no vercel CLI needed locally)
supabase/migrations/       # numbered, run in order in the SQL Editor — schema, RLS, realtime, profiles
```
