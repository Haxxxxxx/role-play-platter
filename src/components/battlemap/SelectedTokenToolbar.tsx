import type { MapToken } from '@/types/database'

export function SelectedTokenToolbar({
  token,
  onDelete,
  onToggleVisibility,
}: {
  token: MapToken
  onDelete: () => void
  onToggleVisibility: () => void
}) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-ember-500/40 bg-ink-900 p-3 text-sm">
      <span className="text-parchment-100">
        {token.icon} {token.label}
      </span>
      {(token.kind === 'npc' || token.kind === 'monster') && (
        <button
          onClick={onToggleVisibility}
          className="rounded-md border border-ink-700 px-2 py-1 text-xs text-parchment-200/70 hover:bg-ink-800"
        >
          {token.visibleToPlayers ? '👁 Visible des joueurs' : '🙈 Caché des joueurs'}
        </button>
      )}
      <button
        onClick={onDelete}
        className="ml-auto rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
      >
        Supprimer
      </button>
    </div>
  )
}
