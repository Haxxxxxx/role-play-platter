import { postToApi } from '@/lib/apiFetch'

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
  const body = await postToApi<{ recommendations: Recommendation[] }>('/api/gm-recommendations', { campaignId })
  return body.recommendations
}
