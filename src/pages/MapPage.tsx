import { useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useFullscreen } from '@/hooks/useFullscreen'
import { useLocations, useNpcs } from '@/hooks/useChronicle'
import { useParty } from '@/hooks/useParty'
import {
  createEdge,
  createToken,
  deleteToken,
  getMapId,
  LOCATION_MAP_ENTRY,
  moveToken,
  moveTokenToMap,
  setTokenVisibility,
  updateTokenContent,
  useBattleMap,
  useMapEdges,
  useMapTokens,
} from '@/hooks/useBattleMap'
import { CHARACTER_STYLE, LOCATION_STYLE, MONSTER_STYLE, NPC_STYLE } from '@/components/battlemap/presets'
import { MapGrid } from '@/components/battlemap/MapGrid'
import { GmToolbar } from '@/components/battlemap/GmToolbar'
import { SelectedTokenToolbar } from '@/components/battlemap/SelectedTokenToolbar'
import { useUiStore } from '@/store/useUiStore'
import { EmptyState } from '@/components/ui'
import { MapViewHeader } from '@/components/battlemap/MapViewHeader'
import type { Campaign, MapToken } from '@/types/database'

interface MapNavState {
  centerTokenId?: string
}

// Chebyshev distance, in grid cells, within which a player's character is
// considered "at" a location pin — generous enough that an approximately-
// placed token still counts, not so generous that it's teleporting.
const TRAVEL_RANGE = 2

function chebyshevDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export function MapPage() {
  const { campaign } = useOutletContext<{ campaign: Campaign }>()
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const centerTokenId = (routerLocation.state as MapNavState | null)?.centerTokenId ?? null
  const isGm = user?.id === campaign.gmId

  const { map, loading: mapLoading } = useBattleMap(campaignId, isGm)
  const { data: tokens } = useMapTokens(map?.id)
  const { data: edges } = useMapEdges(map?.id)
  const { data: npcs } = useNpcs(campaignId)
  const { data: locations } = useLocations(campaignId)
  const { data: party } = useParty(campaignId)
  const pushToast = useUiStore((s) => s.pushToast)

  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>()

  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(centerTokenId)

  // Path mode: GM clicks tokens in sequence to lay the route between them —
  // click A then B connects them and leaves B as the new starting point, so
  // a whole chain of locations can be strung together without re-toggling.
  const [pathMode, setPathMode] = useState(false)
  const [pathFromId, setPathFromId] = useState<string | null>(null)

  // Preparation phase: the campaign hasn't started, so there's no party
  // position yet — let players browse the map freely (open any location's
  // detail map, no travel-range gate, nothing dimmed). They still only see
  // revealed tokens: the RLS "members read visible tokens" policy is
  // untouched, so hidden pins and their hidden contents stay hidden.
  const inPrep = campaign.status === 'setup'

  const myCharacterIds = new Set(party.filter((c) => c.ownerId === user?.id).map((c) => c.id))
  const myTokens = tokens.filter((t) => t.refCharacterId != null && myCharacterIds.has(t.refCharacterId))

  function canDrag(token: MapToken): boolean {
    if (pathMode) return false
    return isGm || (token.refCharacterId != null && myCharacterIds.has(token.refCharacterId))
  }

  function isReachableForPlayer(locationToken: MapToken): boolean {
    return myTokens.some((mt) => chebyshevDistance(mt, locationToken) <= TRAVEL_RANGE)
  }

  const unreachableLocationIds = new Set(
    !isGm && !inPrep
      ? tokens.filter((t) => t.kind === 'location' && !isReachableForPlayer(t)).map((t) => t.id)
      : [],
  )

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

  async function handleActivate(token: MapToken) {
    if (pathMode && map && campaignId) {
      if (!pathFromId) {
        setPathFromId(token.id)
        return
      }
      createEdge({ campaignId, mapId: map.id, fromTokenId: pathFromId, toTokenId: token.id }).catch(() =>
        pushToast('Impossible de relier ces pions.', 'error'),
      )
      setPathFromId(token.id)
      return
    }
    // A location pin is the whole point of "click a step of the campaign" —
    // zoom straight into its own detail map instead of just selecting it.
    // The GM can jump anywhere; a player has to actually have travelled
    // their character near it first — no teleporting across the map.
    if (token.kind === 'location' && token.refLocationId) {
      // Prep phase: no party position yet, so a player can open any
      // location's detail map to look around (still only revealed tokens).
      if (!isGm && inPrep) {
        navigate(`/campaign/${campaignId}/map/${token.refLocationId}`)
        return
      }
      if (!isGm && !isReachableForPlayer(token)) {
        pushToast('Approchez votre personnage de ce lieu pour vous y rendre.', 'info')
        return
      }
      // Bring the traveling character's own token along onto the location's
      // detail map — the same hero circle, not a stray copy left behind on
      // the world map. Only the token(s) that actually got close enough to
      // trigger this travel — a player controlling more than one character
      // shouldn't have a character clear across the map teleported in just
      // because a different one of theirs walked up to the pin. Only
      // possible once the GM has actually opened that location's map; if
      // not, still navigate (shows "waiting on the GM"), the character just
      // doesn't have a token to place anywhere yet.
      //
      // Wrapped as a whole: this is a nice-to-have riding along with the
      // actual navigation, which must never get skipped just because a
      // token-follow call failed in a way .catch() further down didn't
      // anticipate (a dropped connection rejecting getMapId itself, not
      // just the moveTokenToMap calls) — that would silently strand the
      // click with no navigation and no error shown, reading as "stuck".
      try {
        const travelingTokens = myTokens.filter((mt) => chebyshevDistance(mt, token) <= TRAVEL_RANGE)
        if (!isGm && travelingTokens.length > 0) {
          const destMapId = await getMapId(campaignId!, token.refLocationId)
          if (destMapId) {
            await Promise.all(
              travelingTokens.map((t) => moveTokenToMap(t.id, destMapId, LOCATION_MAP_ENTRY.x, LOCATION_MAP_ENTRY.y)),
            )
          }
        }
      } catch {
        pushToast("Le pion n'a pas pu suivre jusqu'ici.", 'error')
      }
      navigate(`/campaign/${campaignId}/map/${token.refLocationId}`)
      return
    }
    setSelectedTokenId(token.id)
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

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null

  if (mapLoading) return <div className="p-10 text-parchment-300">Chargement de la carte…</div>

  if (!map) {
    return <EmptyState title="En attente du MJ" description="Le MJ n'a pas encore ouvert la carte de cette campagne." />
  }

  return (
    <div ref={fullscreenRef} className={isFullscreen ? 'overflow-auto bg-ink-950 p-4' : ''}>
      <MapViewHeader title={map.name} isGm={isGm} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />

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
            spawnToken({
              kind: 'character',
              label: name,
              icon: CHARACTER_STYLE.icon,
              color: CHARACTER_STYLE.color,
              refCharacterId: characterId,
            })
          }
          onAddMonster={() => spawnToken({ kind: 'monster', label: MONSTER_STYLE.label, icon: MONSTER_STYLE.icon, color: MONSTER_STYLE.color })}
        />
      )}

      {pathMode && (
        <p className="mb-3 rounded-md border border-ember-500/30 bg-ember-500/10 px-3 py-2 text-xs text-ember-400">
          Mode chemin actif — cliquez deux pions pour les relier, puis continuez la chaîne. Cliquez à nouveau sur
          « Tracer un chemin » pour arrêter.
        </p>
      )}

      {!isGm && inPrep && (
        <p className="mb-3 rounded-md border border-arcane-500/30 bg-arcane-500/10 px-3 py-2 text-xs text-arcane-500">
          Phase de préparation — explorez librement la carte et les lieux. Le MJ n'a pas encore tout révélé :
          ce qui est caché le reste.
        </p>
      )}

      {!isGm && !inPrep && myTokens.length > 0 && (
        <p className="mb-3 text-xs text-parchment-300">
          Déplacez votre pion près d'un lieu pour vous y rendre — les lieux hors de portée sont estompés.
        </p>
      )}

      <MapGrid
        mapId={map.id}
        terrainText={`${campaign.description} ${locations.map((l) => `${l.name} ${l.description}`).join(' ')}`}
        forceOutdoorTerrain
        gridWidth={map.gridWidth}
        gridHeight={map.gridHeight}
        tokens={tokens}
        edges={edges}
        selectedTokenId={pathMode ? pathFromId : selectedTokenId}
        centerTokenId={centerTokenId}
        mutedTokenIds={unreachableLocationIds}
        expanded={isFullscreen}
        onActivate={handleActivate}
        onDeselect={() => setSelectedTokenId(null)}
        canDrag={canDrag}
        onDrop={handleDrop}
      />

      {!pathMode && selectedToken && (
        <SelectedTokenToolbar
          token={selectedToken}
          isGm={isGm}
          onDelete={() => {
            deleteToken(selectedToken.id).catch(() => pushToast('Suppression impossible.', 'error'))
            setSelectedTokenId(null)
          }}
          onToggleVisibility={() =>
            setTokenVisibility(selectedToken.id, !selectedToken.visibleToPlayers).catch(() =>
              pushToast('Action impossible.', 'error'),
            )
          }
          onContentChange={(content) =>
            updateTokenContent(selectedToken.id, content).catch(() => pushToast('Action impossible.', 'error'))
          }
        />
      )}
    </div>
  )
}
