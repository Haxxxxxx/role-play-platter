import { useMemo } from 'react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import type { Campaign, RpgSystem } from '@/types/firestore'

function mapCampaign(snap: QueryDocumentSnapshot<DocumentData>): Campaign {
  return { id: snap.id, ...snap.data() } as Campaign
}

/** Campaigns where the current user is GM or a player. */
export function useCampaigns(uid: string | null) {
  const [data, setData] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const q = useMemo(
    () => (uid ? query(collection(db, 'campaigns'), where('memberIds', 'array-contains', uid)) : null),
    [uid],
  )

  useEffect(() => {
    if (!q) {
      // Resetting to the disabled (signed-out) state, not reacting to an external event.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    return onSnapshot(q, (snap) => {
      setData(snap.docs.map(mapCampaign))
      setLoading(false)
    })
  }, [q])

  return { campaigns: data, loading }
}

export function useCampaign(campaignId: string | undefined) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!campaignId) {
      // Resetting to the disabled state, not reacting to an external event.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCampaign(null)
      setLoading(false)
      return
    }
    setLoading(true)
    return onSnapshot(doc(db, 'campaigns', campaignId), (snap) => {
      setCampaign(snap.exists() ? ({ id: snap.id, ...snap.data() } as Campaign) : null)
      setLoading(false)
    })
  }, [campaignId])

  return { campaign, loading }
}

export async function createCampaign(params: {
  name: string
  system: RpgSystem
  description: string
  gmId: string
}): Promise<string> {
  const ref = await addDoc(collection(db, 'campaigns'), {
    name: params.name,
    system: params.system,
    description: params.description,
    gmId: params.gmId,
    memberIds: [params.gmId],
    isProcessingNotes: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}
