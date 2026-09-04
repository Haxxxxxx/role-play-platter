/** App-facing (camelCase) shapes. Rows come back from Postgres snake_case —
 * src/lib/mappers.ts converts at the query boundary so the rest of the app
 * (and the pages carried over from the Firebase version) never sees a
 * snake_case field. */

export type RpgSystem =
  | 'D&D 5e'
  | 'Pathfinder 2e'
  | 'Call of Cthulhu'
  | 'Blades in the Dark'
  | 'Chroniques Oubliées'
  | 'Custom / Homebrew'

export interface BaseRow {
  id: string
  createdAt: string
  updatedAt: string
}

export interface Campaign extends BaseRow {
  name: string
  system: RpgSystem
  description: string
  gmId: string
  isProcessingNotes: boolean
}

export interface AbilityScores {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  description: string
  equipped: boolean
  sourceNoteId: string | null
}

export interface Character extends BaseRow {
  campaignId: string
  name: string
  playerName: string
  ownerId: string | null
  classAndLevel: string
  race: string
  hp: { current: number; max: number }
  armorClass: number
  abilityScores: AbilityScores
  inventory: InventoryItem[]
  notes: string
  isNpcControlled: boolean
}

export type SessionNoteKind = 'session-recap' | 'item-update' | 'freeform'
export type SessionNoteStatus = 'pending' | 'processing' | 'processed' | 'error'

export interface SessionNote extends BaseRow {
  campaignId: string
  authorId: string
  kind: SessionNoteKind
  rawText: string
  status: SessionNoteStatus
  narrativeRecap: string | null
  errorMessage: string | null
  processedAt: string | null
}

export interface TimelineEvent extends BaseRow {
  campaignId: string
  title: string
  description: string
  order: number
  sourceNoteId: string | null
  locationId: string | null
  tags: string[]
}

export type NpcDisposition = 'ally' | 'neutral' | 'enemy' | 'unknown'

export interface Npc extends BaseRow {
  campaignId: string
  name: string
  description: string
  disposition: NpcDisposition
  portraitUrl: string | null
  sourceNoteId: string | null
}

export interface Location extends BaseRow {
  campaignId: string
  name: string
  description: string
  sourceNoteId: string | null
}

export type QuestStatus = 'active' | 'completed' | 'failed'

export interface Quest extends BaseRow {
  campaignId: string
  title: string
  description: string
  status: QuestStatus
  relatedNpcIds: string[]
  relatedLocationIds: string[]
  sourceNoteId: string | null
}

/** Phase 2 — battle map. Typed now so the schema doesn't need to shift later. */
export interface BattleMap extends BaseRow {
  campaignId: string
  name: string
  gridWidth: number
  gridHeight: number
  backgroundImageUrl: string | null
}
