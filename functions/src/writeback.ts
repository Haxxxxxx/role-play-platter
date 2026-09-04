import { randomUUID } from 'node:crypto'
import { FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore'
import type { CampaignUpdate } from './schema.js'

// Duplicated (not imported) from src/types/firestore.ts on the frontend —
// this package builds independently of the Vite app. If the shape drifts,
// extract both into a shared workspace package.
interface InventoryItem {
  id: string
  name: string
  quantity: number
  description: string
  equipped: boolean
  sourceNoteId: string | null
}

interface EntityRef {
  id: string
  name: string
}

interface QuestRef {
  id: string
  title: string
  status: string
}

function findByName(existing: EntityRef[], name: string): EntityRef | undefined {
  const target = name.trim().toLowerCase()
  return existing.find((e) => e.name.trim().toLowerCase() === target)
}

export interface ApplyUpdateResult {
  timelineEventsCreated: number
  npcsTouched: number
  locationsTouched: number
  questsTouched: number
  itemChangesApplied: number
}

/**
 * Writes Claude's (already zod-validated) structured update into Firestore:
 * upserts NPCs/locations/quests by case-insensitive name match against what
 * the campaign already knows, appends timeline events, and applies inventory
 * deltas to matching party members. One batch per note for atomicity of the
 * writes; the per-character inventory reads happen first since arrays can't
 * be partially patched.
 */
export async function applyCampaignUpdate(params: {
  db: Firestore
  campaignRef: DocumentReference
  noteId: string
  update: CampaignUpdate
  existingNpcs: EntityRef[]
  existingLocations: EntityRef[]
  existingQuests: QuestRef[]
  partyRoster: EntityRef[]
}): Promise<ApplyUpdateResult> {
  const { db, campaignRef, noteId, update, existingNpcs, existingLocations, existingQuests, partyRoster } = params
  const batch = db.batch()
  const now = FieldValue.serverTimestamp()

  // Locations first — timeline events below reference them by resolved id.
  const locationIdByName = new Map<string, string>()
  for (const loc of update.locations) {
    const match = findByName(existingLocations, loc.name)
    const ref = match ? campaignRef.collection('locations').doc(match.id) : campaignRef.collection('locations').doc()
    locationIdByName.set(loc.name.trim().toLowerCase(), ref.id)
    batch.set(
      ref,
      {
        campaignId: campaignRef.id,
        name: loc.name,
        description: loc.description,
        sourceNoteId: noteId,
        updatedAt: now,
        ...(match ? {} : { createdAt: now }),
      },
      { merge: true },
    )
  }

  let npcsTouched = 0
  for (const npc of update.npcs) {
    const match = findByName(existingNpcs, npc.name)
    const ref = match ? campaignRef.collection('npcs').doc(match.id) : campaignRef.collection('npcs').doc()
    batch.set(
      ref,
      {
        campaignId: campaignRef.id,
        name: npc.name,
        description: npc.description,
        disposition: npc.disposition,
        portraitUrl: null,
        sourceNoteId: noteId,
        updatedAt: now,
        ...(match ? {} : { createdAt: now }),
      },
      { merge: true },
    )
    npcsTouched++
  }

  let questsTouched = 0
  for (const quest of update.quests) {
    const match = existingQuests.find((q) => q.title.trim().toLowerCase() === quest.title.trim().toLowerCase())
    const ref = match ? campaignRef.collection('quests').doc(match.id) : campaignRef.collection('quests').doc()
    batch.set(
      ref,
      {
        campaignId: campaignRef.id,
        title: quest.title,
        description: quest.description,
        status: quest.status,
        relatedNpcIds: [],
        relatedLocationIds: [],
        sourceNoteId: noteId,
        updatedAt: now,
        ...(match ? {} : { createdAt: now }),
      },
      { merge: true },
    )
    questsTouched++
  }

  let timelineEventsCreated = 0
  update.timelineEvents.forEach((event, idx) => {
    const ref = campaignRef.collection('timeline').doc()
    const locationId = event.locationName
      ? (locationIdByName.get(event.locationName.trim().toLowerCase()) ?? null)
      : null
    batch.set(ref, {
      campaignId: campaignRef.id,
      title: event.title,
      description: event.description,
      order: Date.now() + idx,
      sourceNoteId: noteId,
      locationId,
      tags: event.tags,
      createdAt: now,
      updatedAt: now,
    })
    timelineEventsCreated++
  })

  // Item changes need a read of the current inventory array per character,
  // so group by character and resolve before adding to the batch.
  const charByName = new Map<string, EntityRef>()
  for (const c of partyRoster) charByName.set(c.name.trim().toLowerCase(), c)

  const changesByCharacterId = new Map<string, CampaignUpdate['itemChanges']>()
  for (const change of update.itemChanges) {
    const match = charByName.get(change.characterName.trim().toLowerCase())
    if (!match) continue // Unknown character — skip rather than fabricate a new party member.
    const list = changesByCharacterId.get(match.id) ?? []
    list.push(change)
    changesByCharacterId.set(match.id, list)
  }

  let itemChangesApplied = 0
  for (const [characterId, changes] of changesByCharacterId) {
    const charRef = campaignRef.collection('party').doc(characterId)
    const charSnap = await charRef.get()
    const inventory: InventoryItem[] = (charSnap.data()?.inventory as InventoryItem[] | undefined) ?? []

    for (const change of changes) {
      const idx = inventory.findIndex((i) => i.name.trim().toLowerCase() === change.itemName.trim().toLowerCase())
      if (change.action === 'remove') {
        if (idx >= 0) {
          inventory[idx].quantity += change.quantityDelta // expected <= 0
          if (inventory[idx].quantity <= 0) inventory.splice(idx, 1)
        }
      } else if (change.action === 'equip' || change.action === 'unequip') {
        if (idx >= 0) inventory[idx].equipped = change.action === 'equip'
      } else {
        // add
        const qty = Math.max(1, change.quantityDelta)
        if (idx >= 0) {
          inventory[idx].quantity += qty
        } else {
          inventory.push({
            id: randomUUID(),
            name: change.itemName,
            quantity: qty,
            description: change.description ?? '',
            equipped: false,
            sourceNoteId: noteId,
          })
        }
      }
      itemChangesApplied++
    }

    batch.update(charRef, { inventory, updatedAt: now })
  }

  await batch.commit()

  return {
    timelineEventsCreated,
    npcsTouched,
    locationsTouched: update.locations.length,
    questsTouched,
    itemChangesApplied,
  }
}
