import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CampaignUpdate } from './schema.js'

// Duplicated (not imported) from src/types/database.ts on the frontend —
// this function deploys independently of the Vite app. If the shape drifts,
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
 * Writes Gemini's (already zod-validated) structured update into Postgres:
 * upserts NPCs/locations/quests by case-insensitive name match against what
 * the campaign already knows, inserts timeline events, and applies
 * inventory deltas to matching party members. Runs with the service-role
 * client, so it bypasses RLS entirely — this function is the only thing
 * trusted to write "AI-structured" rows.
 *
 * Writes happen sequentially rather than in one transaction (no multi-table
 * transaction primitive over the REST client without a Postgres function) —
 * acceptable for a single GM note today; worth moving into an RPC if this
 * ever needs cross-table atomicity guarantees.
 *
 * Every write's `error` is checked and collected — a *Touched counter only
 * ever counts a row that was actually confirmed written. If anything failed,
 * this throws with the collected messages instead of returning as if
 * everything landed: the caller marks the note 'error' either way, so a
 * partial failure must never come back looking like full success (that was
 * a real bug here — every counter used to increment unconditionally, so a
 * silently-failed write and a real one were indistinguishable to the GM).
 */
export async function applyCampaignUpdate(params: {
  supabase: SupabaseClient
  campaignId: string
  noteId: string
  update: CampaignUpdate
  existingNpcs: EntityRef[]
  existingLocations: EntityRef[]
  existingQuests: QuestRef[]
  partyRoster: EntityRef[]
}): Promise<ApplyUpdateResult> {
  const { supabase, campaignId, noteId, update, existingNpcs, existingLocations, existingQuests, partyRoster } =
    params

  const failures: string[] = []

  // Locations first — timeline events below reference them by resolved id.
  const locationIdByName = new Map<string, string>()
  for (const loc of update.locations) {
    const match = findByName(existingLocations, loc.name)
    const { data, error } = match
      ? await supabase
          .from('locations')
          .update({ description: loc.description, source_note_id: noteId })
          .eq('id', match.id)
          .select('id')
          .single()
      : await supabase
          .from('locations')
          .insert({ campaign_id: campaignId, name: loc.name, description: loc.description, source_note_id: noteId })
          .select('id')
          .single()
    if (error) {
      failures.push(`location "${loc.name}": ${error.message}`)
      continue
    }
    if (data?.id) locationIdByName.set(loc.name.trim().toLowerCase(), data.id)
  }

  let npcsTouched = 0
  for (const npc of update.npcs) {
    const match = findByName(existingNpcs, npc.name)
    const { error } = match
      ? await supabase
          .from('npcs')
          .update({ description: npc.description, disposition: npc.disposition, source_note_id: noteId })
          .eq('id', match.id)
      : await supabase.from('npcs').insert({
          campaign_id: campaignId,
          name: npc.name,
          description: npc.description,
          disposition: npc.disposition,
          source_note_id: noteId,
        })
    if (error) {
      failures.push(`NPC "${npc.name}": ${error.message}`)
      continue
    }
    npcsTouched++
  }

  let questsTouched = 0
  for (const quest of update.quests) {
    const match = existingQuests.find((q) => q.title.trim().toLowerCase() === quest.title.trim().toLowerCase())
    const { error } = match
      ? await supabase
          .from('quests')
          .update({ description: quest.description, status: quest.status, source_note_id: noteId })
          .eq('id', match.id)
      : await supabase.from('quests').insert({
          campaign_id: campaignId,
          title: quest.title,
          description: quest.description,
          status: quest.status,
          source_note_id: noteId,
        })
    if (error) {
      failures.push(`quest "${quest.title}": ${error.message}`)
      continue
    }
    questsTouched++
  }

  let timelineEventsCreated = 0
  if (update.timelineEvents.length > 0) {
    const rows = update.timelineEvents.map((event, idx) => ({
      campaign_id: campaignId,
      title: event.title,
      description: event.description,
      order: Date.now() + idx,
      source_note_id: noteId,
      location_id: event.locationName ? (locationIdByName.get(event.locationName.trim().toLowerCase()) ?? null) : null,
      tags: event.tags,
    }))
    const { error } = await supabase.from('timeline_events').insert(rows)
    if (error) {
      failures.push(`timeline events: ${error.message}`)
    } else {
      timelineEventsCreated = rows.length
    }
  }

  // Item changes need a read of the current inventory jsonb per character,
  // so group by character and resolve before writing.
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
    const { data: charRow, error: readError } = await supabase
      .from('characters')
      .select('inventory')
      .eq('id', characterId)
      .single()
    if (readError) {
      // Must not fall through to writing back an empty array here — that
      // would silently wipe this character's real inventory instead of
      // just failing to apply the delta.
      failures.push(`inventory for character ${characterId}: ${readError.message}`)
      continue
    }
    const inventory: InventoryItem[] = (charRow?.inventory as InventoryItem[] | undefined) ?? []
    let appliedForThisCharacter = 0

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
      appliedForThisCharacter++
    }

    const { error: writeError } = await supabase.from('characters').update({ inventory }).eq('id', characterId)
    if (writeError) {
      failures.push(`inventory for character ${characterId}: ${writeError.message}`)
      continue
    }
    itemChangesApplied += appliedForThisCharacter
  }

  if (failures.length > 0) {
    throw new Error(`Partial write failure — ${failures.length} change(s) did not save: ${failures.join('; ')}`)
  }

  return {
    timelineEventsCreated,
    npcsTouched,
    locationsTouched: locationIdByName.size,
    questsTouched,
    itemChangesApplied,
  }
}
