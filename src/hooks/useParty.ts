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

/** Manual add — the AI notes pipeline applies its own item changes
 * server-side; this path is for a player adding an item by hand. */
export async function addInventoryItem(
  characterId: string,
  currentInventory: InventoryItem[],
  item: Omit<InventoryItem, 'id'>,
): Promise<void> {
  const newItem: InventoryItem = { ...item, id: crypto.randomUUID() }
  const { error } = await supabase
    .from('characters')
    .update({ inventory: [...currentInventory, newItem] })
    .eq('id', characterId)
  if (error) throw error
}

export async function removeInventoryItem(
  characterId: string,
  currentInventory: InventoryItem[],
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .update({ inventory: currentInventory.filter((i) => i.id !== itemId) })
    .eq('id', characterId)
  if (error) throw error
}

export async function toggleItemEquipped(
  characterId: string,
  currentInventory: InventoryItem[],
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .update({
      inventory: currentInventory.map((i) => (i.id === itemId ? { ...i, equipped: !i.equipped } : i)),
    })
    .eq('id', characterId)
  if (error) throw error
}

export async function updateCharacterHp(
  characterId: string,
  hp: { current: number; max: number },
): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .update({ hp_current: hp.current, hp_max: hp.max })
    .eq('id', characterId)
  if (error) throw error
}

export async function updateCharacterArmorClass(characterId: string, armorClass: number): Promise<void> {
  const { error } = await supabase.from('characters').update({ armor_class: armorClass }).eq('id', characterId)
  if (error) throw error
}

/** A named list rather than a fixed per-system schema — see the Skill type
 * for why. Manual, same as inventory: nothing structures skills from notes. */
export async function addSkill(
  characterId: string,
  currentSkills: Skill[],
  skill: Omit<Skill, 'id'>,
): Promise<void> {
  const newSkill: Skill = { ...skill, id: crypto.randomUUID() }
  const { error } = await supabase
    .from('characters')
    .update({ skills: [...currentSkills, newSkill] })
    .eq('id', characterId)
  if (error) throw error
}

export async function removeSkill(characterId: string, currentSkills: Skill[], skillId: string): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .update({ skills: currentSkills.filter((s) => s.id !== skillId) })
    .eq('id', characterId)
  if (error) throw error
}
