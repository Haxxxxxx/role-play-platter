import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useCampaign, updateCampaignStatus } from '@/hooks/useCampaigns'
import { useUiStore } from '@/store/useUiStore'
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_BADGE_CLASS } from '@/lib/campaignStatus'
import type { CampaignStatus } from '@/types/database'

const ALL_TABS = [
  { to: '', label: 'Chronicle', end: true, gmOnly: false },
  { to: 'notes', label: 'GM Notes', end: false, gmOnly: true },
  { to: 'party', label: 'Party', end: false, gmOnly: false },
  { to: 'map', label: 'Battle Map', end: false, gmOnly: false },
]

export function CampaignLayout() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { campaign, loading } = useCampaign(campaignId)
  const { user } = useAuth()
  const pushToast = useUiStore((s) => s.pushToast)

  const statusMutation = useMutation({
    mutationFn: (status: CampaignStatus) => updateCampaignStatus(campaignId!, status),
    onError: () => pushToast('Impossible de changer le statut de la campagne.', 'error'),
  })

  if (loading) return <div className="p-10 text-parchment-200/60">Loading campaign…</div>
  if (!campaign) return <div className="p-10 text-parchment-200/60">Campaign not found.</div>

  const isGm = user?.id === campaign.gmId
  const tabs = ALL_TABS.filter((tab) => !tab.gmOnly || isGm)

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900/60 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl text-parchment-100">{campaign.name}</h1>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                  isGm ? 'border-ember-500/50 text-ember-400' : 'border-ink-700 text-parchment-200/50'
                }`}
              >
                {isGm ? 'MJ' : 'Joueur'}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${CAMPAIGN_STATUS_BADGE_CLASS[campaign.status]}`}
              >
                {CAMPAIGN_STATUS_LABEL[campaign.status]}
              </span>
            </div>
            <p className="text-xs uppercase tracking-wide text-ember-400">{campaign.system}</p>
          </div>
          <div className="flex items-center gap-3">
            {isGm && campaign.status === 'setup' && (
              <button
                onClick={() => statusMutation.mutate('active')}
                disabled={statusMutation.isPending}
                className="rounded-md bg-ember-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-ember-400 disabled:opacity-50"
              >
                ▶ Démarrer la campagne
              </button>
            )}
            {isGm && campaign.status === 'active' && (
              <button
                onClick={() => statusMutation.mutate('completed')}
                disabled={statusMutation.isPending}
                className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-parchment-200/70 hover:bg-ink-800 disabled:opacity-50"
              >
                ✓ Terminer la campagne
              </button>
            )}
            {isGm && campaign.status === 'completed' && (
              <button
                onClick={() => statusMutation.mutate('active')}
                disabled={statusMutation.isPending}
                className="text-xs text-parchment-200/40 hover:text-parchment-100 disabled:opacity-50"
              >
                ↺ Reprendre la campagne
              </button>
            )}
            <NavLink to="/" className="text-sm text-parchment-200/60 hover:text-parchment-100">
              ← All campaigns
            </NavLink>
          </div>
        </div>
        <nav className="mx-auto mt-4 flex max-w-5xl gap-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `rounded-t-md px-4 py-2 text-sm ${
                  isActive
                    ? 'bg-ink-950 text-ember-400'
                    : 'text-parchment-200/60 hover:text-parchment-100'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet context={{ campaign }} />
      </main>
    </div>
  )
}
