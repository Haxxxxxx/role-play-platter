/**
 * Phase 2: live battle map (grid, tokens, fog of war, initiative tracker).
 * The `BattleMap` type already exists in src/types/firestore.ts so the schema
 * won't need to shift when this gets built — it needs a canvas engine
 * (react-konva or similar) and real-time token sync, which is its own slice
 * of work on top of this foundation.
 */
export function MapPage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 py-24 text-center">
      <h2 className="font-display text-xl text-parchment-100">Battle Map — coming in phase 2</h2>
      <p className="mt-2 max-w-md text-sm text-parchment-200/60">
        Grid map, draggable tokens, fog of war, and a real-time initiative tracker. The chronicle
        and party foundation is live first so the map has campaign/party data to hook into.
      </p>
    </div>
  )
}
