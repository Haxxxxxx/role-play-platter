import { useMemo } from 'react'
import { classifyTerrain, generateTerrainGrid, TERRAIN_COLOR } from '@/components/battlemap/terrain'

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

export function HexTerrain({
  seed,
  descriptionText,
  forceOutdoor,
  width,
  height,
}: {
  seed: string
  /** The location's (or campaign's) own name + description — what actually
   * decides whether this map gets terrain at all, and which kind. */
  descriptionText: string
  /** The overworld map: always show terrain, one interior location's name
   * mentioned in the combined text shouldn't blank the whole world map. */
  forceOutdoor?: boolean
  width: number
  height: number
}) {
  // Generous overscan on every side (an extra ring of hexes, starting
  // before 0) so the tiling can never fall short of the actual grid area —
  // excess just gets clipped by the SVG's own width/height, which is
  // harmless, unlike a gap.
  const cols = Math.ceil(width / (HEX_WIDTH * 0.75)) + 3
  const rows = Math.ceil(height / HEX_HEIGHT) + 3
  const profile = useMemo(() => classifyTerrain(descriptionText, { forceOutdoor }), [descriptionText, forceOutdoor])
  const terrain = useMemo(() => generateTerrainGrid(seed, cols, rows, profile), [seed, cols, rows, profile])

  if (!terrain) return null

  return (
    <svg width={width} height={height} className="pointer-events-none absolute left-0 top-0">
      {terrain.map((row, y) =>
        row.map((type, x) => {
          const cx = (x - 1) * HEX_WIDTH * 0.75
          const cy = (y - 1) * HEX_HEIGHT + (x % 2 === 1 ? HEX_HEIGHT / 2 : 0)
          return (
            <polygon
              key={`${x}-${y}`}
              points={hexPoints(cx, cy, HEX_RADIUS)}
              fill={TERRAIN_COLOR[type]}
              fillOpacity={0.85}
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
