import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useCampaign, updateCampaignStatus } from '@/hooks/useCampaigns'
import { useUiStore } from '@/store/useUiStore'
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_BADGE_VARIANT } from '@/lib/campaignStatus'
import { Badge, Button } from '@/components/ui'
import type { CampaignStatus } from '@/types/database'

const ALL_TABS = [
  { to: '', label: 'Chronique', end: true, gmOnly: false },
  { to: 'scenario', label: 'Scénario', end: false, gmOnly: true },
  { to: 'notes', label: 'Notes du MJ', end: false, gmOnly: true },
  { to: 'party', label: 'Groupe', end: false, gmOnly: false },
  { to: 'map', label: 'Carte', end: false, gmOnly: false },
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

  if (loading) return <div className="p-10 text-parchment-300">Chargement de la campagne…</div>
  if (!campaign) return <div className="p-10 text-parchment-300">Campagne introuvable.</div>

  const isGm = user?.id === campaign.gmId
  const tabs = ALL_TABS.filter((tab) => !tab.gmOnly || isGm)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <NavLink
              to="/"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm text-parchment-300 transition hover:text-parchment-100"
            >
              <span aria-hidden>←</span> Campagnes
            </NavLink>
            {isGm && campaign.status === 'setup' && (
              <Button size="sm" onClick={() => statusMutation.mutate('active')} disabled={statusMutation.isPending}>
                ▶ Démarrer
              </Button>
            )}
            {isGm && campaign.status === 'active' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => statusMutation.mutate('completed')}
                disabled={statusMutation.isPending}
              >
                ✓ Terminer
              </Button>
            )}
            {isGm && campaign.status === 'completed' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => statusMutation.mutate('active')}
                disabled={statusMutation.isPending}
              >
                ↺ Reprendre
              </Button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate font-display text-xl text-parchment-100 sm:text-2xl">{campaign.name}</h1>
            <Badge variant={isGm ? 'ember' : 'neutral'}>{isGm ? 'MJ' : 'Joueur'}</Badge>
            <Badge variant={CAMPAIGN_STATUS_BADGE_VARIANT[campaign.status]}>
              {CAMPAIGN_STATUS_LABEL[campaign.status]}
            </Badge>
          </div>
          <p className="mt-0.5 pb-4 text-xs uppercase tracking-wide text-ember-400">{campaign.system}</p>
        </div>

        <nav className="scrollbar-none mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
          {tabs.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `shrink-0 whitespace-nowrap rounded-t-md px-4 py-2 text-sm transition ${
                  isActive ? 'bg-ink-900 text-ember-400' : 'text-parchment-300 hover:text-parchment-100'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet context={{ campaign }} />
      </main>
    </div>
  )
}
