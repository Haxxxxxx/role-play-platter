export type TerrainType = 'water' | 'sand' | 'dirt' | 'forest' | 'rock'

export const TERRAIN_COLOR: Record<TerrainType, string> = {
  water: '#2f6fae',
  sand: '#c9a86a',
  dirt: '#6b5540',
  forest: '#2f6b3a',
  rock: '#5a5248',
}

export type TerrainMode = 'none' | 'outdoor' | 'cave'

export interface TerrainProfile {
  mode: TerrainMode
  /** Additive weight per type — higher means more of that terrain. Keyed by
   * matching the location's own name/description, so an area described as
   * being by the sea actually shows more water instead of generic noise. */
  bias: Partial<Record<TerrainType, number>>
}

// French text is a normal source here — this is a French-language TTRPG
// scenario and its location descriptions are French.
const INTERIOR_KEYWORDS = ['auberge', 'intérieur', 'chambre', 'cuisine', 'taverne', 'maison', 'bâtiment', 'salle', 'dortoir']
// Deliberately NOT "cave" — in French that's a cellar (part of a building),
// not a natural cave; "grotte"/"caverne" are the actual underground terrain.
const CAVE_KEYWORDS = ['grotte', 'caverne', 'souterrain', 'tunnel', 'mine']
const WATER_KEYWORDS = ['mer', 'rivière', 'fleuve', 'lac', 'eau', 'océan', 'étang', 'ruisseau', 'port']
const FOREST_KEYWORDS = ['forêt', 'bois', 'arbre', 'bosquet']
const SAND_KEYWORDS = ['sable', 'plage', 'désert', 'dune']
const DIRT_KEYWORDS = ['route', 'chemin', 'plaine', 'champ', 'colline', 'ville', 'village']

function countMatches(text: string, keywords: string[]): number {
  return keywords.reduce((n, kw) => (text.includes(kw) ? n + 1 : n), 0)
}

function outdoorBias(t: string): TerrainProfile {
  return {
    mode: 'outdoor',
    bias: {
      water: countMatches(t, WATER_KEYWORDS) * 0.25,
      forest: countMatches(t, FOREST_KEYWORDS) * 0.25,
      sand: countMatches(t, SAND_KEYWORDS) * 0.25,
      dirt: countMatches(t, DIRT_KEYWORDS) * 0.15,
    },
  }
}

/**
 * Reads the actual location (or campaign) description text to decide what
 * the map should even show: interior scenes get no outdoor terrain at all,
 * caves get a rock-dominant palette, and everywhere else biases toward
 * whatever terrain the description actually mentions.
 *
 * `forceOutdoor` skips the interior/cave detection — the overworld map
 * combines every location's text for terrain-type bias (more water where
 * the campaign mentions the sea, etc.), and one of those locations being an
 * interior (the inn) shouldn't blank out the whole world map's terrain.
 */
export function classifyTerrain(text: string, options?: { forceOutdoor?: boolean }): TerrainProfile {
  const t = text.toLowerCase()
  if (options?.forceOutdoor) return outdoorBias(t)

  if (countMatches(t, INTERIOR_KEYWORDS) > 0) {
    return { mode: 'none', bias: {} }
  }

  if (countMatches(t, CAVE_KEYWORDS) > 0) {
    return { mode: 'cave', bias: { rock: 0.35, water: countMatches(t, WATER_KEYWORDS) > 0 ? 0.15 : -0.1 } }
  }

  return outdoorBias(t)
}

/** Deterministic hash of (seed, x, y) -> [0, 1). No RNG state to carry
 * between cells, so any cell can be recomputed independently — that's what
 * makes the terrain stable across reloads without storing it anywhere. */
function hashCell(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4294967295
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return h >>> 0
}

/** A box-blurred noise channel (not per-cell static) so it reads as patches
 * rather than confetti. `salt` gives each terrain type its own independent
 * channel from the same base seed. */
function blurredNoise(seed: number, salt: number, cols: number, rows: number): number[][] {
  const s = (seed ^ Math.imul(salt, 2654435761)) >>> 0
  const raw: number[][] = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => hashCell(s, x, y)))
  const blurred: number[][] = []
  for (let y = 0; y < rows; y++) {
    const row: number[] = []
    for (let x = 0; x < cols; x++) {
      let sum = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy
          const nx = x + dx
          if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue
          sum += raw[ny][nx]
          count++
        }
      }
      row.push(sum / count)
    }
    blurred.push(row)
  }
  return blurred
}

/**
 * One noise channel per terrain type, each cell's terrain is whichever
 * channel scores highest there (channel value + that type's bias) — so a
 * positive bias doesn't just tint the map, it actually makes that terrain
 * win more cells.
 */
export function generateTerrainGrid(seedStr: string, cols: number, rows: number, profile: TerrainProfile): TerrainType[][] | null {
  if (profile.mode === 'none') return null
  const types: TerrainType[] = profile.mode === 'cave' ? ['rock', 'water'] : ['water', 'sand', 'dirt', 'forest']
  const seed = hashString(seedStr)
  const channels = types.map((_, i) => blurredNoise(seed, i + 1, cols, rows))
  const bias = types.map((t) => profile.bias[t] ?? 0)

  const grid: TerrainType[][] = []
  for (let y = 0; y < rows; y++) {
    const row: TerrainType[] = []
    for (let x = 0; x < cols; x++) {
      let bestIdx = 0
      let bestScore = -Infinity
      for (let i = 0; i < types.length; i++) {
        const score = channels[i][y][x] + bias[i]
        if (score > bestScore) {
          bestScore = score
          bestIdx = i
        }
      }
      row.push(types[bestIdx])
    }
    grid.push(row)
  }
  return grid
}
