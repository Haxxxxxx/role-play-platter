import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useCampaigns, createCampaign } from '@/hooks/useCampaigns'
import type { Profile } from '@/hooks/useProfiles'
import { InvitePicker } from '@/components/InvitePicker'
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_BADGE_VARIANT } from '@/lib/campaignStatus'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from '@/components/ui'
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
      pushToast('Campagne créée.', 'success')
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
    onError: () => pushToast('Impossible de créer la campagne.', 'error'),
  })

  function copyInviteLink(campaignId: string) {
    const url = `${window.location.origin}/campaign/${campaignId}/join`
    navigator.clipboard
      .writeText(url)
      .then(() => pushToast("Lien d'invitation copié.", 'success'))
      .catch(() => pushToast('Impossible de copier le lien.', 'error'))
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <PageHeader
        title="Vos campagnes"
        actions={
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 rounded-md border border-ink-700 px-3 py-1.5 text-sm text-parchment-300 transition hover:bg-ink-800"
          >
            👤 Profil
            {user?.is_anonymous && <Badge variant="arcane">Invité</Badge>}
          </Link>
        }
      />

      <Card className="mb-10">
        <h2 className="mb-3 font-display text-lg text-parchment-100">Démarrer une nouvelle campagne</h2>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim() || !user) return
            createMutation.mutate()
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la campagne (ex. La Malédiction de Kaer Doreth)"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select
              value={system}
              onChange={(e) => setSystem(e.target.value as RpgSystem)}
              className="sm:w-56"
            >
              {SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pitch en une ligne (optionnel)"
              className="flex-1"
            />
          </div>

          <InvitePicker
            excludeUserId={user?.id}
            invitees={invitees}
            onAdd={(profile) => setInvitees((prev) => [...prev, profile])}
            onRemove={(id) => setInvitees((prev) => prev.filter((p) => p.id !== id))}
          />

          <Button type="submit" disabled={createMutation.isPending || !name.trim()} className="self-start">
            {createMutation.isPending ? 'Création…' : 'Créer la campagne'}
          </Button>
        </form>
      </Card>

      <section>
        {loading && <p className="text-parchment-300">Chargement…</p>}
        {!loading && campaigns.length === 0 && (
          <EmptyState
            title="Aucune campagne pour le moment"
            description="Créez-en une ci-dessus pour commencer."
          />
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
    <Card interactive padding="sm">
      <Link to={`/campaign/${campaign.id}`} className="block">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg text-parchment-100">{campaign.name}</h3>
          {isGm && <Badge variant="ember">MJ</Badge>}
          <Badge variant={CAMPAIGN_STATUS_BADGE_VARIANT[campaign.status]}>
            {CAMPAIGN_STATUS_LABEL[campaign.status]}
          </Badge>
        </div>
        <p className="text-xs uppercase tracking-wide text-ember-400">{campaign.system}</p>
        {campaign.description && <p className="mt-2 text-sm text-parchment-300">{campaign.description}</p>}
      </Link>
      {isGm && (
        <button
          onClick={(e) => {
            e.preventDefault()
            onCopyInvite()
          }}
          className="mt-3 text-xs text-parchment-400 transition hover:text-ember-400"
        >
          🔗 Copier le lien d'invitation
        </button>
      )}
    </Card>
  )
}
