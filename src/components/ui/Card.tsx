import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({
  interactive = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-ink-700 bg-ink-900 p-5',
        interactive && 'transition hover:border-ember-500/50',
        className,
      )}
      {...props}
    />
  )
}
