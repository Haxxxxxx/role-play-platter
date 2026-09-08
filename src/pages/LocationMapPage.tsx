import { useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useFullscreen } from '@/hooks/useFullscreen'
import { useLocations, useNpcs } from '@/hooks/useChronicle'
import { useParty } from '@/hooks/useParty'
import {
  createToken,
  deleteToken,
  getLocationPinPosition,
  getMapId,
  moveToken,
  moveTokenToMap,
  setTokenVisibility,
  updateTokenContent,
  useLocationMap,
  useMapEdges,
  useMapTokens,
} from '@/hooks/useBattleMap'
import { CHARACTER_STYLE, MONSTER_STYLE, NPC_STYLE } from '@/components/battlemap/presets'
import { MapGrid } from '@/components/battlemap/MapGrid'
import { GmToolbar } from '@/components/battlemap/GmToolbar'
import { SelectedTokenToolbar } from '@/components/battlemap/SelectedTokenToolbar'
import { useUiStore } from '@/store/useUiStore'
import type { Campaign, MapToken } from '@/types/database'

interface MapNavState {
  centerTokenId?: string
}

/** The "zoomed in" view opened by clicking a location pin on the overworld
 * map (or any other panel's link to that location) — its own small tactical
 * map, independent tokens, same GM/player split as the overworld. */
export function LocationMapPage() {
  const { campaign } = useOutletContext<{ campaign: Campaign }>()
  const { campaignId, locationId } = useParams<{ campaignId: string; locationId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const centerTokenId = (routerLocation.state as MapNavState | null)?.centerTokenId ?? null
  const isGm = user?.id === campaign.gmId

  const { data: locations } = useLocations(campaignId)
  const location = locations.find((l) => l.id === locationId)

  const { map, loading: mapLoading } = useLocationMap(campaignId, locationId, location?.name ?? 'Lieu', isGm)
  const { data: tokens } = useMapTokens(map?.id)
  const { data: edges } = useMapEdges(map?.id)
  const { data: npcs } = useNpcs(campaignId)
  const { data: party } = useParty(campaignId)
  const pushToast = useUiStore((s) => s.pushToast)

  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>()

  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(centerTokenId)
  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null

  const myCharacterIds = new Set(party.filter((c) => c.ownerId === user?.id).map((c) => c.id))
  const myTokens = tokens.filter((t) => t.refCharacterId != null && myCharacterIds.has(t.refCharacterId))

  function canDrag(token: MapToken): boolean {
    return isGm || (token.refCharacterId != null && myCharacterIds.has(token.refCharacterId))
  }

  // Bring the character's own token back onto the overworld, at this
  // location's pin, instead of leaving it stranded here once the player
  // has moved on — the same circle that followed them in follows them out.
  //
  // The token-follow side effect is wrapped as a whole: it must never be
  // able to skip the actual navigate() below just because one of its own
  // calls rejected in a way the narrower .catch() further in didn't
  // anticipate (a dropped connection rejecting getMapId/
  // getLocationPinPosition themselves, not just the moveTokenToMap calls)
  // — that would silently strand the click with no navigation and no error
  // shown, which is exactly what "can't get out of the location" looks
  // like from the outside.
  async function handleReturnToWorldMap() {
    try {
      if (!isGm && myTokens.length > 0 && campaignId && locationId) {
        const worldMapId = await getMapId(campaignId, null)
        const pin = worldMapId ? await getLocationPinPosition(worldMapId, locationId) : null
        if (worldMapId && pin) {
          await Promise.all(myTokens.map((t) => moveTokenToMap(t.id, worldMapId, pin.x, pin.y)))
        }
      }
    } catch {
      pushToast("Le pion n'a pas pu revenir sur la carte du monde.", 'error')
    }
    navigate(`/campaign/${campaignId}/map`)
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

  return (
    <div ref={fullscreenRef} className={isFullscreen ? 'overflow-auto bg-ink-950 p-4' : ''}>
      <button
        onClick={handleReturnToWorldMap}
        className="mb-4 inline-block text-sm text-parchment-200/60 hover:text-parchment-100"
      >
        ← Retour à la carte du monde
      </button>

      {!location ? (
        <p className="text-parchment-200/60">Lieu introuvable.</p>
      ) : (
        <>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl text-parchment-100">📍 {location.name}</h2>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs uppercase tracking-wide ${
                  isGm ? 'border-ember-500/50 text-ember-400' : 'border-ink-700 text-parchment-200/50'
                }`}
              >
                {isGm ? 'Vue MJ — éditable' : 'Vue joueur'}
              </span>
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                className="rounded-md border border-ink-700 px-2 py-1 text-xs text-parchment-200/60 hover:border-ember-500/50 hover:text-ember-400"
              >
                {isFullscreen ? '⤢ Quitter' : '⛶ Plein écran'}
              </button>
            </div>
          </div>
          {location.description && <p className="mb-4 text-sm text-parchment-200/60">{location.description}</p>}

          {mapLoading && <div className="p-10 text-parchment-200/60">Chargement de la carte…</div>}

          {!mapLoading && !map && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 py-24 text-center">
              <h3 className="font-display text-lg text-parchment-100">Pas encore de carte détaillée</h3>
              <p className="mt-2 max-w-md text-sm text-parchment-200/60">Le MJ n'a pas encore ouvert ce lieu.</p>
            </div>
          )}

          {map && (
            <>
              {isGm && (
                <GmToolbar
                  npcs={npcs}
                  party={party}
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
                  onAddCharacter={(characterId, name) =>
                    spawnToken({
                      kind: 'character',
                      label: name,
                      icon: CHARACTER_STYLE.icon,
                      color: CHARACTER_STYLE.color,
                      refCharacterId: characterId,
                    })
                  }
                  onAddMonster={() =>
                    spawnToken({ kind: 'monster', label: MONSTER_STYLE.label, icon: MONSTER_STYLE.icon, color: MONSTER_STYLE.color })
                  }
                />
              )}

              <MapGrid
                mapId={map.id}
                terrainText={`${location.name} ${location.description}`}
                gridWidth={map.gridWidth}
                gridHeight={map.gridHeight}
                tokens={tokens}
                edges={edges}
                selectedTokenId={selectedTokenId}
                centerTokenId={centerTokenId}
                expanded={isFullscreen}
                onActivate={(token) => setSelectedTokenId(token.id)}
                onDeselect={() => setSelectedTokenId(null)}
                canDrag={canDrag}
                onDrop={handleDrop}
              />

              {selectedToken && (
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
            </>
          )}
        </>
      )}
    </div>
  )
}
