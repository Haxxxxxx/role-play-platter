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

export type CampaignStatus = 'setup' | 'active' | 'completed'

export interface Campaign extends BaseRow {
  name: string
  system: RpgSystem
  description: string
  gmId: string
  isProcessingNotes: boolean
  status: CampaignStatus
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

/** A named list rather than a fixed per-system schema — the campaign's RPG
 * system is a free choice (Chroniques Oubliées, D&D 5e, Homebrew...) and
 * they don't share a skill list, so this is filled in by hand. */
export interface Skill {
  id: string
  name: string
  modifier: number
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
  skills: Skill[]
  notes: string
  isNpcControlled: boolean
  portraitUrl: string | null
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

export interface BattleMap extends BaseRow {
  campaignId: string
  /** null = the campaign's overworld/path map; set = one location's detail map. */
  locationId: string | null
  name: string
  gridWidth: number
  gridHeight: number
  backgroundImageUrl: string | null
}

export type MapTokenKind = 'npc' | 'character' | 'monster' | 'decoration' | 'object' | 'location'

export interface MapToken extends BaseRow {
  campaignId: string
  mapId: string
  kind: MapTokenKind
  label: string
  icon: string
  color: string
  x: number
  y: number
  refNpcId: string | null
  refCharacterId: string | null
  refLocationId: string | null
  visibleToPlayers: boolean
  /** GM-authored: what the token hides — loot, a trap's effect, a secret,
   * a bonus. Players only receive it once the token is revealed
   * (visible_to_players), same as the token itself. */
  content: string
}

/** A path segment connecting two tokens — how the "whole adventure" route
 * between locations is drawn, laid out by the GM (or seeded from the
 * chronicle) and editable like everything else on the map. */
export interface MapEdge {
  id: string
  campaignId: string
  mapId: string
  fromTokenId: string
  toTokenId: string
  createdAt: string
}

/** One scene of a GM's prepped scenario — ordered, GM-only. read_aloud is
 * the boxed text meant to be read at the table; gmNotes is secret prep. */
export interface Scene extends BaseRow {
  campaignId: string
  title: string
  order: number
  readAloud: string
  gmNotes: string
  encounter: string
  npcIds: string[]
  locationIds: string[]
  done: boolean
}
