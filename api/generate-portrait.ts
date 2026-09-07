import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { generateImage } from './_lib/genai.js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * Single call to the (billing-only) image model, with a prompt built
 * straight from the campaign's system + the character's fields. An earlier
 * version had the free text model write an "evocative brief" first, but on
 * the free tier that step alone queued ~60s before the request even
 * reached the image model — long enough to read as frozen, and pure waste
 * when the image call was about to 402 for lack of billing anyway. A plain
 * templated prompt covers "fits the game's world" well enough and fails
 * fast. The result is uploaded to the same `portraits` bucket a manual upload
 * uses. Auth: whoever can already edit the character (its owner or the
 * campaign's GM) — the same rule the storage RLS enforces, checked here
 * because this route writes with the service-role key.
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

  const { characterId } = (req.body ?? {}) as { characterId?: string }
  if (!characterId) {
    res.status(400).json({ error: 'characterId is required.' })
    return
  }

  const { data: character } = await supabaseAdmin.from('characters').select('*').eq('id', characterId).single()
  if (!character) {
    res.status(404).json({ error: 'Character not found.' })
    return
  }

  const { data: campaign } = await supabaseAdmin.from('campaigns').select('*').eq('id', character.campaign_id).single()
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found.' })
    return
  }

  const isOwner = character.owner_id === user.id
  const isGm = campaign.gm_id === user.id
  if (!isOwner && !isGm) {
    res.status(403).json({ error: 'Only the character owner or the GM can generate a portrait.' })
    return
  }

  try {
    const setting =
      campaign.system === 'Custom / Homebrew' && campaign.description
        ? campaign.description
        : `a ${campaign.system} tabletop RPG`
    const descriptors = [character.class_and_level, character.race].filter(Boolean).join(', ')

    const prompt =
      `Original character portrait for ${setting}. ` +
      `${character.name}${descriptors ? `, ${descriptors}` : ''}. ` +
      `Chest-up portrait, painterly fantasy illustration, dramatic lighting, plain muted background. ` +
      `In the genre and tone of that system, but do not depict any copyrighted character, named IP, ` +
      `or real person. No text, no watermark, no border.`

    const { bytes, mimeType } = await generateImage(prompt)

    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const path = `${characterId}/${randomUUID()}.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('portraits')
      .upload(path, bytes, { contentType: mimeType })
    if (uploadError) throw uploadError

    const { data: pub } = supabaseAdmin.storage.from('portraits').getPublicUrl(path)
    const { error: updateError } = await supabaseAdmin
      .from('characters')
      .update({ portrait_url: pub.publicUrl })
      .eq('id', characterId)
    if (updateError) throw updateError

    res.status(200).json({ portraitUrl: pub.publicUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while generating the portrait.'
    // The image model is billing-only; make that specific case legible
    // instead of surfacing a raw 429.
    if (/quota|RESOURCE_EXHAUSTED|billing|limit: 0/i.test(message)) {
      res.status(402).json({
        error:
          "La génération d'images nécessite d'activer la facturation sur le projet Google Cloud (le niveau gratuit ne l'inclut pas).",
      })
      return
    }
    res.status(500).json({ error: `Failed to generate portrait: ${message}` })
  }
}
