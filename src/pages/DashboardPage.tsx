import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth, signOutUser } from '@/hooks/useAuth'
import { useCampaigns, createCampaign } from '@/hooks/useCampaigns'
import type { RpgSystem } from '@/types/firestore'
import { useUiStore } from '@/store/useUiStore'

const SYSTEMS: RpgSystem[] = ['D&D 5e', 'Pathfinder 2e', 'Call of Cthulhu', 'Blades in the Dark', 'Custom / Homebrew']

export function DashboardPage() {
  const { user } = useAuth()
  const { campaigns, loading } = useCampaigns(user?.uid ?? null)
  const [name, setName] = useState('')
  const [system, setSystem] = useState<RpgSystem>('D&D 5e')
  const [description, setDescription] = useState('')
  const pushToast = useUiStore((s) => s.pushToast)
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: () => createCampaign({ name, system, description, gmId: user!.uid }),
    onSuccess: () => {
      setName('')
      setDescription('')
      pushToast('Campaign created.', 'success')
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
    onError: () => pushToast('Could not create campaign.', 'error'),
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-parchment-100">Your Campaigns</h1>
          <p className="text-sm text-parchment-200/60">{user?.displayName}</p>
        </div>
        <button
          onClick={() => signOutUser()}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-parchment-200/70 hover:bg-ink-800"
        >
          Sign out
        </button>
      </header>

      <section className="mb-10 rounded-xl border border-ink-700 bg-ink-900 p-5">
        <h2 className="mb-3 font-display text-lg text-parchment-100">Start a new campaign</h2>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim() || !user) return
            createMutation.mutate()
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name (e.g. The Sunken Spire)"
            className="rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
          />
          <div className="flex gap-3">
            <select
              value={system}
              onChange={(e) => setSystem(e.target.value as RpgSystem)}
              className="rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
            >
              {SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One-line pitch (optional)"
              className="flex-1 rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending || !name.trim()}
            className="self-start rounded-md bg-ember-500 px-4 py-2 text-sm font-medium text-ink-950 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create campaign'}
          </button>
        </form>
      </section>

      <section>
        {loading && <p className="text-parchment-200/60">Loading…</p>}
        {!loading && campaigns.length === 0 && (
          <p className="text-parchment-200/60">No campaigns yet — start one above.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              to={`/campaign/${c.id}`}
              className="rounded-xl border border-ink-700 bg-ink-900 p-4 transition hover:border-ember-500/50"
            >
              <h3 className="font-display text-lg text-parchment-100">{c.name}</h3>
              <p className="text-xs uppercase tracking-wide text-ember-400">{c.system}</p>
              {c.description && <p className="mt-2 text-sm text-parchment-200/70">{c.description}</p>}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
