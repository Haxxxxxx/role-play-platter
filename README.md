# Role Play Platter

A living chronicle for tabletop RPG tables. The GM (or any player) drops in raw
session notes or a one-line item update; Claude structures it into a shared,
real-time campaign timeline, NPC codex, quest log, and party inventory that
every connected player sees update live.

## Stack

- **Frontend**: Vite + React 19 + TypeScript (strict) + Tailwind CSS v4 + React Router + Zustand (UI state) + TanStack Query (mutations)
- **Backend**: Firebase — Firestore (real-time data + security rules), Auth (Google sign-in), Cloud Functions (v2, Node 20)
- **AI**: Claude (`@anthropic-ai/sdk`) called only from Cloud Functions — the API key never reaches the client
- **Data model**: `src/types/firestore.ts` is the single source of truth for every collection's shape

## Architecture

```
Browser (React) --Firestore onSnapshot--> Firestore (real-time, security-rule-scoped)
       |                                          ^
       | httpsCallable('structureGmNotes')        | writes (timeline/npcs/locations/quests/inventory)
       v                                          |
Cloud Function --------> Claude (tool_use, forced) -> zod-validated -> Firestore batch write
```

The Cloud Function is the only thing that talks to Claude. It:
1. Confirms the caller is a member of the campaign (Firestore rules do the same for direct reads/writes — this is defense in depth, not the only check).
2. Gives Claude the campaign's existing NPCs/locations/quests/party roster as context, so it reuses names instead of creating duplicates.
3. Forces a structured `record_campaign_update` tool call back, validates it with zod (model output is untrusted input, same as a client request).
4. Batch-writes timeline events, NPC/location/quest upserts, and party inventory deltas.

## Local setup

1. **Create a Firebase project** (console.firebase.google.com), enable **Firestore**, **Authentication → Google sign-in**, and **Functions**.
2. `firebase login` (CLI: `npm i -g firebase-tools` if you don't have it), then set the project id:
   ```
   firebase use --add   # or edit .firebaserc directly
   ```
3. **Frontend env**: `cp .env.example .env.local` and fill in the Firebase config values (Project settings → Your apps → Web app). These are public client identifiers, not secrets — Firestore rules are what actually gate access.
4. **Functions secret**:
   ```
   firebase functions:secrets:set ANTHROPIC_API_KEY
   ```
   For the local emulator, `cp functions/.env.example functions/.env` and put a dev key there instead (never commit it — it's gitignored).
5. Install deps and run:
   ```
   npm install
   cd functions && npm install && cd ..
   firebase emulators:start   # Firestore + Auth + Functions locally
   npm run dev                # Vite dev server, in another terminal
   ```
6. Deploy security rules and functions when ready:
   ```
   firebase deploy --only firestore:rules,functions
   npm run build && firebase deploy --only hosting
   ```

## What's built (v1 foundation)

- Google auth, campaign creation, membership-scoped Firestore rules
- **GM Notes pipeline**: raw text in → Claude structures it → timeline events, NPC codex entries, quest log entries, and party inventory changes, all written back and live everywhere
- **Party roster**: character sheets (stats, HP, AC, inventory) — inventory updates automatically from notes, or by hand
- **Chronicle view**: real-time timeline + NPC codex + quest log

## Roadmap (not built yet)

- **Battle map** (phase 2): grid, draggable tokens, fog of war, initiative tracker. `src/types/firestore.ts` already has a `BattleMap` type and `src/pages/MapPage.tsx` is stubbed so the schema won't need to shift later — needs a canvas engine (e.g. `react-konva`) and real-time token sync.
- **NPC portraits / map art**: Claude is text-only. `npcs.portraitUrl` is already in the schema; wiring in an image-gen provider is a separate, self-contained slice.
- **Mobile companion** (Expo): read-only character sheet + chronicle view for players at the table.
- Bundle is currently one ~250KB gzipped chunk (mostly Firebase SDK) — fine for now, worth code-splitting once more routes exist.

## Project layout

```
src/
  types/firestore.ts     # every Firestore document shape
  lib/firebase.ts        # client SDK init
  hooks/                 # real-time Firestore hooks (useCollection is the primitive) + mutations
  store/useUiStore.ts    # Zustand — toasts only; campaign data is never duplicated into client state
  pages/                 # routed screens
functions/
  src/schema.ts          # zod schema + tool definition Claude must fill
  src/structureGmNotes.ts # the callable function: auth check -> Claude call -> validate -> write
  src/writeback.ts        # Firestore upsert/matching logic
firestore.rules          # membership-scoped access control
```
