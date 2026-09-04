import { supabase } from '@/lib/supabase'

export type RecommendationCategory = 'quest' | 'npc' | 'pacing' | 'worldbuilding' | 'combat'

export interface Recommendation {
  category: RecommendationCategory
  title: string
  detail: string
}

/**
 * One-shot, stateless: every call re-reads the campaign's current state and
 * returns a fresh batch. Nothing is persisted — this is a pushed suggestion
 * list, not a conversation, so there's no history to keep in sync.
 */
export async function fetchGmRecommendations(campaignId: string): Promise<Recommendation[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in.')

  const response = await fetch('/api/gm-recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ campaignId }),
  })

  const body = (await response.json()) as { recommendations: Recommendation[] } | { error: string }
  if (!response.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : 'Failed to generate recommendations.')
  }
  return body.recommendations
}
