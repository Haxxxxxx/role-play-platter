import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const PADDING_CLASSES = {
  sm: 'p-3',
  md: 'p-5',
} as const

export function Card({
  interactive = false,
  padding = 'md',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; padding?: keyof typeof PADDING_CLASSES }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-ink-700 bg-ink-900',
        PADDING_CLASSES[padding],
        interactive && 'transition hover:border-ember-500/50',
        className,
      )}
      {...props}
    />
  )
}
