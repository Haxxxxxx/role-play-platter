import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useCampaigns, createCampaign } from '@/hooks/useCampaigns'
import type { Profile } from '@/hooks/useProfiles'
import { InvitePicker } from '@/components/InvitePicker'
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_BADGE_CLASS } from '@/lib/campaignStatus'
import type { Campaign, RpgSystem } from '@/types/database'
import { useUiStore } from '@/store/useUiStore'

const SYSTEMS: RpgSystem[] = [
  'Chroniques Oubliées',
  'D&D 5e',
  'Pathfinder 2e',
  'Call of Cthulhu',
  'Blades in the Dark',
  'Custom / Homebrew',
]

export function DashboardPage() {
  const { user } = useAuth()
  const { campaigns, loading } = useCampaigns(user?.id ?? null)
  const [name, setName] = useState('')
  const [system, setSystem] = useState<RpgSystem>('Chroniques Oubliées')
  const [description, setDescription] = useState('')
  const [invitees, setInvitees] = useState<Profile[]>([])
  const pushToast = useUiStore((s) => s.pushToast)
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: () =>
      createCampaign({ name, system, description, gmId: user!.id, inviteUserIds: invitees.map((p) => p.id) }),
    onSuccess: () => {
      setName('')
      setDescription('')
      setInvitees([])
      pushToast('Campaign created.', 'success')
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
    onError: () => pushToast('Could not create campaign.', 'error'),
  })

  function copyInviteLink(campaignId: string) {
    const url = `${window.location.origin}/campaign/${campaignId}/join`
    navigator.clipboard
      .writeText(url)
      .then(() => pushToast("Lien d'invitation copié.", 'success'))
      .catch(() => pushToast('Impossible de copier le lien.', 'error'))
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl text-parchment-100">Your Campaigns</h1>
        <Link
          to="/profile"
          className="flex items-center gap-2 rounded-md border border-ink-700 px-3 py-1.5 text-sm text-parchment-200/70 hover:bg-ink-800"
        >
          👤 Profile
          {user?.is_anonymous && (
            <span className="rounded-full border border-arcane-500/50 px-1.5 py-0.5 text-[10px] uppercase text-arcane-500">
              Guest
            </span>
          )}
        </Link>
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
            placeholder="Campaign name (ex. La Malédiction de Kaer Doreth)"
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

          <InvitePicker
            excludeUserId={user?.id}
            invitees={invitees}
            onAdd={(profile) => setInvitees((prev) => [...prev, profile])}
            onRemove={(id) => setInvitees((prev) => prev.filter((p) => p.id !== id))}
          />

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
            <CampaignCard key={c.id} campaign={c} isGm={c.gmId === user?.id} onCopyInvite={() => copyInviteLink(c.id)} />
          ))}
        </div>
      </section>
    </div>
  )
}

function CampaignCard({ campaign, isGm, onCopyInvite }: { campaign: Campaign; isGm: boolean; onCopyInvite: () => void }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 transition hover:border-ember-500/50">
      <Link to={`/campaign/${campaign.id}`} className="block">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg text-parchment-100">{campaign.name}</h3>
          {isGm && (
            <span className="rounded-full border border-ember-500/40 px-1.5 py-0.5 text-[10px] uppercase text-ember-400">
              MJ
            </span>
          )}
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase ${CAMPAIGN_STATUS_BADGE_CLASS[campaign.status]}`}
          >
            {CAMPAIGN_STATUS_LABEL[campaign.status]}
          </span>
        </div>
        <p className="text-xs uppercase tracking-wide text-ember-400">{campaign.system}</p>
        {campaign.description && <p className="mt-2 text-sm text-parchment-200/70">{campaign.description}</p>}
      </Link>
      {isGm && (
        <button
          onClick={(e) => {
            e.preventDefault()
            onCopyInvite()
          }}
          className="mt-3 text-xs text-parchment-200/50 hover:text-ember-400"
        >
          🔗 Copier le lien d'invitation
        </button>
      )}
    </div>
  )
}
