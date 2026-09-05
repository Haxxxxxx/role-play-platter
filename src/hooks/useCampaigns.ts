import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mapCampaign, type CampaignRow } from '@/lib/mappers'
import type { Profile } from '@/hooks/useProfiles'
import type { Campaign, CampaignStatus, RpgSystem } from '@/types/database'

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

/** GM-only, backed by the "gm updates their campaign" RLS policy. */
export async function updateCampaignStatus(campaignId: string, status: CampaignStatus): Promise<void> {
  const { error } = await supabase.from('campaigns').update({ status }).eq('id', campaignId)
  if (error) throw error
}

export interface CampaignMember {
  userId: string
  role: 'gm' | 'player'
  joinedAt: string
  profile: Profile | null
}

/**
 * The campaign's roster (GM + players), live. There's no FK PostgREST can
 * embed on directly — campaign_members.user_id and profiles.id both point
 * at auth.users independently rather than at each other — so this fetches
 * membership rows and profiles separately and merges them client-side.
 */
export function useCampaignMembers(campaignId: string | undefined) {
  const [members, setMembers] = useState<CampaignMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!campaignId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMembers([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      const { data: memberRows, error } = await supabase
        .from('campaign_members')
        .select('user_id, role, joined_at')
        .eq('campaign_id', campaignId as string)
        .order('joined_at', { ascending: true })
      if (cancelled || error || !memberRows) {
        if (!cancelled) setLoading(false)
        return
      }

      const userIds = memberRows.map((m) => m.user_id as string)
      const { data: profileRows } = userIds.length
        ? await supabase.from('profiles').select('*').in('id', userIds)
        : { data: [] }
      if (cancelled) return

      const profileById = new Map((profileRows ?? []).map((p) => [p.id as string, p]))
      setMembers(
        memberRows.map((m) => {
          const p = profileById.get(m.user_id as string)
          return {
            userId: m.user_id as string,
            role: m.role as 'gm' | 'player',
            joinedAt: m.joined_at as string,
            profile: p
              ? {
                  id: p.id as string,
                  email: p.email as string | null,
                  displayName: p.display_name as string | null,
                  avatarUrl: p.avatar_url as string | null,
                  isAnonymous: p.is_anonymous as boolean,
                }
              : null,
          }
        }),
      )
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`campaign_members:${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_members', filter: `campaign_id=eq.${campaignId}` },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [campaignId])

  return { members, loading }
}

/** Add a known user (already in `profiles`) to a campaign already underway —
 * same "gm invites known users" RLS policy that backs invite-at-creation,
 * just called on demand instead of only at insert time. */
export async function inviteMemberToCampaign(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('campaign_members').insert({ campaign_id: campaignId, user_id: userId, role: 'player' })
  if (error) throw error
}

/** GM-only, backed by the "gm removes members" RLS policy. */
export async function removeCampaignMember(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_members')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
  if (error) throw error
}
