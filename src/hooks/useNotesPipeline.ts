import { supabase } from '@/lib/supabase'
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
 * function, which authenticates the caller against Supabase, calls Claude to
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

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in.')

  const response = await fetch('/api/structure-gm-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ campaignId: params.campaignId, noteId: (note as { id: string }).id }),
  })

  const body = (await response.json()) as StructureNotesResponse | { error: string }
  if (!response.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : 'Failed to process note.')
  }
  return body
}
