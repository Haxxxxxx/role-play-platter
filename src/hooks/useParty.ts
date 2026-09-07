import { supabase } from '@/lib/supabase'
import { mapCharacter, type CharacterRow } from '@/lib/mappers'
import { useSupabaseCollection } from '@/hooks/useSupabaseCollection'
import type { AbilityScores, InventoryItem, Skill } from '@/types/database'

export function useParty(campaignId: string | undefined) {
  return useSupabaseCollection<CharacterRow, ReturnType<typeof mapCharacter>>({
    table: 'characters',
    filterColumn: 'campaign_id',
    filterValue: campaignId,
    orderBy: { column: 'name', ascending: true },
    mapRow: mapCharacter,
  })
}

export async function createCharacter(params: {
  campaignId: string
  name: string
  playerName: string
  ownerId: string | null
  classAndLevel: string
  race: string
  abilityScores: AbilityScores
  hpMax: number
  armorClass: number
}): Promise<string> {
  const { data, error } = await supabase
    .from('characters')
    .insert({
      campaign_id: params.campaignId,
      name: params.name,
      player_name: params.playerName,
      owner_id: params.ownerId,
      class_and_level: params.classAndLevel,
      race: params.race,
      hp_current: params.hpMax,
      hp_max: params.hpMax,
      armor_class: params.armorClass,
      ability_scores: params.abilityScores,
      inventory: [] as InventoryItem[],
      skills: [] as Skill[],
    })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

// Every mutation below re-reads the current jsonb array/value from the
// database immediately before writing, instead of trusting whatever the
// caller has in hand (a React prop, last rendered a network round-trip
// ago). That prop is exactly stale enough to matter: two quick clicks on
// the same character (a double add, or the GM and the player both editing
// within the same round-trip window) would otherwise both read the same
// pre-change array and the second write would silently clobber the
// first's effect instead of building on it. This is the same
// read-immediately-before-write shape api/_lib/writeback.ts already uses
// for the AI pipeline, just via the client instead of the service role.
// It narrows the race window a lot but isn't a true atomic transaction —
// worth a Postgres function (jsonb append inside one statement) if this
// table ever gets genuinely concurrent editors, which it doesn't yet.

async function readCharacterField<K extends 'inventory' | 'skills' | 'hp_current' | 'hp_max' | 'armor_class'>(
  characterId: string,
  columns: K[],
): Promise<Record<K, unknown>> {
  const { data, error } = await supabase.from('characters').select(columns.join(',')).eq('id', characterId).single()
  if (error) throw error
  return data as unknown as Record<K, unknown>
}

/** Manual add — the AI notes pipeline applies its own item changes
 * server-side; this path is for a player adding an item by hand. */
export async function addInventoryItem(characterId: string, item: Omit<InventoryItem, 'id'>): Promise<void> {
  const { inventory } = await readCharacterField(characterId, ['inventory'])
  const newItem: InventoryItem = { ...item, id: crypto.randomUUID() }
  const { error } = await supabase
    .from('characters')
    .update({ inventory: [...(inventory as InventoryItem[]), newItem] })
    .eq('id', characterId)
  if (error) throw error
}

export async function removeInventoryItem(characterId: string, itemId: string): Promise<void> {
  const { inventory } = await readCharacterField(characterId, ['inventory'])
  const { error } = await supabase
    .from('characters')
    .update({ inventory: (inventory as InventoryItem[]).filter((i) => i.id !== itemId) })
    .eq('id', characterId)
  if (error) throw error
}

export async function toggleItemEquipped(characterId: string, itemId: string): Promise<void> {
  const { inventory } = await readCharacterField(characterId, ['inventory'])
  const { error } = await supabase
    .from('characters')
    .update({
      inventory: (inventory as InventoryItem[]).map((i) => (i.id === itemId ? { ...i, equipped: !i.equipped } : i)),
    })
    .eq('id', characterId)
  if (error) throw error
}

/** Adjusts current HP by a delta (never an absolute value from a stale
 * prop) and clamps against the *freshly read* max, so two quick +/- clicks
 * always compose instead of one clobbering the other. */
export async function adjustCharacterHp(characterId: string, delta: number): Promise<void> {
  const { hp_current, hp_max } = await readCharacterField(characterId, ['hp_current', 'hp_max'])
  const next = Math.max(0, Math.min(hp_max as number, (hp_current as number) + delta))
  const { error } = await supabase.from('characters').update({ hp_current: next }).eq('id', characterId)
  if (error) throw error
}

export async function adjustCharacterArmorClass(characterId: string, delta: number): Promise<void> {
  const { armor_class } = await readCharacterField(characterId, ['armor_class'])
  const next = Math.max(0, (armor_class as number) + delta)
  const { error } = await supabase.from('characters').update({ armor_class: next }).eq('id', characterId)
  if (error) throw error
}

/** A named list rather than a fixed per-system schema — see the Skill type
 * for why. Manual, same as inventory: nothing structures skills from notes. */
export async function addSkill(characterId: string, skill: Omit<Skill, 'id'>): Promise<void> {
  const { skills } = await readCharacterField(characterId, ['skills'])
  const newSkill: Skill = { ...skill, id: crypto.randomUUID() }
  const { error } = await supabase
    .from('characters')
    .update({ skills: [...(skills as Skill[]), newSkill] })
    .eq('id', characterId)
  if (error) throw error
}

export async function removeSkill(characterId: string, skillId: string): Promise<void> {
  const { skills } = await readCharacterField(characterId, ['skills'])
  const { error } = await supabase
    .from('characters')
    .update({ skills: (skills as Skill[]).filter((s) => s.id !== skillId) })
    .eq('id', characterId)
  if (error) throw error
}

/** "Add all the system's skills at once" — skips (by name, case-insensitive)
 * any the character already has, so clicking it again after adding a few by
 * hand doesn't duplicate them. */
export async function addSkillsBulk(characterId: string, newSkills: { name: string }[]): Promise<void> {
  const { skills } = await readCharacterField(characterId, ['skills'])
  const existing = skills as Skill[]
  const existingNames = new Set(existing.map((s) => s.name.trim().toLowerCase()))
  const toAdd = newSkills
    .filter((s) => !existingNames.has(s.name.trim().toLowerCase()))
    .map((s) => ({ id: crypto.randomUUID(), name: s.name, modifier: 0 }))
  if (toAdd.length === 0) return
  const { error } = await supabase
    .from('characters')
    .update({ skills: [...existing, ...toAdd] })
    .eq('id', characterId)
  if (error) throw error
}

const MAX_PORTRAIT_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * No AI image generation available on the free tier (checked live against
 * every Gemini image model — all billing-only) — this is a straight file
 * upload instead. A fresh random filename per upload (never a fixed path)
 * so the resulting public URL always changes, avoiding a stale cached
 * image after replacing the portrait; the old file is simply left orphaned
 * in storage rather than cleaned up, an acceptable trade for the
 * simplicity here.
 */
export async function uploadCharacterPortrait(characterId: string, file: File): Promise<string> {
  if (file.size > MAX_PORTRAIT_BYTES) {
    throw new Error('Image trop lourde (5 Mo maximum).')
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${characterId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('portraits').upload(path, file, { cacheControl: '3600' })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('portraits').getPublicUrl(path)
  const { error } = await supabase.from('characters').update({ portrait_url: data.publicUrl }).eq('id', characterId)
  if (error) throw error
  return data.publicUrl
}

/**
 * AI-generated portrait: the server builds a visual brief from the
 * character + campaign system (free text model) then paints it (image
 * model, billing-only) and writes portrait_url. The character prop updates
 * live off that write, so nothing to return-and-set here beyond surfacing
 * an error.
 */
export async function generateCharacterPortrait(characterId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in.')

  // Image generation genuinely takes a while; cap it so a hung request
  // surfaces as a clear error instead of an indefinite spinner.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  let response: Response
  try {
    response = await fetch('/api/generate-portrait', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ characterId }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('La génération a pris trop de temps — réessayez.', { cause: err })
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  const body = (await response.json()) as { portraitUrl: string } | { error: string }
  if (!response.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : 'La génération du portrait a échoué.')
  }
}
