import type { ReactNode } from 'react'

export function EmptyState({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center">
      <p className="text-sm text-parchment-300">{title}</p>
      {description && <p className="mt-1 text-xs text-parchment-400">{description}</p>}
    </div>
  )
}
