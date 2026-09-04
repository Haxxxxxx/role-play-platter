# Role Play Platter

A living chronicle for tabletop RPG tables. The GM (or any player) drops in raw
session notes or a one-line item update; Claude structures it into a shared,
real-time campaign timeline, NPC codex, quest log, and party inventory that
every connected player sees update live.

## Stack

- **Frontend**: Vite + React 19 + TypeScript (strict) + Tailwind CSS v4 + React Router + Zustand (UI state) + TanStack Query (mutations)
- **Backend**: Supabase — Postgres (real-time via `postgres_changes` + Row Level Security), Auth (Google OAuth)
- **Hosting / API**: Vercel — static hosting for the Vite build, one serverless function (`api/structure-gm-notes.ts`) for the AI pipeline
- **AI**: Claude (`@anthropic-ai/sdk`) called only from the Vercel function — the API key never reaches the client
- **Data model**: `supabase/migrations/0001_init.sql` is the source of truth for schema + RLS; `src/types/database.ts` mirrors it for the app

## Architecture

```
Browser (React) --postgres_changes--> Supabase Postgres (RLS-scoped, real-time)
       |                                          ^
       | fetch('/api/structure-gm-notes',         | writes (timeline/npcs/locations/quests/inventory)
       |       Authorization: Bearer <jwt>)        | via the service-role key (bypasses RLS)
       v                                          |
Vercel function -------> Claude (tool_use, forced) -> zod-validated -> Postgres writes
```

The Vercel function is the only thing that talks to Claude, and the only
thing that writes with the Supabase **service-role** key. It:
1. Verifies the caller's Supabase JWT and checks `campaign_members` for that user — RLS protects direct client reads/writes, but this function bypasses RLS (service-role), so it re-checks membership itself. Defense in depth, not the only check.
2. Gives Claude the campaign's existing NPCs/locations/quests/party roster as context, so it reuses names instead of creating duplicates.
3. Forces a structured `record_campaign_update` tool call back, validates it with zod (model output is untrusted input, same as a client request).
4. Writes timeline events, NPC/location/quest upserts, and party inventory deltas.

## Local setup

1. **Create a Supabase project** at [database.new](https://database.new) (or your org: `app.supabase.com/org/<your-org>`).
2. **Run the schema**: Supabase dashboard → SQL Editor → paste the contents of `supabase/migrations/0001_init.sql` → Run. (Or `supabase db push` if you use the Supabase CLI.)
3. **Enable Google sign-in**: Authentication → Providers → Google. You'll need a Google Cloud OAuth client (console.cloud.google.com → APIs & Services → Credentials) with the Supabase callback URL added as an authorized redirect URI (Supabase shows you the exact URL on that page).
4. **Env vars**: `cp .env.example .env.local` and fill in:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Project Settings → API (public, safe in the client bundle)
   - `SUPABASE_URL` (same URL), `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API (**secret** — server only)
   - `ANTHROPIC_API_KEY` — console.anthropic.com
5. Install deps and run:
   ```
   npm install
   npm run dev          # Vite only — UI works, but /api calls will 404
   # or, to also run the serverless function locally:
   npm i -g vercel
   vercel dev            # serves the app AND api/structure-gm-notes.ts together
   ```
6. **Deploy**: push to GitHub, import the repo in Vercel, then set the same env vars in the Vercel project (Settings → Environment Variables) — `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` especially should only ever live there, never in a committed file.

## What's built (v1 foundation)

- Google auth (Supabase), campaign creation, membership-scoped Row Level Security
- **GM Notes pipeline**: raw text in → Claude structures it → timeline events, NPC codex entries, quest log entries, and party inventory changes, all written back and live everywhere
- **Party roster**: character sheets (stats, HP, AC, inventory) — inventory updates automatically from notes, or by hand
- **Chronicle view**: real-time timeline + NPC codex + quest log

## Roadmap (not built yet)

- **Battle map** (phase 2): grid, draggable tokens, fog of war, initiative tracker. `src/types/database.ts` already has a `BattleMap` type and `battle_maps` table exists in the migration, and `src/pages/MapPage.tsx` is stubbed so the schema won't need to shift later — needs a canvas engine (e.g. `react-konva`) and real-time token sync.
- **NPC portraits / map art**: Claude is text-only. `npcs.portrait_url` is already in the schema; wiring in an image-gen provider is a separate, self-contained slice.
- **Mobile companion** (Expo): read-only character sheet + chronicle view for players at the table.
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
api/
  structure-gm-notes.ts   # the Vercel function: auth check -> Claude call -> validate -> write
  _lib/schema.ts            # zod schema + tool definition Claude must fill
  _lib/writeback.ts          # Postgres upsert/matching logic (underscore prefix: not routed by Vercel)
supabase/migrations/0001_init.sql  # schema + RLS policies + realtime publication
```
