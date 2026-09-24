import type { MapToken } from '@/types/database'

/**
 * The panel under the grid for whatever token is selected. The GM gets the
 * editable version — a "contenu / secret" field (what the token hides:
 * loot, a trap's effect, a bonus) and a show/hide toggle. A player gets a
 * read-only version, and only when the token actually carries content
 * they're meant to see (it's already gated by RLS, so if a player has the
 * content at all, the token is revealed).
 */
export function SelectedTokenToolbar({
  token,
  isGm,
  onDelete,
  onToggleVisibility,
  onContentChange,
}: {
  token: MapToken
  isGm: boolean
  onDelete: () => void
  onToggleVisibility: () => void
  onContentChange: (content: string) => void
}) {
  if (!isGm) {
    if (!token.content) return null
    return (
      <div className="mt-3 rounded-lg border border-ember-500/40 bg-ink-900 p-3 text-sm">
        <div className="mb-1 text-parchment-100">
          {token.icon} {token.label}
        </div>
        <p className="text-parchment-200">{token.content}</p>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-ember-500/40 bg-ink-900 p-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-parchment-100">
          {token.icon} {token.label}
        </span>
        <button
          onClick={onToggleVisibility}
          className="rounded-md border border-ink-700 px-2 py-1 text-xs text-parchment-300 hover:bg-ink-800"
        >
          {token.visibleToPlayers ? '👁 Visible des joueurs' : '🙈 Caché des joueurs'}
        </button>
        <button
          onClick={onDelete}
          className="ml-auto rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
        >
          Supprimer
        </button>
      </div>
      <label className="mt-2 block text-[10px] font-medium uppercase tracking-wider text-parchment-400">
        Contenu / secret {!token.visibleToPlayers && '— caché tant que le pion l\'est'}
      </label>
      <input
        defaultValue={token.content}
        onBlur={(e) => e.target.value !== token.content && onContentChange(e.target.value)}
        placeholder="ex. Coffre : épée longue +1 et 40 pa — ou : Piège à fléchettes, DEX SD 13 ou 2d6"
        className="mt-1 w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm outline-none focus:border-ember-500"
      />
    </div>
  )
}
