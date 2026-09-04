import { useSupabaseCollection } from '@/hooks/useSupabaseCollection'
import {
  mapLocation,
  mapNpc,
  mapQuest,
  mapSessionNote,
  mapTimelineEvent,
  type LocationRow,
  type NpcRow,
  type QuestRow,
  type SessionNoteRow,
  type TimelineEventRow,
} from '@/lib/mappers'

/** Real-time chronicle collections, all scoped to one campaign and kept in
 * sync across every connected GM/player screen — this is the "party
 * history" view. */

export function useTimeline(campaignId: string | undefined) {
  return useSupabaseCollection<TimelineEventRow, ReturnType<typeof mapTimelineEvent>>({
    table: 'timeline_events',
    filterColumn: 'campaign_id',
    filterValue: campaignId,
    orderBy: { column: 'order', ascending: true },
    mapRow: mapTimelineEvent,
  })
}

export function useNpcs(campaignId: string | undefined) {
  return useSupabaseCollection<NpcRow, ReturnType<typeof mapNpc>>({
    table: 'npcs',
    filterColumn: 'campaign_id',
    filterValue: campaignId,
    orderBy: { column: 'name', ascending: true },
    mapRow: mapNpc,
  })
}

export function useLocations(campaignId: string | undefined) {
  return useSupabaseCollection<LocationRow, ReturnType<typeof mapLocation>>({
    table: 'locations',
    filterColumn: 'campaign_id',
    filterValue: campaignId,
    orderBy: { column: 'name', ascending: true },
    mapRow: mapLocation,
  })
}

export function useQuests(campaignId: string | undefined) {
  return useSupabaseCollection<QuestRow, ReturnType<typeof mapQuest>>({
    table: 'quests',
    filterColumn: 'campaign_id',
    filterValue: campaignId,
    orderBy: { column: 'created_at', ascending: false },
    mapRow: mapQuest,
  })
}

export function useSessionNotes(campaignId: string | undefined) {
  return useSupabaseCollection<SessionNoteRow, ReturnType<typeof mapSessionNote>>({
    table: 'session_notes',
    filterColumn: 'campaign_id',
    filterValue: campaignId,
    orderBy: { column: 'created_at', ascending: false },
    mapRow: mapSessionNote,
  })
}
