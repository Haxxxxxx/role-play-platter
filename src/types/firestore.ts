import type { Timestamp } from 'firebase/firestore'

/** Fields every top-level document carries. */
export interface BaseDoc {
  id: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type RpgSystem =
  | 'D&D 5e'
  | 'Pathfinder 2e'
  | 'Call of Cthulhu'
  | 'Blades in the Dark'
  | 'Custom / Homebrew'

export interface Campaign extends BaseDoc {
  name: string
  system: RpgSystem
  description: string
  gmId: string
  memberIds: string[]
  /** True while a note is being structured by Claude, to disable double-submits. */
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
  /** id of the sessionNote that introduced/last changed this item, for provenance. */
  sourceNoteId: string | null
}

export interface Character extends BaseDoc {
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

export interface SessionNote extends BaseDoc {
  campaignId: string
  authorId: string
  kind: SessionNoteKind
  rawText: string
  status: SessionNoteStatus
  /** Claude's narrated recap of this note, once processed. */
  narrativeRecap: string | null
  errorMessage: string | null
  processedAt: Timestamp | null
}

export interface TimelineEvent extends BaseDoc {
  campaignId: string
  title: string
  description: string
  /** Monotonic ordering key (in-fiction sequence), not a wall-clock date. */
  order: number
  sourceNoteId: string | null
  locationId: string | null
  tags: string[]
}

export type NpcDisposition = 'ally' | 'neutral' | 'enemy' | 'unknown'

export interface Npc extends BaseDoc {
  campaignId: string
  name: string
  description: string
  disposition: NpcDisposition
  /** Text-only placeholder until an image-gen provider is wired in. */
  portraitUrl: string | null
  sourceNoteId: string | null
}

export interface Location extends BaseDoc {
  campaignId: string
  name: string
  description: string
  sourceNoteId: string | null
}

export type QuestStatus = 'active' | 'completed' | 'failed'

export interface Quest extends BaseDoc {
  campaignId: string
  title: string
  description: string
  status: QuestStatus
  relatedNpcIds: string[]
  relatedLocationIds: string[]
  sourceNoteId: string | null
}

/** Phase 2 — battle map. Typed now so the schema doesn't need to shift later. */
export interface BattleMap extends BaseDoc {
  campaignId: string
  name: string
  gridWidth: number
  gridHeight: number
  backgroundImageUrl: string | null
}
