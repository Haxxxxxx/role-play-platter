import { DECORATION_PRESETS, MONSTER_STYLE } from '@/components/battlemap/presets'
import type { Location, Npc } from '@/types/database'

interface DecorationPreset {
  label: string
  icon: string
  color: string
}

export function GmToolbar({
  npcs,
  party,
  locations,
  pathMode,
  onTogglePathMode,
  onAddDecoration,
  onAddNpc,
  onAddLocation,
  onAddCharacter,
  onAddMonster,
}: {
  npcs: Npc[]
  party: { id: string; name: string }[]
  /** Omit on a location's own detail map — the "add a location pin" and
   * path-drawing controls only make sense on the overworld. */
  locations?: Location[]
  pathMode?: boolean
  onTogglePathMode?: () => void
  onAddDecoration: (preset: DecorationPreset) => void
  onAddNpc: (npc: Npc) => void
  onAddLocation?: (location: Location) => void
  onAddCharacter: (id: string, name: string) => void
  onAddMonster: () => void
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-ink-700 bg-ink-900 p-3">
      <div className="flex flex-wrap gap-1.5">
        {DECORATION_PRESETS.map((preset) => (
          <button
            key={preset.label}
            title={preset.label}
            onClick={() => onAddDecoration(preset)}
            className="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-lg leading-none hover:border-ember-500/50"
          >
            {preset.icon}
          </button>
        ))}
        <button
          onClick={onAddMonster}
          title={MONSTER_STYLE.label}
          className="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-lg leading-none hover:border-ember-500/50"
        >
          {MONSTER_STYLE.icon}
        </button>
      </div>

      <select
        onChange={(e) => {
          const npc = npcs.find((n) => n.id === e.target.value)
          if (npc) onAddNpc(npc)
          e.target.value = ''
        }}
        defaultValue=""
        className="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-parchment-200/80 outline-none"
      >
        <option value="" disabled>
          + PNJ…
        </option>
        {npcs.map((npc) => (
          <option key={npc.id} value={npc.id}>
            {npc.name}
          </option>
        ))}
      </select>

      {locations && onAddLocation && (
        <select
          onChange={(e) => {
            const location = locations.find((l) => l.id === e.target.value)
            if (location) onAddLocation(location)
            e.target.value = ''
          }}
          defaultValue=""
          className="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-parchment-200/80 outline-none"
        >
          <option value="" disabled>
            + Lieu…
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}

      <select
        onChange={(e) => {
          const character = party.find((c) => c.id === e.target.value)
          if (character) onAddCharacter(character.id, character.name)
          e.target.value = ''
        }}
        defaultValue=""
        className="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-parchment-200/80 outline-none"
      >
        <option value="" disabled>
          + Personnage…
        </option>
        {party.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {onTogglePathMode && (
        <button
          onClick={onTogglePathMode}
          className={`ml-auto rounded-md border px-3 py-1.5 text-xs ${
            pathMode
              ? 'border-ember-500 bg-ember-500/10 text-ember-400'
              : 'border-ink-700 text-parchment-200/70 hover:bg-ink-800'
          }`}
        >
          🔗 Tracer un chemin
        </button>
      )}
    </div>
  )
}
