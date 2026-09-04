import { useMemo } from 'react'
import { collection, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useCollection } from '@/hooks/useCollection'
import type { Location, Npc, Quest, SessionNote, TimelineEvent } from '@/types/firestore'

/** Real-time chronicle collections, all scoped to one campaign and kept in sync
 * across every connected GM/player screen — this is the "party history" view. */

export function useTimeline(campaignId: string | undefined) {
  const q = useMemo(
    () =>
      campaignId
        ? query(collection(db, 'campaigns', campaignId, 'timeline'), orderBy('order', 'asc'))
        : null,
    [campaignId],
  )
  return useCollection<TimelineEvent>(q, (snap) => ({ id: snap.id, ...snap.data() }) as TimelineEvent)
}

export function useNpcs(campaignId: string | undefined) {
  const q = useMemo(
    () => (campaignId ? query(collection(db, 'campaigns', campaignId, 'npcs'), orderBy('name', 'asc')) : null),
    [campaignId],
  )
  return useCollection<Npc>(q, (snap) => ({ id: snap.id, ...snap.data() }) as Npc)
}

export function useLocations(campaignId: string | undefined) {
  const q = useMemo(
    () =>
      campaignId ? query(collection(db, 'campaigns', campaignId, 'locations'), orderBy('name', 'asc')) : null,
    [campaignId],
  )
  return useCollection<Location>(q, (snap) => ({ id: snap.id, ...snap.data() }) as Location)
}

export function useQuests(campaignId: string | undefined) {
  const q = useMemo(
    () =>
      campaignId
        ? query(collection(db, 'campaigns', campaignId, 'quests'), orderBy('createdAt', 'desc'))
        : null,
    [campaignId],
  )
  return useCollection<Quest>(q, (snap) => ({ id: snap.id, ...snap.data() }) as Quest)
}

export function useSessionNotes(campaignId: string | undefined) {
  const q = useMemo(
    () =>
      campaignId
        ? query(collection(db, 'campaigns', campaignId, 'sessionNotes'), orderBy('createdAt', 'desc'))
        : null,
    [campaignId],
  )
  return useCollection<SessionNote>(q, (snap) => ({ id: snap.id, ...snap.data() }) as SessionNote)
}

export function useActiveQuests(campaignId: string | undefined) {
  const q = useMemo(
    () =>
      campaignId
        ? query(
            collection(db, 'campaigns', campaignId, 'quests'),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc'),
          )
        : null,
    [campaignId],
  )
  return useCollection<Quest>(q, (snap) => ({ id: snap.id, ...snap.data() }) as Quest)
}
