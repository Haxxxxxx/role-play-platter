import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { campaignUpdateSchema, RECORD_CAMPAIGN_UPDATE_TOOL, type CampaignUpdate } from './_lib/schema.js'
import { applyCampaignUpdate } from './_lib/writeback.js'

// Text-only structuring/narration model. Anthropic has no image-gen endpoint —
// NPC portraits will need a separate provider wired in later.
const CLAUDE_MODEL = 'claude-sonnet-5'

// Service-role client: bypasses Row Level Security. This key must only ever
// live in Vercel's server-side environment variables — never VITE_-prefixed,
// never shipped to the client.
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * The heart of the AI pipeline: takes a raw GM/player note, gives Claude the
 * campaign's existing NPCs/locations/quests/party for continuity, forces a
 * structured tool call back, validates it, and writes the result into
 * Postgres. Every screen watching that campaign (chronicle, party, notes
 * history) updates live off the write via Supabase Realtime.
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

  const { campaignId, noteId } = (req.body ?? {}) as { campaignId?: string; noteId?: string }
  if (!campaignId || !noteId) {
    res.status(400).json({ error: 'campaignId and noteId are required.' })
    return
  }

  // Authorization check — the service-role client bypasses RLS, so this
  // function must do its own membership check, the same way an on-chain
  // program never trusts a passed-in account without validating it.
  const { data: membership } = await supabaseAdmin
    .from('campaign_members')
    .select('user_id')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this campaign.' })
    return
  }

  const [{ data: campaign }, { data: note }] = await Promise.all([
    supabaseAdmin.from('campaigns').select('*').eq('id', campaignId).single(),
    supabaseAdmin.from('session_notes').select('*').eq('id', noteId).single(),
  ])
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found.' })
    return
  }
  if (!note || note.campaign_id !== campaignId) {
    res.status(404).json({ error: 'Note not found in this campaign.' })
    return
  }
  if (note.status === 'processing' || note.status === 'processed') {
    res.status(409).json({ error: `Note is already ${note.status}.` })
    return
  }

  await supabaseAdmin.from('session_notes').update({ status: 'processing' }).eq('id', noteId)
  await supabaseAdmin.from('campaigns').update({ is_processing_notes: true }).eq('id', campaignId)

  try {
    const [{ data: npcRows }, { data: locationRows }, { data: questRows }, { data: partyRows }] = await Promise.all([
      supabaseAdmin.from('npcs').select('id, name').eq('campaign_id', campaignId),
      supabaseAdmin.from('locations').select('id, name').eq('campaign_id', campaignId),
      supabaseAdmin.from('quests').select('id, title, status').eq('campaign_id', campaignId),
      supabaseAdmin.from('characters').select('id, name').eq('campaign_id', campaignId),
    ])

    const existingNpcs = npcRows ?? []
    const existingLocations = locationRows ?? []
    const existingQuests = questRows ?? []
    const partyRoster = partyRows ?? []

    const contextBlock = [
      `Campaign system: ${campaign.system}`,
      `Party roster: ${partyRoster.map((p) => p.name).join(', ') || '(none yet)'}`,
      `Known NPCs: ${existingNpcs.map((n) => n.name).join(', ') || '(none yet)'}`,
      `Known locations: ${existingLocations.map((l) => l.name).join(', ') || '(none yet)'}`,
      `Ongoing quests: ${existingQuests.map((q) => `${q.title} [${q.status}]`).join(', ') || '(none yet)'}`,
    ].join('\n')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system:
        'You are the archivist for a tabletop RPG campaign. When the note refers to something already ' +
        'known (case-insensitive name match), reuse that exact name instead of creating a near-duplicate ' +
        'entry. Only record item changes for characters already in the party roster given in context — ' +
        'never invent a new party member from a note.',
      messages: [
        {
          role: 'user',
          content: `Campaign context:\n${contextBlock}\n\nSession note (kind: ${note.kind}):\n${note.raw_text}`,
        },
      ],
      tools: [RECORD_CAMPAIGN_UPDATE_TOOL],
      tool_choice: { type: 'tool', name: 'record_campaign_update' },
    })

    const toolUse = message.content.find((block) => block.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Claude did not return a structured update.')
    }

    const update: CampaignUpdate = campaignUpdateSchema.parse(toolUse.input)

    const result = await applyCampaignUpdate({
      supabase: supabaseAdmin,
      campaignId,
      noteId,
      update,
      existingNpcs,
      existingLocations,
      existingQuests,
      partyRoster,
    })

    await supabaseAdmin
      .from('session_notes')
      .update({
        status: 'processed',
        narrative_recap: update.narrativeRecap,
        error_message: null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', noteId)

    res.status(200).json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while processing note.'
    await supabaseAdmin.from('session_notes').update({ status: 'error', error_message: message }).eq('id', noteId)
    res.status(500).json({ error: `Failed to process note: ${message}` })
  } finally {
    await supabaseAdmin.from('campaigns').update({ is_processing_notes: false }).eq('id', campaignId)
  }
}
