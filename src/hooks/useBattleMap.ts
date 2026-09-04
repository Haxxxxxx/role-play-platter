import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mapBattleMap, mapMapToken, type BattleMapRow, type MapTokenRow } from '@/lib/mappers'
import { useSupabaseCollection } from '@/hooks/useSupabaseCollection'
import type { BattleMap, MapToken, MapTokenKind } from '@/types/database'

const DEFAULT_GRID_WIDTH = 16
const DEFAULT_GRID_HEIGHT = 12

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
}): Promise<void> {
  const { error } = await supabase.from('map_tokens').insert({
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
  })
  if (error) throw error
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
