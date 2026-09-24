import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type BadgeVariant = 'neutral' | 'ember' | 'arcane' | 'success' | 'danger' | 'info'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'border-ink-700 text-parchment-300',
  ember: 'border-ember-500/50 text-ember-400',
  arcane: 'border-arcane-500/50 text-arcane-400',
  success: 'border-emerald-500/50 text-emerald-400',
  danger: 'border-red-500/50 text-red-400',
  info: 'border-blue-500/50 text-blue-400',
}

export function Badge({
  variant = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  )
}
