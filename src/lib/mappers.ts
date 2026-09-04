import type {
  AbilityScores,
  Campaign,
  Character,
  InventoryItem,
  Location,
  Npc,
  Quest,
  RpgSystem,
  SessionNote,
  TimelineEvent,
} from '@/types/database'

/** Row shapes as they actually come back from Postgres (snake_case columns).
 * Explicit per-table mappers below convert each into the camelCase app type. */

export interface CampaignRow {
  id: string
  name: string
  system: string
  description: string
  gm_id: string
  is_processing_notes: boolean
  created_at: string
  updated_at: string
}

export function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    system: row.system as RpgSystem,
    description: row.description,
    gmId: row.gm_id,
    isProcessingNotes: row.is_processing_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CharacterRow {
  id: string
  campaign_id: string
  name: string
  player_name: string
  owner_id: string | null
  class_and_level: string
  race: string
  hp_current: number
  hp_max: number
  armor_class: number
  ability_scores: AbilityScores
  inventory: InventoryItem[]
  notes: string
  is_npc_controlled: boolean
  created_at: string
  updated_at: string
}

export function mapCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    playerName: row.player_name,
    ownerId: row.owner_id,
    classAndLevel: row.class_and_level,
    race: row.race,
    hp: { current: row.hp_current, max: row.hp_max },
    armorClass: row.armor_class,
    abilityScores: row.ability_scores,
    inventory: row.inventory,
    notes: row.notes,
    isNpcControlled: row.is_npc_controlled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface SessionNoteRow {
  id: string
  campaign_id: string
  author_id: string
  kind: string
  raw_text: string
  status: string
  narrative_recap: string | null
  error_message: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

export function mapSessionNote(row: SessionNoteRow): SessionNote {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    authorId: row.author_id,
    kind: row.kind as SessionNote['kind'],
    rawText: row.raw_text,
    status: row.status as SessionNote['status'],
    narrativeRecap: row.narrative_recap,
    errorMessage: row.error_message,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface TimelineEventRow {
  id: string
  campaign_id: string
  title: string
  description: string
  order: number
  source_note_id: string | null
  location_id: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export function mapTimelineEvent(row: TimelineEventRow): TimelineEvent {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    order: Number(row.order),
    sourceNoteId: row.source_note_id,
    locationId: row.location_id,
    tags: row.tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface NpcRow {
  id: string
  campaign_id: string
  name: string
  description: string
  disposition: string
  portrait_url: string | null
  source_note_id: string | null
  created_at: string
  updated_at: string
}

export function mapNpc(row: NpcRow): Npc {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    description: row.description,
    disposition: row.disposition as Npc['disposition'],
    portraitUrl: row.portrait_url,
    sourceNoteId: row.source_note_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface LocationRow {
  id: string
  campaign_id: string
  name: string
  description: string
  source_note_id: string | null
  created_at: string
  updated_at: string
}

export function mapLocation(row: LocationRow): Location {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    description: row.description,
    sourceNoteId: row.source_note_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface QuestRow {
  id: string
  campaign_id: string
  title: string
  description: string
  status: string
  related_npc_ids: string[]
  related_location_ids: string[]
  source_note_id: string | null
  created_at: string
  updated_at: string
}

export function mapQuest(row: QuestRow): Quest {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    status: row.status as Quest['status'],
    relatedNpcIds: row.related_npc_ids,
    relatedLocationIds: row.related_location_ids,
    sourceNoteId: row.source_note_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
