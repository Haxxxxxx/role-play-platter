import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  mapBattleMap,
  mapMapEdge,
  mapMapToken,
  type BattleMapRow,
  type MapEdgeRow,
  type MapTokenRow,
} from '@/lib/mappers'
import { useSupabaseCollection } from '@/hooks/useSupabaseCollection'
import type { BattleMap, MapEdge, MapToken, MapTokenKind } from '@/types/database'

// The overworld holds the whole campaign's path (several locations spread
// out) — the grid scrolls (see MapGrid), so it's a canvas for a journey, not
// one room. A location's own detail map is tactical-room scale instead.
const OVERWORLD_GRID = { width: 40, height: 28 }
// Big enough for players to actually drag their token around a room, not
// just look at it — was shrunk to 14x10 to fix a sparse-content look, but
// that traded away the thing the map is actually for. 24x16 fits inside the
// page's own max-w-5xl content column without horizontal scroll on a normal
// desktop, while still leaving real room to move.
const LOCATION_GRID = { width: 24, height: 16 }

/**
 * Gets or lazily creates the one battle_maps row for either the campaign's
 * overworld (locationId null) or one specific location's detail map
 * (locationId set) — same shape, same lazy-create-by-GM behavior either way.
 * RLS only lets the GM insert into battle_maps, so a player visiting first
 * just sees "waiting on the GM" instead of an error.
 */
function useMapFor(params: {
  campaignId: string | undefined
  locationId: string | null
  isGm: boolean
  name: string
  gridWidth: number
  gridHeight: number
}) {
  const { campaignId, locationId, isGm, name, gridWidth, gridHeight } = params
  const [map, setMap] = useState<BattleMap | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!campaignId) {
      // Resetting to the disabled state, not reacting to an external event.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMap(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      let query = supabase.from('battle_maps').select('*').eq('campaign_id', campaignId as string)
      query = locationId ? query.eq('location_id', locationId) : query.is('location_id', null)
      const { data: existing } = await query.order('created_at', { ascending: true }).limit(1).maybeSingle()

      if (cancelled) return

      if (existing) {
        setMap(mapBattleMap(existing as BattleMapRow))
        setLoading(false)
        return
      }

      if (!isGm) {
        setMap(null)
        setLoading(false)
        return
      }

      const { data: created } = await supabase
        .from('battle_maps')
        .insert({
          campaign_id: campaignId,
          location_id: locationId,
          name,
          grid_width: gridWidth,
          grid_height: gridHeight,
        })
        .select('*')
        .single()

      if (cancelled) return
      setMap(created ? mapBattleMap(created as BattleMapRow) : null)
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`battle_maps:${campaignId}:${locationId ?? 'overworld'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'battle_maps', filter: `campaign_id=eq.${campaignId}` },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, locationId, isGm])

  return { map, loading }
}

export function useBattleMap(campaignId: string | undefined, isGm: boolean) {
  return useMapFor({
    campaignId,
    locationId: null,
    isGm,
    name: 'Carte du monde',
    gridWidth: OVERWORLD_GRID.width,
    gridHeight: OVERWORLD_GRID.height,
  })
}

export function useLocationMap(
  campaignId: string | undefined,
  locationId: string | undefined,
  locationName: string,
  isGm: boolean,
) {
  return useMapFor({
    // Piggyback on useMapFor's "no campaignId -> disabled" guard until the
    // route param is actually available, so this never briefly queries the
    // overworld map (locationId: null) instead.
    campaignId: locationId ? campaignId : undefined,
    locationId: locationId ?? null,
    isGm,
    name: locationName,
    gridWidth: LOCATION_GRID.width,
    gridHeight: LOCATION_GRID.height,
  })
}

export function useMapTokens(mapId: string | undefined) {
  return useSupabaseCollection<MapTokenRow, MapToken>({
    table: 'map_tokens',
    filterColumn: 'map_id',
    filterValue: mapId,
    orderBy: { column: 'created_at', ascending: true },
    mapRow: mapMapToken,
  })
}

export async function createToken(params: {
  campaignId: string
  mapId: string
  kind: MapTokenKind
  label: string
  icon: string
  color: string
  x: number
  y: number
  refNpcId?: string | null
  refCharacterId?: string | null
  refLocationId?: string | null
}): Promise<string> {
  const { data, error } = await supabase
    .from('map_tokens')
    .insert({
      campaign_id: params.campaignId,
      map_id: params.mapId,
      kind: params.kind,
      label: params.label,
      icon: params.icon,
      color: params.color,
      x: params.x,
      y: params.y,
      ref_npc_id: params.refNpcId ?? null,
      ref_character_id: params.refCharacterId ?? null,
      ref_location_id: params.refLocationId ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function moveToken(tokenId: string, x: number, y: number): Promise<void> {
  const { error } = await supabase.from('map_tokens').update({ x, y }).eq('id', tokenId)
  if (error) throw error
}

/** Center of a location's own detail map — where a travelling character's
 * token lands, since there's no meaningful "entrance" to place it at. */
export const LOCATION_MAP_ENTRY = { x: Math.floor(LOCATION_GRID.width / 2), y: Math.floor(LOCATION_GRID.height / 2) }

/** The one battle_maps row for a campaign's overworld (locationId null) or a
 * specific location — null if the GM hasn't opened it yet (players can't
 * create one themselves, so this is how a caller checks before trying to
 * move a token onto it). */
export async function getMapId(campaignId: string, locationId: string | null): Promise<string | null> {
  let query = supabase.from('battle_maps').select('id').eq('campaign_id', campaignId)
  query = locationId ? query.eq('location_id', locationId) : query.is('location_id', null)
  const { data } = await query.maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/** Where a location's own pin sits on the overworld map — so a character
 * leaving that location can be placed back at the right spot instead of the
 * map's origin corner. */
export async function getLocationPinPosition(
  worldMapId: string,
  locationId: string,
): Promise<{ x: number; y: number } | null> {
  const { data } = await supabase
    .from('map_tokens')
    .select('x, y')
    .eq('map_id', worldMapId)
    .eq('kind', 'location')
    .eq('ref_location_id', locationId)
    .maybeSingle()
  return data as { x: number; y: number } | null
}

/** Moves a token onto a different map entirely — how a character's own
 * token follows them between the overworld and a location's detail map,
 * rather than a second token appearing on each and the two drifting out of
 * sync. Same "player moves own character token" RLS policy as moveToken
 * (it's a row-level check, not column-scoped, so map_id is fair game too). */
export async function moveTokenToMap(tokenId: string, mapId: string, x: number, y: number): Promise<void> {
  const { error } = await supabase.from('map_tokens').update({ map_id: mapId, x, y }).eq('id', tokenId)
  if (error) throw error
}

export async function deleteToken(tokenId: string): Promise<void> {
  const { error } = await supabase.from('map_tokens').delete().eq('id', tokenId)
  if (error) throw error
}

export async function setTokenVisibility(tokenId: string, visibleToPlayers: boolean): Promise<void> {
  const { error } = await supabase.from('map_tokens').update({ visible_to_players: visibleToPlayers }).eq('id', tokenId)
  if (error) throw error
}

export function useMapEdges(mapId: string | undefined) {
  return useSupabaseCollection<MapEdgeRow, MapEdge>({
    table: 'map_edges',
    filterColumn: 'map_id',
    filterValue: mapId,
    mapRow: mapMapEdge,
  })
}

export async function createEdge(params: {
  campaignId: string
  mapId: string
  fromTokenId: string
  toTokenId: string
}): Promise<void> {
  if (params.fromTokenId === params.toTokenId) return
  // Undirected in practice — store one row per pair regardless of click
  // order, so re-connecting the same two tokens toggles the edge off.
  const { data: existing } = await supabase
    .from('map_edges')
    .select('id')
    .eq('map_id', params.mapId)
    .or(
      `and(from_token_id.eq.${params.fromTokenId},to_token_id.eq.${params.toTokenId}),` +
        `and(from_token_id.eq.${params.toTokenId},to_token_id.eq.${params.fromTokenId})`,
    )
    .maybeSingle()

  if (existing) {
    await supabase.from('map_edges').delete().eq('id', existing.id)
    return
  }

  const { error } = await supabase.from('map_edges').insert({
    campaign_id: params.campaignId,
    map_id: params.mapId,
    from_token_id: params.fromTokenId,
    to_token_id: params.toTokenId,
  })
  if (error) throw error
}

export interface TokenLocationResult {
  tokenId: string
  /** null -> the token lives on the overworld map. */
  locationId: string | null
}

/**
 * Finds where on the map (which map, and which token) an NPC or character
 * actually is, so other panels (chronicle, party) can jump straight there —
 * "open the map centered on the thing I just clicked" needs to know which
 * of potentially many maps (overworld + every location) actually has a pin
 * for it. Returns null if nothing has been placed for it yet.
 */
export async function findTokenLocation(
  params: { campaignId: string } & ({ refNpcId: string } | { refCharacterId: string }),
): Promise<TokenLocationResult | null> {
  let query = supabase
    .from('map_tokens')
    .select('id, battle_maps!inner(location_id)')
    .eq('campaign_id', params.campaignId)
    .limit(1)
  query = 'refNpcId' in params ? query.eq('ref_npc_id', params.refNpcId) : query.eq('ref_character_id', params.refCharacterId)

  const { data } = await query.maybeSingle()
  if (!data) return null
  const row = data as unknown as { id: string; battle_maps: { location_id: string | null } }
  return { tokenId: row.id, locationId: row.battle_maps.location_id }
}
