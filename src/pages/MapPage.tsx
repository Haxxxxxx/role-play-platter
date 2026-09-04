import { useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useLocations, useNpcs } from '@/hooks/useChronicle'
import { useParty } from '@/hooks/useParty'
import {
  createEdge,
  createToken,
  deleteToken,
  moveToken,
  setTokenVisibility,
  useBattleMap,
  useMapEdges,
  useMapTokens,
} from '@/hooks/useBattleMap'
import { useUiStore } from '@/store/useUiStore'
import type { Campaign, Location, MapEdge, MapToken, Npc, NpcDisposition } from '@/types/database'

const CELL_SIZE = 36
const LOCATION_STYLE = { icon: '📍', color: '#d97757' }

const DECORATION_PRESETS: { label: string; icon: string; color: string }[] = [
  { label: 'Arbre', icon: '🌲', color: '#2f6b3a' },
  { label: 'Rocher', icon: '🪨', color: '#6b6b6b' },
  { label: 'Porte', icon: '🚪', color: '#8a5a33' },
  { label: 'Coffre', icon: '📦', color: '#a9832f' },
  { label: 'Feu', icon: '🔥', color: '#d9553a' },
  { label: 'Piège', icon: '⚠️', color: '#c9a227' },
  { label: 'Eau', icon: '💧', color: '#3a7fd9' },
  { label: 'Mur', icon: '🧱', color: '#8a4b3a' },
]

const NPC_STYLE: Record<NpcDisposition, { icon: string; color: string }> = {
  ally: { icon: '🤝', color: '#3fae6a' },
  enemy: { icon: '⚔️', color: '#c94f4f' },
  neutral: { icon: '👤', color: '#9a8f7a' },
  unknown: { icon: '❔', color: '#6b6b6b' },
}

export function MapPage() {
  const { campaign } = useOutletContext<{ campaign: Campaign }>()
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuth()
  const isGm = user?.id === campaign.gmId

  const { map, loading: mapLoading } = useBattleMap(campaignId, isGm)
  const { data: tokens } = useMapTokens(map?.id)
  const { data: edges } = useMapEdges(map?.id)
  const { data: npcs } = useNpcs(campaignId)
  const { data: locations } = useLocations(campaignId)
  const { data: party } = useParty(campaignId)
  const pushToast = useUiStore((s) => s.pushToast)

  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null

  // Path mode: GM clicks tokens in sequence to lay the route between them —
  // click A then B connects them and leaves B as the new starting point, so
  // a whole chain of locations can be strung together without re-toggling.
  const [pathMode, setPathMode] = useState(false)
  const [pathFromId, setPathFromId] = useState<string | null>(null)

  const myCharacterIds = new Set(party.filter((c) => c.ownerId === user?.id).map((c) => c.id))

  function canDrag(token: MapToken): boolean {
    if (pathMode) return false
    return isGm || (token.refCharacterId != null && myCharacterIds.has(token.refCharacterId))
  }

  async function handleDrop(token: MapToken, x: number, y: number) {
    if (!map) return
    const clampedX = Math.max(0, Math.min(map.gridWidth - 1, x))
    const clampedY = Math.max(0, Math.min(map.gridHeight - 1, y))
    if (clampedX === token.x && clampedY === token.y) return
    try {
      await moveToken(token.id, clampedX, clampedY)
    } catch {
      pushToast("Impossible de déplacer ce pion.", 'error')
    }
  }

  function handleTokenClick(tokenId: string) {
    if (!pathMode || !map || !campaignId) {
      setSelectedTokenId(tokenId)
      return
    }
    if (!pathFromId) {
      setPathFromId(tokenId)
      return
    }
    createEdge({ campaignId, mapId: map.id, fromTokenId: pathFromId, toTokenId: tokenId }).catch(() =>
      pushToast('Impossible de relier ces pions.', 'error'),
    )
    setPathFromId(tokenId)
  }

  async function spawnToken(params: Omit<Parameters<typeof createToken>[0], 'campaignId' | 'mapId' | 'x' | 'y'>) {
    if (!map || !campaignId) return
    const x = Math.floor(map.gridWidth / 2 + (tokens.length % 4))
    const y = Math.floor(map.gridHeight / 2)
    try {
      await createToken({ ...params, campaignId, mapId: map.id, x, y })
    } catch {
      pushToast("Impossible d'ajouter ce pion.", 'error')
    }
  }

  if (mapLoading) return <div className="p-10 text-parchment-200/60">Chargement de la carte…</div>

  if (!map) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 py-24 text-center">
        <h2 className="font-display text-xl text-parchment-100">En attente du MJ</h2>
        <p className="mt-2 max-w-md text-sm text-parchment-200/60">
          Le MJ n'a pas encore ouvert la carte de cette campagne.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-parchment-100">{map.name}</h2>
        <span className="text-xs uppercase tracking-wide text-parchment-200/50">
          {isGm ? 'Vue MJ — éditable' : 'Vue joueur'}
        </span>
      </div>

      {isGm && (
        <GmToolbar
          npcs={npcs}
          locations={locations}
          party={party}
          pathMode={pathMode}
          onTogglePathMode={() => {
            setPathMode((prev) => !prev)
            setPathFromId(null)
          }}
          onAddDecoration={(preset) =>
            spawnToken({ kind: 'decoration', label: preset.label, icon: preset.icon, color: preset.color })
          }
          onAddNpc={(npc) =>
            spawnToken({
              kind: 'npc',
              label: npc.name,
              icon: NPC_STYLE[npc.disposition].icon,
              color: NPC_STYLE[npc.disposition].color,
              refNpcId: npc.id,
            })
          }
          onAddLocation={(location) =>
            spawnToken({
              kind: 'location',
              label: location.name,
              icon: LOCATION_STYLE.icon,
              color: LOCATION_STYLE.color,
              refLocationId: location.id,
            })
          }
          onAddCharacter={(characterId, name) =>
            spawnToken({ kind: 'character', label: name, icon: '🧑', color: '#7c6ce8', refCharacterId: characterId })
          }
          onAddMonster={() => spawnToken({ kind: 'monster', label: 'Monstre', icon: '👹', color: '#7a2f2f' })}
        />
      )}

      {pathMode && (
        <p className="mb-3 text-xs text-ember-400">
          Mode chemin actif — cliquez deux pions pour les relier, puis continuez la chaîne. Cliquez à nouveau sur
          « Tracer un chemin » pour arrêter.
        </p>
      )}

      <MapGrid
        gridWidth={map.gridWidth}
        gridHeight={map.gridHeight}
        tokens={tokens}
        edges={edges}
        selectedTokenId={pathMode ? pathFromId : selectedTokenId}
        onSelect={handleTokenClick}
        onDeselect={() => setSelectedTokenId(null)}
        canDrag={canDrag}
        onDrop={handleDrop}
      />

      {isGm && selectedToken && (
        <SelectedTokenToolbar
          token={selectedToken}
          onDelete={() => {
            deleteToken(selectedToken.id).catch(() => pushToast('Suppression impossible.', 'error'))
            setSelectedTokenId(null)
          }}
          onToggleVisibility={() =>
            setTokenVisibility(selectedToken.id, !selectedToken.visibleToPlayers).catch(() =>
              pushToast('Action impossible.', 'error'),
            )
          }
        />
      )}
    </div>
  )
}

function GmToolbar({
  npcs,
  locations,
  party,
  pathMode,
  onTogglePathMode,
  onAddDecoration,
  onAddNpc,
  onAddLocation,
  onAddCharacter,
  onAddMonster,
}: {
  npcs: Npc[]
  locations: Location[]
  party: { id: string; name: string }[]
  pathMode: boolean
  onTogglePathMode: () => void
  onAddDecoration: (preset: { label: string; icon: string; color: string }) => void
  onAddNpc: (npc: Npc) => void
  onAddLocation: (location: Location) => void
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
          title="Monstre"
          className="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-lg leading-none hover:border-ember-500/50"
        >
          👹
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
    </div>
  )
}

function SelectedTokenToolbar({
  token,
  onDelete,
  onToggleVisibility,
}: {
  token: MapToken
  onDelete: () => void
  onToggleVisibility: () => void
}) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-ember-500/40 bg-ink-900 p-3 text-sm">
      <span className="text-parchment-100">
        {token.icon} {token.label}
      </span>
      {(token.kind === 'npc' || token.kind === 'monster') && (
        <button
          onClick={onToggleVisibility}
          className="rounded-md border border-ink-700 px-2 py-1 text-xs text-parchment-200/70 hover:bg-ink-800"
        >
          {token.visibleToPlayers ? '👁 Visible des joueurs' : '🙈 Caché des joueurs'}
        </button>
      )}
      <button
        onClick={onDelete}
        className="ml-auto rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
      >
        Supprimer
      </button>
    </div>
  )
}

function MapGrid({
  gridWidth,
  gridHeight,
  tokens,
  edges,
  selectedTokenId,
  onSelect,
  onDeselect,
  canDrag,
  onDrop,
}: {
  gridWidth: number
  gridHeight: number
  tokens: MapToken[]
  edges: MapEdge[]
  selectedTokenId: string | null
  onSelect: (id: string) => void
  onDeselect: () => void
  canDrag: (token: MapToken) => boolean
  onDrop: (token: MapToken, x: number, y: number) => void
}) {
  const tokenById = new Map(tokens.map((t) => [t.id, t]))
  const center = (t: MapToken) => ({ cx: t.x * CELL_SIZE + CELL_SIZE / 2, cy: t.y * CELL_SIZE + CELL_SIZE / 2 })
  const width = gridWidth * CELL_SIZE
  const height = gridHeight * CELL_SIZE

  return (
    <div
      // The whole point of a campaign-spanning map: this scrolls. The grid
      // itself is sized to the map's full width/height (see useBattleMap's
      // DEFAULT_GRID_*), typically well beyond one viewport.
      className="relative max-h-[70vh] overflow-auto rounded-lg border border-ink-700 bg-[#1a2e22]"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(245,236,217,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,236,217,0.06) 1px, transparent 1px)',
        backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDeselect()
      }}
    >
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="pointer-events-none absolute left-0 top-0">
          {edges.map((edge) => {
            const from = tokenById.get(edge.fromTokenId)
            const to = tokenById.get(edge.toTokenId)
            if (!from || !to) return null
            const a = center(from)
            const b = center(to)
            return (
              <line
                key={edge.id}
                x1={a.cx}
                y1={a.cy}
                x2={b.cx}
                y2={b.cy}
                stroke="#e6926f"
                strokeWidth={3}
                strokeDasharray="2 8"
                strokeLinecap="round"
                opacity={0.7}
              />
            )
          })}
        </svg>

        {tokens.map((token) => (
          <TokenView
            key={token.id}
            token={token}
            selected={token.id === selectedTokenId}
            draggable={canDrag(token)}
            onSelect={() => onSelect(token.id)}
            onDrop={(x, y) => onDrop(token, x, y)}
          />
        ))}
      </div>
    </div>
  )
}

function TokenView({
  token,
  selected,
  draggable,
  onSelect,
  onDrop,
}: {
  token: MapToken
  selected: boolean
  draggable: boolean
  onSelect: () => void
  onDrop: (x: number, y: number) => void
}) {
  const draggingRef = useRef(false)
  const originRef = useRef({ pointerX: 0, pointerY: 0, tokenX: 0, tokenY: 0 })
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    onSelect()
    if (!draggable) return
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    originRef.current = { pointerX: e.clientX, pointerY: e.clientY, tokenX: token.x, tokenY: token.y }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    setDragOffset({ dx: e.clientX - originRef.current.pointerX, dy: e.clientY - originRef.current.pointerY })
  }

  function onPointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (dragOffset) {
      const newX = originRef.current.tokenX + Math.round(dragOffset.dx / CELL_SIZE)
      const newY = originRef.current.tokenY + Math.round(dragOffset.dy / CELL_SIZE)
      onDrop(newX, newY)
    }
    setDragOffset(null)
  }

  const left = token.x * CELL_SIZE + (dragOffset?.dx ?? 0)
  const top = token.y * CELL_SIZE + (dragOffset?.dy ?? 0)

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute flex items-center justify-center rounded-full border-2 text-base shadow-md transition-transform ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${selected ? 'border-ember-400 ring-2 ring-ember-400/60' : 'border-ink-950/60'} ${
        !token.visibleToPlayers ? 'opacity-60 [border-style:dashed]' : ''
      }`}
      style={{
        left,
        top,
        width: CELL_SIZE - 4,
        height: CELL_SIZE - 4,
        backgroundColor: token.color,
        touchAction: 'none',
      }}
      title={token.label}
    >
      {token.icon}
    </div>
  )
}
