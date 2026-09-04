import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { recommendationsSchema, RECORD_RECOMMENDATIONS_TOOL, type Recommendations } from './_lib/recommendationsSchema.js'

const CLAUDE_MODEL = 'claude-sonnet-5'

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * Pushed recommendations, not a chat: one call, one fresh read of the
 * campaign's current state, one short list back. GM-only, same auth +
 * ownership pattern as structure-gm-notes — this is prep tooling, not
 * something a player triggers.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }

  const authHeader = req.headers.authorization
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken)
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid or expired session.' })
    return
  }

  const { campaignId } = (req.body ?? {}) as { campaignId?: string }
  if (!campaignId) {
    res.status(400).json({ error: 'campaignId is required.' })
    return
  }

  const { data: campaign } = await supabaseAdmin.from('campaigns').select('*').eq('id', campaignId).single()
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found.' })
    return
  }
  if (campaign.gm_id !== user.id) {
    res.status(403).json({ error: 'Only the GM can request recommendations for this campaign.' })
    return
  }

  try {
    const [{ data: timelineRows }, { data: questRows }, { data: npcRows }, { data: partyRows }] = await Promise.all([
      supabaseAdmin
        .from('timeline_events')
        .select('title, description')
        .eq('campaign_id', campaignId)
        .order('order', { ascending: false })
        .limit(10),
      supabaseAdmin.from('quests').select('title, description, status').eq('campaign_id', campaignId),
      supabaseAdmin.from('npcs').select('name, description, disposition').eq('campaign_id', campaignId),
      supabaseAdmin.from('characters').select('name, class_and_level, hp_current, hp_max').eq('campaign_id', campaignId),
    ])

    const recentTimeline = (timelineRows ?? []).reverse() // chronological for the prompt
    const quests = questRows ?? []
    const npcs = npcRows ?? []
    const party = partyRows ?? []

    const contextBlock = [
      `Campaign: ${campaign.name} (${campaign.system})`,
      `Recent events (oldest to newest):\n${recentTimeline.map((e) => `- ${e.title}: ${e.description}`).join('\n') || '(none yet)'}`,
      `Quests:\n${quests.map((q) => `- ${q.title} [${q.status}]: ${q.description}`).join('\n') || '(none yet)'}`,
      `NPCs:\n${npcs.map((n) => `- ${n.name} (${n.disposition}): ${n.description}`).join('\n') || '(none yet)'}`,
      `Party:\n${party.map((c) => `- ${c.name}, ${c.class_and_level}, HP ${c.hp_current}/${c.hp_max}`).join('\n') || '(none yet)'}`,
    ].join('\n\n')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1536,
      system:
        'You advise a tabletop RPG GM between sessions. Read the campaign state given and produce concrete, ' +
        'specific recommendations — reference actual named NPCs/quests/locations, never generic advice like ' +
        '"introduce a twist". If a quest has stalled, say so and suggest a concrete complication. If an NPC ' +
        "hasn't appeared recently, suggest a specific reason for them to reappear.",
      messages: [{ role: 'user', content: `Campaign state:\n\n${contextBlock}` }],
      tools: [RECORD_RECOMMENDATIONS_TOOL],
      tool_choice: { type: 'tool', name: 'record_recommendations' },
    })

    const toolUse = message.content.find((block) => block.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Claude did not return recommendations.')
    }

    const result: Recommendations = recommendationsSchema.parse(toolUse.input)
    res.status(200).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while generating recommendations.'
    res.status(500).json({ error: `Failed to generate recommendations: ${message}` })
  }
}
