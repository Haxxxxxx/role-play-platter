import type { NpcDisposition } from '@/types/database'

export const CELL_SIZE = 36

export const DECORATION_PRESETS: { label: string; icon: string; color: string }[] = [
  { label: 'Arbre', icon: '🌲', color: '#2f6b3a' },
  { label: 'Rocher', icon: '🪨', color: '#6b6b6b' },
  { label: 'Porte', icon: '🚪', color: '#8a5a33' },
  { label: 'Coffre', icon: '📦', color: '#a9832f' },
  { label: 'Feu', icon: '🔥', color: '#d9553a' },
  { label: 'Piège', icon: '⚠️', color: '#c9a227' },
  { label: 'Eau', icon: '💧', color: '#3a7fd9' },
  { label: 'Mur', icon: '🧱', color: '#8a4b3a' },
]

export const NPC_STYLE: Record<NpcDisposition, { icon: string; color: string }> = {
  ally: { icon: '🤝', color: '#3fae6a' },
  enemy: { icon: '⚔️', color: '#c94f4f' },
  neutral: { icon: '👤', color: '#9a8f7a' },
  unknown: { icon: '❔', color: '#6b6b6b' },
}

export const LOCATION_STYLE = { icon: '📍', color: '#d97757' }
export const CHARACTER_STYLE = { icon: '🧑', color: '#7c6ce8' }
export const MONSTER_STYLE = { label: 'Monstre', icon: '👹', color: '#7a2f2f' }
