import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { generateForcedFunctionCall } from './_lib/genai.js'
import { sceneSchema, RECORD_SCENE_TOOL, type GeneratedScene } from './_lib/sceneSchema.js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * GM-only. Takes a one-line premise, gives Gemini the campaign's world
 * (system + known NPCs/locations/quests) so a drafted scene fits what
 * already exists, then inserts it as the next scene. Same forced-function
 * -call pattern as the rest of the pipeline; the row is picked up live by
 * the Scénario tab.
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

  const { campaignId, premise } = (req.body ?? {}) as { campaignId?: string; premise?: string }
  if (!campaignId || !premise || !premise.trim()) {
    res.status(400).json({ error: 'campaignId and a non-empty premise are required.' })
    return
  }

  const { data: campaign } = await supabaseAdmin.from('campaigns').select('*').eq('id', campaignId).single()
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found.' })
    return
  }
  if (campaign.gm_id !== user.id) {
    res.status(403).json({ error: 'Only the GM can draft scenes for this campaign.' })
    return
  }

  try {
    const [{ data: npcRows }, { data: locationRows }, { data: questRows }, { data: sceneRows }] = await Promise.all([
      supabaseAdmin.from('npcs').select('name, disposition').eq('campaign_id', campaignId),
      supabaseAdmin.from('locations').select('name').eq('campaign_id', campaignId),
      supabaseAdmin.from('quests').select('title, status').eq('campaign_id', campaignId),
      supabaseAdmin.from('scenes').select('order').eq('campaign_id', campaignId),
    ])

    const contextBlock = [
      `Campaign: ${campaign.name} (${campaign.system})`,
      `Known NPCs: ${(npcRows ?? []).map((n) => `${n.name} [${n.disposition}]`).join(', ') || '(none yet)'}`,
      `Known locations: ${(locationRows ?? []).map((l) => l.name).join(', ') || '(none yet)'}`,
      `Ongoing quests: ${(questRows ?? []).map((q) => `${q.title} [${q.status}]`).join(', ') || '(none yet)'}`,
    ].join('\n')

    const args = await generateForcedFunctionCall({
      systemInstruction:
        'You draft one scene of a tabletop RPG scenario for a GM to prep from. Concrete and runnable, in ' +
        'the genre and tone of the system. Original — never reproduce a published adventure or copyrighted ' +
        'text. When the premise names an NPC or place the campaign already knows, reuse that exact name.',
      prompt: `Campaign context:\n${contextBlock}\n\nGM's premise for this scene:\n${premise.trim()}`,
      functionDeclaration: RECORD_SCENE_TOOL,
    })

    const scene: GeneratedScene = sceneSchema.parse(args)

    const nextOrder = Math.max(0, ...(sceneRows ?? []).map((s) => s.order as number)) + 1
    const { data: inserted, error } = await supabaseAdmin
      .from('scenes')
      .insert({
        campaign_id: campaignId,
        title: scene.title,
        order: nextOrder,
        read_aloud: scene.readAloud,
        gm_notes: scene.gmNotes,
        encounter: scene.encounter ?? '',
      })
      .select('id')
      .single()
    if (error) throw error

    res.status(200).json({ id: (inserted as { id: string }).id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while drafting the scene.'
    res.status(500).json({ error: `Failed to draft scene: ${message}` })
  }
}
