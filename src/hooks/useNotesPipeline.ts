import { supabase } from '@/lib/supabase'
import { postToApi } from '@/lib/apiFetch'
import type { SessionNoteKind } from '@/types/database'

interface StructureNotesResponse {
  ok: boolean
  timelineEventsCreated: number
  npcsTouched: number
  locationsTouched: number
  questsTouched: number
  itemChangesApplied: number
}

/**
 * Creates the raw note row, then calls the `/api/structure-gm-notes` Vercel
 * function, which authenticates the caller against Supabase, calls Gemini to
 * turn it into timeline events, NPC/location/quest upserts, and inventory
 * changes, and writes them back with the service-role key — all of it
 * picked up live by every screen subscribed to that campaign.
 */
export async function submitGmNote(params: {
  campaignId: string
  authorId: string
  kind: SessionNoteKind
  rawText: string
}): Promise<StructureNotesResponse> {
  const { data: note, error: insertError } = await supabase
    .from('session_notes')
    .insert({
      campaign_id: params.campaignId,
      author_id: params.authorId,
      kind: params.kind,
      raw_text: params.rawText,
      status: 'pending',
    })
    .select('id')
    .single()
  if (insertError) throw insertError

  return postToApi<StructureNotesResponse>('/api/structure-gm-notes', {
    campaignId: params.campaignId,
    noteId: (note as { id: string }).id,
  })
}
