import { supabase } from '@/lib/supabase'
import { mapCharacter, type CharacterRow } from '@/lib/mappers'
import { useSupabaseCollection } from '@/hooks/useSupabaseCollection'
import type { AbilityScores, InventoryItem } from '@/types/database'

export function useParty(campaignId: string | undefined) {
  return useSupabaseCollection<CharacterRow, ReturnType<typeof mapCharacter>>({
    table: 'characters',
    filterColumn: 'campaign_id',
    filterValue: campaignId,
    orderBy: { column: 'name', ascending: true },
    mapRow: mapCharacter,
  })
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
  const { data, error } = await supabase
    .from('characters')
    .insert({
      campaign_id: params.campaignId,
      name: params.name,
      player_name: params.playerName,
      owner_id: params.ownerId,
      class_and_level: params.classAndLevel,
      race: params.race,
      hp_current: 10,
      hp_max: 10,
      armor_class: 10,
      ability_scores: BLANK_ABILITY_SCORES,
      inventory: [] as InventoryItem[],
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
