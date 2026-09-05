import { useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { createCharacter, useParty } from '@/hooks/useParty'
import { findTokenLocation } from '@/hooks/useBattleMap'
import { useCampaignMembers, inviteMemberToCampaign, removeCampaignMember, type CampaignMember } from '@/hooks/useCampaigns'
import { InvitePicker } from '@/components/InvitePicker'
import type { Profile } from '@/hooks/useProfiles'
import { useUiStore } from '@/store/useUiStore'
import type { Campaign, Character } from '@/types/database'

export function PartyPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { campaign } = useOutletContext<{ campaign: Campaign }>()
  const { user } = useAuth()
  const { data: party, loading } = useParty(campaignId)
  const [showForm, setShowForm] = useState(false)
  const navigate = useNavigate()
  const pushToast = useUiStore((s) => s.pushToast)
  const isGm = user?.id === campaign.gmId

  async function openOnMap(character: Character) {
    if (!campaignId) return
    const match = await findTokenLocation({ campaignId, refCharacterId: character.id })
    if (!match) {
      pushToast(`${character.name} n'est pas encore placé sur la carte.`, 'info')
      return
    }
    const path = match.locationId ? `/campaign/${campaignId}/map/${match.locationId}` : `/campaign/${campaignId}/map`
    navigate(path, { state: { centerTokenId: match.tokenId } })
  }

  return (
    <div>
      {isGm && campaignId && <RosterSection campaignId={campaignId} gmId={campaign.gmId} />}

      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl text-parchment-100">Groupe</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-parchment-200/70 hover:bg-ink-800"
        >
          {showForm ? 'Annuler' : '+ Ajouter un personnage'}
        </button>
      </div>

      {showForm && campaignId && (
        <NewCharacterForm
          campaignId={campaignId}
          ownerId={user?.id ?? null}
          onDone={() => setShowForm(false)}
        />
      )}

      {loading && <p className="text-parchment-200/60">Chargement…</p>}
      {!loading && party.length === 0 && !showForm && (
        <p className="text-sm text-parchment-200/60">Aucun personnage pour l'instant — ajoutez-en un ci-dessus.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {party.map((character) => (
          <CharacterSheet key={character.id} character={character} onOpenOnMap={() => openOnMap(character)} />
        ))}
      </div>
    </div>
  )
}

/**
 * GM-only roster management — invite known users onto the campaign and see
 * who's already in, any time after creation (not just at the create-form
 * step). Backed by the same "gm invites known users" / "gm removes members"
 * RLS policies as campaign creation, just called on demand.
 */
function RosterSection({ campaignId, gmId }: { campaignId: string; gmId: string }) {
  const { members, loading } = useCampaignMembers(campaignId)
  const pushToast = useUiStore((s) => s.pushToast)
  const queryClient = useQueryClient()

  const inviteMutation = useMutation({
    mutationFn: (userId: string) => inviteMemberToCampaign(campaignId, userId),
    onSuccess: () => {
      pushToast('Joueur invité.', 'success')
      queryClient.invalidateQueries({ queryKey: ['campaign_members', campaignId] })
    },
    onError: () => pushToast("Impossible d'inviter ce joueur.", 'error'),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeCampaignMember(campaignId, userId),
    onError: () => pushToast('Impossible de retirer ce joueur.', 'error'),
  })

  function copyInviteLink() {
    const url = `${window.location.origin}/campaign/${campaignId}/join`
    navigator.clipboard
      .writeText(url)
      .then(() => pushToast("Lien d'invitation copié.", 'success'))
      .catch(() => pushToast('Impossible de copier le lien.', 'error'))
  }

  const alreadyInvited = members.map((m) => m.userId)

  return (
    <section className="mb-8 rounded-xl border border-ink-700 bg-ink-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-parchment-100">Participants</h3>
        <button onClick={copyInviteLink} className="text-xs text-parchment-200/50 hover:text-ember-400">
          🔗 Copier le lien d'invitation
        </button>
      </div>

      {!loading && members.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1.5">
          {members.map((m) => (
            <RosterRow
              key={m.userId}
              member={m}
              canRemove={m.role === 'player'}
              onRemove={() => removeMutation.mutate(m.userId)}
            />
          ))}
        </ul>
      )}

      <InvitePicker
        excludeUserId={gmId}
        invitees={members.filter((m): m is CampaignMember & { profile: Profile } => m.profile != null).map((m) => m.profile)}
        hideChips
        onAdd={(profile) => {
          if (alreadyInvited.includes(profile.id)) return
          inviteMutation.mutate(profile.id)
        }}
        onRemove={() => {}}
      />
    </section>
  )
}

function RosterRow({ member, canRemove, onRemove }: { member: CampaignMember; canRemove: boolean; onRemove: () => void }) {
  const label = member.profile?.displayName ?? member.profile?.email ?? 'Joueur sans profil'
  return (
    <li className="flex items-center justify-between gap-2 rounded-md bg-ink-800 px-3 py-1.5 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        {member.profile?.avatarUrl && (
          <img src={member.profile.avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full" />
        )}
        <span className="truncate text-parchment-100">{label}</span>
        {member.role === 'gm' && (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-ember-500/40 px-1.5 py-0.5 text-[10px] uppercase text-ember-400">
            MJ
          </span>
        )}
      </span>
      {canRemove && (
        <button onClick={onRemove} className="shrink-0 whitespace-nowrap text-xs text-parchment-200/40 hover:text-red-400">
          Retirer
        </button>
      )}
    </li>
  )
}

function NewCharacterForm({
  campaignId,
  ownerId,
  onDone,
}: {
  campaignId: string
  ownerId: string | null
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [classAndLevel, setClassAndLevel] = useState('')
  const [race, setRace] = useState('')
  const pushToast = useUiStore((s) => s.pushToast)

  const mutation = useMutation({
    mutationFn: () => createCharacter({ campaignId, name, playerName, ownerId, classAndLevel, race }),
    onSuccess: () => {
      onDone()
      pushToast('Personnage ajouté.', 'success')
    },
  })

  return (
    <form
      className="mb-6 grid gap-3 rounded-xl border border-ink-700 bg-ink-900 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        mutation.mutate()
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du personnage (ex. Elyne)"
        className="rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
      />
      <input
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Nom du joueur"
        className="rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
      />
      <input
        value={classAndLevel}
        onChange={(e) => setClassAndLevel(e.target.value)}
        placeholder="Classe et niveau (ex. Roublard 3)"
        className="rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
      />
      <input
        value={race}
        onChange={(e) => setRace(e.target.value)}
        placeholder="Peuple (ex. Halfelin, Nain, Elfe)"
        className="rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
      />
      <button
        type="submit"
        disabled={mutation.isPending || !name.trim()}
        className="self-start rounded-md bg-ember-500 px-4 py-2 text-sm font-medium text-ink-950 disabled:opacity-50 sm:col-span-2"
      >
        {mutation.isPending ? 'Ajout…' : 'Ajouter au groupe'}
      </button>
    </form>
  )
}

function CharacterSheet({ character, onOpenOnMap }: { character: Character; onOpenOnMap: () => void }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg text-parchment-100">{character.name}</h3>
        <span className="text-xs text-parchment-200/50">{character.playerName}</span>
      </div>
      <p className="text-sm text-ember-400">
        {character.classAndLevel} · {character.race}
      </p>
      <div className="mt-3 flex gap-4 text-sm">
        <span>
          PV <strong className="text-parchment-100">{character.hp.current}/{character.hp.max}</strong>
        </span>
        <span>
          CA <strong className="text-parchment-100">{character.armorClass}</strong>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-1 text-center text-xs">
        {Object.entries(character.abilityScores).map(([key, value]) => (
          <div key={key} className="rounded bg-ink-800 py-1">
            <div className="uppercase text-parchment-200/50">{key}</div>
            <div className="font-medium text-parchment-100">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <h4 className="mb-1 text-xs uppercase tracking-wide text-parchment-200/50">Inventaire</h4>
        {character.inventory.length === 0 ? (
          <p className="text-sm text-parchment-200/40">Vide — les objets arrivent ici automatiquement depuis les notes du MJ.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {character.inventory.map((item) => (
              <li key={item.id} className="flex justify-between text-parchment-200/80">
                <span>
                  {item.name} {item.quantity > 1 && `×${item.quantity}`}
                </span>
                {item.equipped && <span className="text-xs text-arcane-500">équipé</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={onOpenOnMap}
        className="mt-4 w-full rounded-md border border-ink-700 py-1.5 text-xs text-parchment-200/60 hover:border-ember-500/50 hover:text-ember-400"
      >
        📍 Voir sur la carte
      </button>
    </div>
  )
}
