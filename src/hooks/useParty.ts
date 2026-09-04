import { useMemo } from 'react'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useCollection } from '@/hooks/useCollection'
import type { AbilityScores, Character, InventoryItem } from '@/types/firestore'

export function useParty(campaignId: string | undefined) {
  const q = useMemo(
    () =>
      campaignId ? query(collection(db, 'campaigns', campaignId, 'party'), orderBy('name', 'asc')) : null,
    [campaignId],
  )
  return useCollection<Character>(q, (snap) => ({ id: snap.id, ...snap.data() }) as Character)
}

const BLANK_ABILITY_SCORES: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

export async function createCharacter(params: {
  campaignId: string
  name: string
  playerName: string
  ownerId: string | null
  classAndLevel: string
  race: string
}): Promise<string> {
  const ref = await addDoc(collection(db, 'campaigns', params.campaignId, 'party'), {
    campaignId: params.campaignId,
    name: params.name,
    playerName: params.playerName,
    ownerId: params.ownerId,
    classAndLevel: params.classAndLevel,
    race: params.race,
    hp: { current: 10, max: 10 },
    armorClass: 10,
    abilityScores: BLANK_ABILITY_SCORES,
    inventory: [] as InventoryItem[],
    notes: '',
    isNpcControlled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Manual add — the AI notes pipeline calls the Cloud Function version of this
 * server-side; this client path is for a player adding an item by hand. */
export async function addInventoryItem(
  campaignId: string,
  characterId: string,
  item: Omit<InventoryItem, 'id'>,
): Promise<void> {
  const newItem: InventoryItem = { ...item, id: crypto.randomUUID() }
  await updateDoc(doc(db, 'campaigns', campaignId, 'party', characterId), {
    inventory: arrayUnion(newItem),
    updatedAt: serverTimestamp(),
  })
}

export async function removeInventoryItem(
  campaignId: string,
  characterId: string,
  item: InventoryItem,
): Promise<void> {
  await updateDoc(doc(db, 'campaigns', campaignId, 'party', characterId), {
    inventory: arrayRemove(item),
    updatedAt: serverTimestamp(),
  })
}

export async function updateCharacterHp(
  campaignId: string,
  characterId: string,
  hp: { current: number; max: number },
): Promise<void> {
  await updateDoc(doc(db, 'campaigns', campaignId, 'party', characterId), {
    hp,
    updatedAt: serverTimestamp(),
  })
}
