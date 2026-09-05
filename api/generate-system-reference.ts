import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { generateForcedFunctionCall } from './_lib/genai.js'
import { systemReferenceSchema, RECORD_SYSTEM_REFERENCE_TOOL, type SystemReference } from './_lib/systemReferenceSchema.js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * One-shot, GM-only, same auth + ownership pattern as the rest of the AI
 * pipeline: generates a class/skill reference for the campaign's system so
 * character creation has real options to pick from instead of a blank
 * text field. Cached in system_reference (upserted here) — the GM can
 * re-run this to regenerate, but nothing calls it automatically.
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
    res.status(403).json({ error: 'Only the GM can generate the system reference for this campaign.' })
    return
  }

  try {
    const systemDescriptor =
      campaign.system === 'Custom / Homebrew' && campaign.description
        ? `Custom / Homebrew — described by the GM as: ${campaign.description}`
        : campaign.system

    const args = await generateForcedFunctionCall({
      systemInstruction:
        'You help a tabletop RPG GM seed character creation for their table. Given only the name (and, for a ' +
        'homebrew setting, a short description) of the system they are playing, invent a class list and a ' +
        'skill list that fits its genre and tone. This must be your own original invention in the spirit of ' +
        'the system — never reproduce actual rulebook text, official class names copied verbatim, class ' +
        'features, stat blocks, or an exact published skill list. If unsure, favor generic archetypes ' +
        '(e.g. "combattant en armure lourde" rather than a trademarked class name) over anything that might ' +
        'be a copy of published material.',
      prompt: `RPG system: ${systemDescriptor}`,
      functionDeclaration: RECORD_SYSTEM_REFERENCE_TOOL,
    })

    const result: SystemReference = systemReferenceSchema.parse(args)

    const { error } = await supabaseAdmin
      .from('system_reference')
      .upsert(
        { campaign_id: campaignId, classes: result.classes, skills: result.skills, generated_at: new Date().toISOString() },
        { onConflict: 'campaign_id' },
      )
    if (error) throw error

    res.status(200).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while generating the system reference.'
    res.status(500).json({ error: `Failed to generate system reference: ${message}` })
  }
}
