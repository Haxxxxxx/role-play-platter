import { useEffect, useRef, useState } from 'react'
import { CELL_SIZE } from '@/components/battlemap/presets'
import { HexTerrain } from '@/components/battlemap/HexTerrain'
import type { MapEdge, MapToken } from '@/types/database'

const DRAG_THRESHOLD_PX = 6

export function MapGrid({
  mapId,
  terrainText,
  forceOutdoorTerrain,
  gridWidth,
  gridHeight,
  tokens,
  edges,
  selectedTokenId,
  centerTokenId,
  onActivate,
  onDeselect,
  canDrag,
  onDrop,
}: {
  /** Seeds the decorative terrain (water/sand/dirt/forest) — deterministic
   * per map, so it's stable across reloads without storing or hand-painting
   * a single tile. */
  mapId: string
  /** The location's (or campaign's) own name + description — decides
   * whether this map gets terrain at all, and which kind, instead of pure
   * noise unrelated to the actual scene. */
  terrainText: string
  /** The overworld map: force outdoor terrain regardless of what's in the
   * combined text (e.g. an interior location's name shouldn't blank it). */
  forceOutdoorTerrain?: boolean
  gridWidth: number
  gridHeight: number
  tokens: MapToken[]
  edges: MapEdge[]
  selectedTokenId: string | null
  /** Scrolls this token into view (once) when the grid first has it — how a
   * click from another panel ("open the map centered on this") lands. */
  centerTokenId?: string | null
  onActivate: (token: MapToken) => void
  onDeselect: () => void
  canDrag: (token: MapToken) => boolean
  onDrop: (token: MapToken, x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const centeredRef = useRef<string | null>(null)

  const tokenById = new Map(tokens.map((t) => [t.id, t]))
  const center = (t: MapToken) => ({ cx: t.x * CELL_SIZE + CELL_SIZE / 2, cy: t.y * CELL_SIZE + CELL_SIZE / 2 })
  const width = gridWidth * CELL_SIZE
  const height = gridHeight * CELL_SIZE

  useEffect(() => {
    if (!centerTokenId || centeredRef.current === centerTokenId) return
    const token = tokenById.get(centerTokenId)
    const el = containerRef.current
    if (!token || !el) return
    centeredRef.current = centerTokenId
    const { cx, cy } = center(token)
    el.scrollTo({
      left: Math.max(0, cx - el.clientWidth / 2),
      top: Math.max(0, cy - el.clientHeight / 2),
      behavior: 'smooth',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerTokenId, tokens])

  return (
    <div
      ref={containerRef}
      // inline-block, not the block-level default: the container must
      // shrink to the grid's actual pixel size when that's narrower than
      // the page (a small room), not stretch full-width and leave the
      // leftover space as flat unstyled background past the terrain/grid.
      // max-w-full + overflow-auto still let it scroll when the grid (the
      // overworld) is the wider one.
      className="relative inline-block max-h-[70vh] max-w-full overflow-auto rounded-lg border border-ink-700 bg-[#1a2e22] align-top"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDeselect()
      }}
    >
      <div className="relative" style={{ width, height }}>
        <HexTerrain
          seed={mapId}
          descriptionText={terrainText}
          forceOutdoor={forceOutdoorTerrain}
          width={width}
          height={height}
        />

        {/* Square token-snap grid, drawn as its own layer so it stays
            legible over the terrain instead of being painted behind it. */}
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{
            width,
            height,
            backgroundImage:
              'linear-gradient(to right, rgba(245,236,217,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,236,217,0.12) 1px, transparent 1px)',
            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
          }}
        />

        <svg width={width} height={height} className="pointer-events-none absolute left-0 top-0">
          {edges.map((edge) => {
            const from = tokenById.get(edge.fromTokenId)
            const to = tokenById.get(edge.toTokenId)
            if (!from || !to) return null
            const a = center(from)
            const b = center(to)
            return (
              <line
                key={edge.id}
                x1={a.cx}
                y1={a.cy}
                x2={b.cx}
                y2={b.cy}
                stroke="#e6926f"
                strokeWidth={3}
                strokeDasharray="2 8"
                strokeLinecap="round"
                opacity={0.7}
              />
            )
          })}
        </svg>

        {tokens.map((token) => (
          <TokenView
            key={token.id}
            token={token}
            selected={token.id === selectedTokenId}
            draggable={canDrag(token)}
            onActivate={() => onActivate(token)}
            onDrop={(x, y) => onDrop(token, x, y)}
          />
        ))}
      </div>
    </div>
  )
}

function TokenView({
  token,
  selected,
  draggable,
  onActivate,
  onDrop,
}: {
  token: MapToken
  selected: boolean
  draggable: boolean
  onActivate: () => void
  onDrop: (x: number, y: number) => void
}) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    movedRef.current = false
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointerStartRef.current) return
    const dx = e.clientX - pointerStartRef.current.x
    const dy = e.clientY - pointerStartRef.current.y
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) movedRef.current = true
    if (draggable && movedRef.current) setDragOffset({ dx, dy })
  }

  function onPointerUp() {
    if (!pointerStartRef.current) return
    if (movedRef.current) {
      if (draggable && dragOffset) {
        const newX = token.x + Math.round(dragOffset.dx / CELL_SIZE)
        const newY = token.y + Math.round(dragOffset.dy / CELL_SIZE)
        onDrop(newX, newY)
      }
    } else {
      // A clean click (no meaningful movement) — always activates, even for
      // tokens the current viewer can't drag, so players can still click a
      // location pin or an NPC to look at it.
      onActivate()
    }
    pointerStartRef.current = null
    setDragOffset(null)
  }

  const left = token.x * CELL_SIZE + (dragOffset?.dx ?? 0)
  const top = token.y * CELL_SIZE + (dragOffset?.dy ?? 0)

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute flex items-center justify-center rounded-full border-2 text-base shadow-md transition-transform ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${selected ? 'border-ember-400 ring-2 ring-ember-400/60' : 'border-ink-950/60'} ${
        !token.visibleToPlayers ? 'opacity-60 [border-style:dashed]' : ''
      }`}
      style={{
        left,
        top,
        width: CELL_SIZE - 4,
        height: CELL_SIZE - 4,
        backgroundColor: token.color,
        touchAction: 'none',
      }}
      title={token.label}
    >
      {token.icon}
    </div>
  )
}
