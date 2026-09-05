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
