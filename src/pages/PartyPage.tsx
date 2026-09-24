import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { createCharacter, useParty } from '@/hooks/useParty'
import { useCampaignMembers, inviteMemberToCampaign, removeCampaignMember, type CampaignMember } from '@/hooks/useCampaigns'
import { useSystemReference, generateSystemReference, type SystemReferenceState } from '@/hooks/useSystemReference'
import { InvitePicker } from '@/components/InvitePicker'
import type { Profile } from '@/hooks/useProfiles'
import { useUiStore } from '@/store/useUiStore'
import { Badge, Button, Card, EmptyState, Input } from '@/components/ui'
import type { AbilityScores, Campaign, Character } from '@/types/database'

const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  str: 'FOR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'SAG', cha: 'CHA',
}

export function PartyPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { campaign } = useOutletContext<{ campaign: Campaign }>()
  const { user } = useAuth()
  const { data: party, loading } = useParty(campaignId)
  const { reference } = useSystemReference(campaignId)
  const [showForm, setShowForm] = useState(false)
  const isGm = user?.id === campaign.gmId

  return (
    <div>
      {isGm && campaignId && <RosterSection campaignId={campaignId} gmId={campaign.gmId} />}
      {isGm && campaignId && <SystemReferenceSection campaignId={campaignId} reference={reference} />}

      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl text-parchment-100">Groupe</h2>
        <Button variant="secondary" size="sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Annuler' : '+ Ajouter un personnage'}
        </Button>
      </div>

      {showForm && campaignId && (
        <NewCharacterForm
          campaignId={campaignId}
          ownerId={user?.id ?? null}
          reference={reference}
          onDone={() => setShowForm(false)}
        />
      )}

      {loading && <p className="text-parchment-300">Chargement…</p>}
      {!loading && party.length === 0 && !showForm && (
        <EmptyState title="Aucun personnage pour l'instant" description="Ajoutez-en un ci-dessus." />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {party.map((character) => (
          <CharacterSummaryCard key={character.id} campaignId={campaignId!} character={character} />
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
    <Card className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-parchment-100">Participants</h3>
        <button onClick={copyInviteLink} className="text-xs text-parchment-300 hover:text-ember-400">
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
    </Card>
  )
}

/**
 * GM-only, one call per campaign (cached in system_reference, re-run to
 * regenerate): asks Gemini for a genre-appropriate class/skill list for
 * whatever system the GM named, so character creation isn't a blank page.
 * Original content, not a transcription of a rulebook — see the system
 * instruction in generate-system-reference.ts.
 */
function SystemReferenceSection({
  campaignId,
  reference,
}: {
  campaignId: string
  reference: SystemReferenceState | null
}) {
  const pushToast = useUiStore((s) => s.pushToast)
  const [expanded, setExpanded] = useState(false)

  const mutation = useMutation({
    mutationFn: () => generateSystemReference(campaignId),
    onSuccess: () => pushToast('Référence du système générée.', 'success'),
    onError: (error: Error) => pushToast(error.message, 'error'),
  })

  return (
    <Card className="mb-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-parchment-100">Référence du système</h3>
          <p className="text-xs text-parchment-300">
            {reference
              ? `${reference.classes.length} classes, ${reference.skills.length} compétences — proposées par Gemini, pas une copie du livre.`
              : "Aucune référence encore — génère des classes et compétences adaptées à ton système pour accélérer la création de personnage."}
          </p>
        </div>
        <Button variant="ai" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="shrink-0 whitespace-nowrap">
          {mutation.isPending ? 'Génération…' : reference ? '🔄 Régénérer' : '🧠 Générer'}
        </Button>
      </div>

      {reference && (
        <button
          onClick={() => setExpanded((s) => !s)}
          className="mt-2 text-xs text-parchment-300 hover:text-ember-400"
        >
          {expanded ? 'Masquer le détail' : 'Voir le détail'}
        </button>
      )}

      {reference && expanded && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-1.5 text-xs uppercase tracking-wide text-parchment-300">Classes</h4>
            <ul className="flex flex-col gap-1 text-sm text-parchment-300">
              {reference.classes.map((c) => (
                <li key={c.name}>
                  <strong className="text-parchment-100">{c.name}</strong> — {c.description}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-1.5 text-xs uppercase tracking-wide text-parchment-300">Compétences</h4>
            <ul className="flex flex-col gap-1 text-sm text-parchment-300">
              {reference.skills.map((s) => (
                <li key={s.name}>
                  <strong className="text-parchment-100">{s.name}</strong> — {s.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
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
        {member.role === 'gm' && <Badge variant="ember">MJ</Badge>}
      </span>
      {canRemove && (
        <button onClick={onRemove} className="shrink-0 whitespace-nowrap text-xs text-parchment-400 hover:text-red-400">
          Retirer
        </button>
      )}
    </li>
  )
}

const BLANK_ABILITY_SCORES: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

function NewCharacterForm({
  campaignId,
  ownerId,
  reference,
  onDone,
}: {
  campaignId: string
  ownerId: string | null
  reference: SystemReferenceState | null
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [classAndLevel, setClassAndLevel] = useState('')
  const [race, setRace] = useState('')
  const [abilityScores, setAbilityScores] = useState<AbilityScores>(BLANK_ABILITY_SCORES)
  const [hpMax, setHpMax] = useState(10)
  const [armorClass, setArmorClass] = useState(10)
  const pushToast = useUiStore((s) => s.pushToast)

  const mutation = useMutation({
    mutationFn: () =>
      createCharacter({ campaignId, name, playerName, ownerId, classAndLevel, race, abilityScores, hpMax, armorClass }),
    onSuccess: () => {
      onDone()
      pushToast('Personnage ajouté.', 'success')
    },
    onError: () => pushToast('Impossible de créer ce personnage.', 'error'),
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
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du personnage (ex. Elyne)" />
      <Input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Nom du joueur" />
      <div>
        <Input
          value={classAndLevel}
          onChange={(e) => setClassAndLevel(e.target.value)}
          placeholder="Classe et niveau (ex. Roublard 3)"
        />
        {reference && reference.classes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {reference.classes.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.description}
                onClick={() => setClassAndLevel(`${c.name} `)}
                className="rounded-full border border-ink-700 px-2 py-0.5 text-xs text-parchment-300 hover:border-arcane-500/50 hover:text-arcane-500"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <Input value={race} onChange={(e) => setRace(e.target.value)} placeholder="Peuple (ex. Halfelin, Nain, Elfe)" />

      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-parchment-400">
          Caractéristiques
        </label>
        <div className="grid grid-cols-6 gap-1.5">
          {(Object.keys(abilityScores) as (keyof AbilityScores)[]).map((key) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase text-parchment-300">{ABILITY_LABELS[key]}</span>
              <input
                type="number"
                value={abilityScores[key]}
                onChange={(e) =>
                  setAbilityScores((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))
                }
                className="w-full rounded-md border border-ink-700 bg-ink-800 px-1.5 py-1 text-center text-sm outline-none focus:border-ember-500"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <label className="flex-1 text-xs text-parchment-300">
          PV max
          <Input
            type="number"
            min={1}
            value={hpMax}
            onChange={(e) => setHpMax(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1"
          />
        </label>
        <label className="flex-1 text-xs text-parchment-300">
          CA
          <Input
            type="number"
            min={0}
            value={armorClass}
            onChange={(e) => setArmorClass(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1"
          />
        </label>
      </div>

      <Button type="submit" disabled={mutation.isPending || !name.trim()} className="self-start sm:col-span-2">
        {mutation.isPending ? 'Ajout…' : 'Ajouter au groupe'}
      </Button>
    </form>
  )
}

/** Compact roster entry — the full sheet (portrait, editable stats,
 * inventory, skills) lives on its own page now, linked from here. */
function CharacterSummaryCard({ campaignId, character }: { campaignId: string; character: Character }) {
  const hpRatio = character.hp.max > 0 ? character.hp.current / character.hp.max : 0
  return (
    <Link
      to={`/campaign/${campaignId}/character/${character.id}`}
      className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 p-4 transition hover:border-ember-500/50"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-ink-700 bg-ink-800">
        {character.portraitUrl ? (
          <img src={character.portraitUrl} alt={character.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-parchment-400">🧑</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate font-display text-lg text-parchment-100">{character.name}</h3>
          <span className="shrink-0 text-xs text-parchment-300">{character.playerName}</span>
        </div>
        <p className="truncate text-sm text-ember-400">
          {character.classAndLevel} · {character.race}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className={`h-full rounded-full ${hpRatio > 0.5 ? 'bg-emerald-500' : hpRatio > 0.2 ? 'bg-ember-500' : 'bg-red-500'}`}
              style={{ width: `${Math.max(0, Math.min(100, hpRatio * 100))}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-parchment-300">
            {character.hp.current}/{character.hp.max} PV
          </span>
        </div>
      </div>
    </Link>
  )
}

