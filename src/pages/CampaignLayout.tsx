import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useCampaign } from '@/hooks/useCampaigns'

const TABS = [
  { to: '', label: 'Chronicle', end: true },
  { to: 'notes', label: 'GM Notes' },
  { to: 'party', label: 'Party' },
  { to: 'map', label: 'Battle Map' },
]

export function CampaignLayout() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { campaign, loading } = useCampaign(campaignId)

  if (loading) return <div className="p-10 text-parchment-200/60">Loading campaign…</div>
  if (!campaign) return <div className="p-10 text-parchment-200/60">Campaign not found.</div>

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-700 bg-ink-900/60 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-parchment-100">{campaign.name}</h1>
            <p className="text-xs uppercase tracking-wide text-ember-400">{campaign.system}</p>
          </div>
          <NavLink to="/" className="text-sm text-parchment-200/60 hover:text-parchment-100">
            ← All campaigns
          </NavLink>
        </div>
        <nav className="mx-auto mt-4 flex max-w-5xl gap-1">
          {TABS.map((tab) => (
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
