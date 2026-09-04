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

// Sized to hold the whole campaign's path (several locations spread out), not
// just one room — the grid container scrolls (see MapPage), so this is a
// canvas to lay a journey across, not a single battle's footprint.
const DEFAULT_GRID_WIDTH = 40
const DEFAULT_GRID_HEIGHT = 28

/**
 * A campaign has (for now) a single map, created lazily by the GM the first
 * time they open the tab — RLS only lets the GM insert into battle_maps, so
 * a player visiting first just sees "waiting on the GM" instead of an error.
 */
export function useBattleMap(campaignId: string | undefined, isGm: boolean) {
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
      const { data: existing } = await supabase
        .from('battle_maps')
        .select('*')
        .eq('campaign_id', campaignId as string)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

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
          name: 'Carte principale',
          grid_width: DEFAULT_GRID_WIDTH,
          grid_height: DEFAULT_GRID_HEIGHT,
        })
        .select('*')
        .single()

      if (cancelled) return
      setMap(created ? mapBattleMap(created as BattleMapRow) : null)
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`battle_maps:${campaignId}`)
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
  }, [campaignId, isGm])

  return { map, loading }
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
