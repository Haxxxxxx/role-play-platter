import { useMemo } from 'react'
import { generateTerrainGrid, TERRAIN_COLOR } from '@/components/battlemap/terrain'

// Independent of the square token grid's CELL_SIZE — this is a decorative
// backdrop, not something tokens snap to, so it can be sized purely for how
// it looks (chunky enough to read as terrain patches, not confetti).
const HEX_RADIUS = 30
const HEX_WIDTH = HEX_RADIUS * 2
const HEX_HEIGHT = Math.sqrt(3) * HEX_RADIUS

function hexPoints(cx: number, cy: number, r: number): string {
  // Flat-top hexagon.
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i)
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
  }).join(' ')
}

export function HexTerrain({ seed, width, height }: { seed: string; width: number; height: number }) {
  const cols = Math.ceil(width / (HEX_WIDTH * 0.75)) + 1
  const rows = Math.ceil(height / HEX_HEIGHT) + 1
  const terrain = useMemo(() => generateTerrainGrid(seed, cols, rows), [seed, cols, rows])

  return (
    <svg width={width} height={height} className="pointer-events-none absolute left-0 top-0" opacity={0.55}>
      {terrain.map((row, y) =>
        row.map((type, x) => {
          const cx = x * HEX_WIDTH * 0.75
          const cy = y * HEX_HEIGHT + (x % 2 === 1 ? HEX_HEIGHT / 2 : 0)
          return (
            <polygon
              key={`${x}-${y}`}
              points={hexPoints(cx, cy, HEX_RADIUS)}
              fill={TERRAIN_COLOR[type]}
              stroke="#0f0c14"
              strokeWidth={1}
              strokeOpacity={0.25}
            />
          )
        }),
      )}
    </svg>
  )
}
