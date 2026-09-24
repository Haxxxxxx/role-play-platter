import type { ReactNode } from 'react'
import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/cn'

export function MapViewHeader({
  title,
  isGm,
  isFullscreen,
  onToggleFullscreen,
  className = 'mb-4',
}: {
  title: ReactNode
  isGm: boolean
  isFullscreen: boolean
  onToggleFullscreen: () => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2', className)}>
      <h2 className="font-display text-xl text-parchment-100">{title}</h2>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={isGm ? 'ember' : 'neutral'}>{isGm ? 'Vue MJ — éditable' : 'Vue joueur'}</Badge>
        <Button
          variant="secondary"
          size="xs"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        >
          {isFullscreen ? '⤢ Quitter' : '⛶ Plein écran'}
        </Button>
      </div>
    </div>
  )
}
