import { useEffect, useState } from 'react'
import { searchProfiles, type Profile } from '@/hooks/useProfiles'

/**
 * Search-and-pick UI for adding known users (people who've signed in at
 * least once) to something — a campaign being created, or an existing one's
 * roster. Purely presentational selection state; the caller decides what
 * "add" means (queue for creation, or insert into campaign_members right
 * away).
 */
export function InvitePicker({
  excludeUserId,
  invitees,
  onAdd,
  onRemove,
  hideChips = false,
}: {
  excludeUserId: string | undefined
  invitees: Profile[]
  onAdd: (profile: Profile) => void
  onRemove: (id: string) => void
  /** Still uses `invitees` to exclude already-added people from search
   * results, but skips rendering them as removable chips — for callers
   * (like an existing campaign's roster) that already show that list
   * themselves, in their own shape, with their own remove affordance. */
  hideChips?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) {
      // Resetting to the disabled state, not reacting to an external event.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timeout = setTimeout(() => {
      searchProfiles(query, excludeUserId)
        .then((found) => {
          if (!cancelled) setResults(found.filter((p) => !invitees.some((i) => i.id === p.id)))
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, excludeUserId])

  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-parchment-400">
        Inviter des joueurs (optionnel)
      </label>
      {!hideChips && invitees.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {invitees.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1.5 rounded-full border border-ember-500/40 bg-ember-500/10 py-1 pl-2.5 pr-1.5 text-xs text-ember-400"
            >
              {p.displayName ?? p.email ?? 'Joueur'}
              <button type="button" onClick={() => onRemove(p.id)} className="hover:text-parchment-100">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher par email…"
          className="w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
        />
        {query.trim().length >= 2 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-ink-700 bg-ink-950 shadow-lg">
            {searching && <p className="px-3 py-2 text-xs text-parchment-400">Recherche…</p>}
            {!searching && results.length === 0 && (
              <p className="px-3 py-2 text-xs text-parchment-400">
                Personne trouvé — ils devront rejoindre via le lien d'invitation.
              </p>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onAdd(p)
                  setQuery('')
                  setResults([])
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink-800"
              >
                {p.avatarUrl && <img src={p.avatarUrl} alt="" className="h-5 w-5 rounded-full" />}
                <span className="text-parchment-100">{p.displayName ?? 'Sans nom'}</span>
                {p.email && <span className="text-xs text-parchment-400">{p.email}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
