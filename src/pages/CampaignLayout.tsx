import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCampaign } from '@/hooks/useCampaigns'

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
            </div>
            <p className="text-xs uppercase tracking-wide text-ember-400">{campaign.system}</p>
          </div>
          <NavLink to="/" className="text-sm text-parchment-200/60 hover:text-parchment-100">
            ← All campaigns
          </NavLink>
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
