import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mapCampaign, type CampaignRow } from '@/lib/mappers'
import type { Campaign, RpgSystem } from '@/types/database'

/** Campaigns where the current user is GM or a player. No explicit filter is
 * needed — the "members can read their campaigns" RLS policy already scopes
 * every select (and, with Realtime respecting RLS, every change event) to
 * rows the signed-in user belongs to. */
export function useCampaigns(uid: string | null) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCampaigns([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (!error && data) setCampaigns((data as CampaignRow[]).map(mapCampaign))
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('campaigns:mine')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => load())
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [uid])

  return { campaigns, loading }
}

export function useCampaign(campaignId: string | undefined) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!campaignId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCampaign(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      const { data, error } = await supabase.from('campaigns').select('*').eq('id', campaignId as string).single()
      if (cancelled) return
      setCampaign(!error && data ? mapCampaign(data as CampaignRow) : null)
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`campaigns:${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [campaignId])

  return { campaign, loading }
}

export async function createCampaign(params: {
  name: string
  system: RpgSystem
  description: string
  gmId: string
  /** Known users (already in `profiles`) to add as players right away —
   * on_campaign_created already enrolls the GM, this just adds everyone
   * else. Best-effort: a failed invite doesn't roll back the campaign. */
  inviteUserIds?: string[]
}): Promise<string> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({ name: params.name, system: params.system, description: params.description, gm_id: params.gmId })
    .select('id')
    .single()
  if (error) throw error
  const campaignId = (data as { id: string }).id

  if (params.inviteUserIds && params.inviteUserIds.length > 0) {
    await supabase.from('campaign_members').insert(
      params.inviteUserIds.map((userId) => ({ campaign_id: campaignId, user_id: userId, role: 'player' })),
    )
  }

  return campaignId
}
