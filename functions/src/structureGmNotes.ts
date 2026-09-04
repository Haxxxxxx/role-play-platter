import Anthropic from '@anthropic-ai/sdk'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { campaignUpdateSchema, RECORD_CAMPAIGN_UPDATE_TOOL, type CampaignUpdate } from './schema.js'
import { applyCampaignUpdate, type ApplyUpdateResult } from './writeback.js'

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY')

// Text-only structuring/narration model. Anthropic has no image-gen endpoint —
// NPC portraits will need a separate provider wired in later.
const CLAUDE_MODEL = 'claude-sonnet-5'

interface RequestData {
  campaignId: string
  noteId: string
}

type ResponseData = { ok: true } & ApplyUpdateResult

/**
 * The heart of the AI pipeline: takes a raw GM/player note, gives Claude the
 * campaign's existing NPCs/locations/quests/party for continuity, forces a
 * structured tool call back, validates it, and writes the result into
 * Firestore. Every screen watching that campaign (chronicle, party, notes
 * history) updates live off the write — this function never talks to the
 * client except to report counts.
 */
export const structureGmNotes = onCall<RequestData, Promise<ResponseData>>(
  { secrets: [anthropicApiKey], region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.')

    const { campaignId, noteId } = request.data ?? {}
    if (typeof campaignId !== 'string' || !campaignId || typeof noteId !== 'string' || !noteId) {
      throw new HttpsError('invalid-argument', 'campaignId and noteId are required.')
    }

    const db = getFirestore()
    const campaignRef = db.collection('campaigns').doc(campaignId)
    const noteRef = campaignRef.collection('sessionNotes').doc(noteId)

    const [campaignSnap, noteSnap] = await Promise.all([campaignRef.get(), noteRef.get()])
    const campaign = campaignSnap.data()
    const note = noteSnap.data()

    if (!campaign) throw new HttpsError('not-found', 'Campaign not found.')
    // Authorization check — never trust that a valid campaignId means the
    // caller belongs to it, the same way an on-chain program never trusts a
    // passed-in account without validating it.
    if (!Array.isArray(campaign.memberIds) || !campaign.memberIds.includes(uid)) {
      throw new HttpsError('permission-denied', 'Not a member of this campaign.')
    }
    if (!note) throw new HttpsError('not-found', 'Note not found.')
    if (note.campaignId !== campaignId) {
      throw new HttpsError('invalid-argument', 'Note does not belong to this campaign.')
    }
    if (note.status === 'processing' || note.status === 'processed') {
      throw new HttpsError('failed-precondition', `Note is already ${note.status}.`)
    }

    await noteRef.update({ status: 'processing', updatedAt: FieldValue.serverTimestamp() })
    await campaignRef.update({ isProcessingNotes: true })

    try {
      const [npcsSnap, locationsSnap, questsSnap, partySnap] = await Promise.all([
        campaignRef.collection('npcs').get(),
        campaignRef.collection('locations').get(),
        campaignRef.collection('quests').get(),
        campaignRef.collection('party').get(),
      ])

      const existingNpcs = npcsSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string }))
      const existingLocations = locationsSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string }))
      const existingQuests = questsSnap.docs.map((d) => ({
        id: d.id,
        title: d.data().title as string,
        status: d.data().status as string,
      }))
      const partyRoster = partySnap.docs.map((d) => ({ id: d.id, name: d.data().name as string }))

      const contextBlock = [
        `Campaign system: ${campaign.system}`,
        `Party roster: ${partyRoster.map((p) => p.name).join(', ') || '(none yet)'}`,
        `Known NPCs: ${existingNpcs.map((n) => n.name).join(', ') || '(none yet)'}`,
        `Known locations: ${existingLocations.map((l) => l.name).join(', ') || '(none yet)'}`,
        `Ongoing quests: ${existingQuests.map((q) => `${q.title} [${q.status}]`).join(', ') || '(none yet)'}`,
      ].join('\n')

      const anthropic = new Anthropic({ apiKey: anthropicApiKey.value() })

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
            content: `Campaign context:\n${contextBlock}\n\nSession note (kind: ${note.kind}):\n${note.rawText}`,
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
        db,
        campaignRef,
        noteId,
        update,
        existingNpcs,
        existingLocations,
        existingQuests,
        partyRoster,
      })

      await noteRef.update({
        status: 'processed',
        narrativeRecap: update.narrativeRecap,
        errorMessage: null,
        processedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      return { ok: true, ...result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error while processing note.'
      await noteRef.update({ status: 'error', errorMessage: message, updatedAt: FieldValue.serverTimestamp() })
      throw new HttpsError('internal', `Failed to process note: ${message}`)
    } finally {
      await campaignRef.update({ isProcessingNotes: false })
    }
  },
)
