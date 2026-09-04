export type TerrainType = 'water' | 'sand' | 'dirt' | 'forest'

export const TERRAIN_COLOR: Record<TerrainType, string> = {
  water: '#2f6fae',
  sand: '#c9a86a',
  dirt: '#6b5540',
  forest: '#2f6b3a',
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

/**
 * A soft-blobbed terrain grid (box-blurred noise, not per-cell static) so it
 * reads as coastline/forest patches rather than confetti. Purely visual — no
 * gameplay meaning, nothing to persist; MapGrid just calls this with the
 * map's id as the seed every render.
 */
export function generateTerrainGrid(seedStr: string, cols: number, rows: number): TerrainType[][] {
  const seed = hashString(seedStr)
  const raw: number[][] = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => hashCell(seed, x, y)))

  const grid: TerrainType[][] = []
  for (let y = 0; y < rows; y++) {
    const row: TerrainType[] = []
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
      const v = sum / count
      row.push(v < 0.22 ? 'water' : v < 0.32 ? 'sand' : v < 0.62 ? 'dirt' : 'forest')
    }
    grid.push(row)
  }
  return grid
}
