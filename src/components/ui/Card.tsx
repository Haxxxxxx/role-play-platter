import type { ElementType, HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const PADDING_CLASSES = {
  sm: 'p-3',
  md: 'p-5',
} as const

export function Card({
  as: Tag = 'div',
  interactive = false,
  padding = 'md',
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  /** Render as a different element (e.g. "section") when the surrounding
   * markup needs the landmark semantics — a plain div otherwise. */
  as?: ElementType
  interactive?: boolean
  padding?: keyof typeof PADDING_CLASSES
}) {
  return (
    <Tag
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
