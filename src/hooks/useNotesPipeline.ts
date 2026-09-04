import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import type { SessionNoteKind } from '@/types/firestore'

interface StructureNotesResponse {
  ok: boolean
  timelineEventsCreated: number
  npcsTouched: number
  locationsTouched: number
  questsTouched: number
  itemChangesApplied: number
}

const structureGmNotesCallable = httpsCallable<{ campaignId: string; noteId: string }, StructureNotesResponse>(
  functions,
  'structureGmNotes',
)

/**
 * Creates the raw note doc, then invokes the `structureGmNotes` Cloud Function
 * which calls Claude to turn it into timeline events, NPC/location/quest
 * upserts, and inventory changes — all written back to Firestore, which every
 * subscribed screen (chronicle, party, notes history) picks up live.
 */
export async function submitGmNote(params: {
  campaignId: string
  authorId: string
  kind: SessionNoteKind
  rawText: string
}): Promise<StructureNotesResponse> {
  const noteRef = await addDoc(collection(db, 'campaigns', params.campaignId, 'sessionNotes'), {
    campaignId: params.campaignId,
    authorId: params.authorId,
    kind: params.kind,
    rawText: params.rawText,
    status: 'pending',
    narrativeRecap: null,
    errorMessage: null,
    processedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const result = await structureGmNotesCallable({ campaignId: params.campaignId, noteId: noteRef.id })
  return result.data
}
