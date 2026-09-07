import { supabase } from '@/lib/supabase'
import { postToApi } from '@/lib/apiFetch'
import { mapScene, type SceneRow } from '@/lib/mappers'
import { useSupabaseCollection } from '@/hooks/useSupabaseCollection'
import type { Scene } from '@/types/database'

/** A campaign's prepped scenes, ordered, live. GM-only by RLS. */
export function useScenes(campaignId: string | undefined) {
  return useSupabaseCollection<SceneRow, Scene>({
    table: 'scenes',
    filterColumn: 'campaign_id',
    filterValue: campaignId,
    orderBy: { column: 'order', ascending: true },
    mapRow: mapScene,
  })
}

export async function createScene(campaignId: string, nextOrder: number): Promise<void> {
  const { error } = await supabase.from('scenes').insert({ campaign_id: campaignId, order: nextOrder })
  if (error) throw error
}

/** Column-level patch — scenes are plain text/array fields with a single
 * GM editing their own prep, so last-write-wins per field is fine (no
 * read-modify-write race like the jsonb character fields have). */
export async function updateScene(
  sceneId: string,
  patch: Partial<{
    title: string
    read_aloud: string
    gm_notes: string
    encounter: string
    npc_ids: string[]
    location_ids: string[]
    done: boolean
    order: number
  }>,
): Promise<void> {
  const { error } = await supabase.from('scenes').update(patch).eq('id', sceneId)
  if (error) throw error
}

export async function deleteScene(sceneId: string): Promise<void> {
  const { error } = await supabase.from('scenes').delete().eq('id', sceneId)
  if (error) throw error
}

/** Swap a scene's `order` with its neighbour in the given direction. */
export async function moveScene(scenes: Scene[], sceneId: string, direction: 'up' | 'down'): Promise<void> {
  const idx = scenes.findIndex((s) => s.id === sceneId)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || swapIdx < 0 || swapIdx >= scenes.length) return
  const a = scenes[idx]
  const b = scenes[swapIdx]
  await Promise.all([updateScene(a.id, { order: b.order }), updateScene(b.id, { order: a.order })])
}

/**
 * AI-drafted scene: the server reads the campaign's world (system, known
 * NPCs/locations/quests) and turns a one-line premise into a filled-in
 * scene, created server-side. Picked up live like any other insert.
 */
export async function generateScene(campaignId: string, premise: string): Promise<void> {
  await postToApi('/api/generate-scene', { campaignId, premise })
}

/** Turn a scene into a timeline event the players actually see — the
 * bridge from prep to the shared chronicle. */
export async function pushSceneToChronicle(campaignId: string, scene: Scene): Promise<void> {
  const { error } = await supabase.from('timeline_events').insert({
    campaign_id: campaignId,
    title: scene.title,
    description: scene.readAloud || scene.gmNotes || '',
    order: Date.now(),
    tags: ['scène'],
  })
  if (error) throw error
}
