import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function PageHeader({
  title,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-8 flex flex-wrap items-start justify-between gap-x-4 gap-y-3', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ember-400">{eyebrow}</p>}
        <h1 className="font-display text-2xl text-parchment-100 sm:text-3xl">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  )
}
