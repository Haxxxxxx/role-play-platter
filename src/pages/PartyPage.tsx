import { useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import {
  addInventoryItem,
  addSkill,
  adjustCharacterArmorClass,
  adjustCharacterHp,
  createCharacter,
  removeInventoryItem,
  removeSkill,
  toggleItemEquipped,
  useParty,
} from '@/hooks/useParty'
import { findTokenLocation } from '@/hooks/useBattleMap'
import { useCampaignMembers, inviteMemberToCampaign, removeCampaignMember, type CampaignMember } from '@/hooks/useCampaigns'
import { InvitePicker } from '@/components/InvitePicker'
import type { Profile } from '@/hooks/useProfiles'
import { useUiStore } from '@/store/useUiStore'
import type { AbilityScores, Campaign, Character, InventoryItem, Skill } from '@/types/database'

const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  str: 'FOR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'SAG', cha: 'CHA',
}

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
          <CharacterSheet
            key={character.id}
            character={character}
            canEdit={isGm || character.ownerId === user?.id}
            onOpenOnMap={() => openOnMap(character)}
          />
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

const BLANK_ABILITY_SCORES: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

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

      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-parchment-200/40">
          Caractéristiques
        </label>
        <div className="grid grid-cols-6 gap-1.5">
          {(Object.keys(abilityScores) as (keyof AbilityScores)[]).map((key) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase text-parchment-200/50">{ABILITY_LABELS[key]}</span>
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
        <label className="flex-1 text-xs text-parchment-200/50">
          PV max
          <input
            type="number"
            min={1}
            value={hpMax}
            onChange={(e) => setHpMax(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-parchment-100 outline-none focus:border-ember-500"
          />
        </label>
        <label className="flex-1 text-xs text-parchment-200/50">
          CA
          <input
            type="number"
            min={0}
            value={armorClass}
            onChange={(e) => setArmorClass(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-parchment-100 outline-none focus:border-ember-500"
          />
        </label>
      </div>

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

function CharacterSheet({
  character,
  canEdit,
  onOpenOnMap,
}: {
  character: Character
  canEdit: boolean
  onOpenOnMap: () => void
}) {
  const pushToast = useUiStore((s) => s.pushToast)

  // Both adjust by a delta and clamp server-side against a freshly read
  // value rather than one computed from this render's (possibly stale)
  // character prop — see the comment in useParty.ts for why that matters.
  const hpMutation = useMutation({
    mutationFn: (delta: number) => adjustCharacterHp(character.id, delta),
    onError: () => pushToast('Impossible de modifier les PV.', 'error'),
  })
  const acMutation = useMutation({
    mutationFn: (delta: number) => adjustCharacterArmorClass(character.id, delta),
    onError: () => pushToast('Impossible de modifier la CA.', 'error'),
  })

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg text-parchment-100">{character.name}</h3>
        <span className="text-xs text-parchment-200/50">{character.playerName}</span>
      </div>
      <p className="text-sm text-ember-400">
        {character.classAndLevel} · {character.race}
      </p>
      <div className="mt-3 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          PV
          {canEdit && (
            <button
              onClick={() => hpMutation.mutate(-1)}
              className="rounded border border-ink-700 px-1.5 text-parchment-200/60 hover:border-red-500/50 hover:text-red-400"
            >
              −
            </button>
          )}
          <strong className="text-parchment-100">
            {character.hp.current}/{character.hp.max}
          </strong>
          {canEdit && (
            <button
              onClick={() => hpMutation.mutate(1)}
              className="rounded border border-ink-700 px-1.5 text-parchment-200/60 hover:border-emerald-500/50 hover:text-emerald-400"
            >
              +
            </button>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          CA
          {canEdit && (
            <button
              onClick={() => acMutation.mutate(-1)}
              className="rounded border border-ink-700 px-1.5 text-parchment-200/60 hover:border-red-500/50 hover:text-red-400"
            >
              −
            </button>
          )}
          <strong className="text-parchment-100">{character.armorClass}</strong>
          {canEdit && (
            <button
              onClick={() => acMutation.mutate(1)}
              className="rounded border border-ink-700 px-1.5 text-parchment-200/60 hover:border-emerald-500/50 hover:text-emerald-400"
            >
              +
            </button>
          )}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-1 text-center text-xs">
        {Object.entries(character.abilityScores).map(([key, value]) => (
          <div key={key} className="rounded bg-ink-800 py-1">
            <div className="uppercase text-parchment-200/50">{ABILITY_LABELS[key as keyof AbilityScores]}</div>
            <div className="font-medium text-parchment-100">{value}</div>
          </div>
        ))}
      </div>

      <InventorySection character={character} canEdit={canEdit} />
      <SkillsSection character={character} canEdit={canEdit} />

      <button
        onClick={onOpenOnMap}
        className="mt-4 w-full rounded-md border border-ink-700 py-1.5 text-xs text-parchment-200/60 hover:border-ember-500/50 hover:text-ember-400"
      >
        📍 Voir sur la carte
      </button>
    </div>
  )
}

function InventorySection({ character, canEdit }: { character: Character; canEdit: boolean }) {
  const [showForm, setShowForm] = useState(false)
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const pushToast = useUiStore((s) => s.pushToast)

  const addMutation = useMutation({
    mutationFn: (item: Omit<InventoryItem, 'id'>) => addInventoryItem(character.id, item),
    onSuccess: () => {
      setItemName('')
      setQuantity(1)
      setShowForm(false)
    },
    onError: () => pushToast("Impossible d'ajouter cet objet.", 'error'),
  })
  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeInventoryItem(character.id, itemId),
    onError: () => pushToast('Impossible de retirer cet objet.', 'error'),
  })
  const toggleMutation = useMutation({
    mutationFn: (itemId: string) => toggleItemEquipped(character.id, itemId),
    onError: () => pushToast('Action impossible.', 'error'),
  })

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wide text-parchment-200/50">Inventaire</h4>
        {canEdit && (
          <button onClick={() => setShowForm((s) => !s)} className="text-xs text-parchment-200/50 hover:text-ember-400">
            {showForm ? 'Annuler' : '+ Ajouter'}
          </button>
        )}
      </div>

      {character.inventory.length === 0 && !showForm ? (
        <p className="text-sm text-parchment-200/40">Vide — les objets arrivent aussi automatiquement depuis les notes du MJ.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {character.inventory.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-parchment-200/80">
              <span className="truncate">
                {item.name} {item.quantity > 1 && `×${item.quantity}`}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {canEdit ? (
                  <button
                    onClick={() => toggleMutation.mutate(item.id)}
                    className={`text-xs ${item.equipped ? 'text-arcane-500' : 'text-parchment-200/30 hover:text-arcane-500'}`}
                  >
                    équipé
                  </button>
                ) : (
                  item.equipped && <span className="text-xs text-arcane-500">équipé</span>
                )}
                {canEdit && (
                  <button onClick={() => removeMutation.mutate(item.id)} className="text-xs text-parchment-200/30 hover:text-red-400">
                    ✕
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!itemName.trim()) return
            addMutation.mutate({ name: itemName.trim(), quantity, description: '', equipped: false, sourceNoteId: null })
          }}
        >
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Nom de l'objet"
            autoFocus
            className="flex-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-sm outline-none focus:border-ember-500"
          />
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="w-14 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-center text-sm outline-none focus:border-ember-500"
          />
          <button
            type="submit"
            disabled={addMutation.isPending || !itemName.trim()}
            className="rounded-md bg-ember-500 px-2 py-1 text-xs font-medium text-ink-950 disabled:opacity-50"
          >
            Ajouter
          </button>
        </form>
      )}
    </div>
  )
}

function SkillsSection({ character, canEdit }: { character: Character; canEdit: boolean }) {
  const [showForm, setShowForm] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [modifier, setModifier] = useState(0)
  const pushToast = useUiStore((s) => s.pushToast)

  const addMutation = useMutation({
    mutationFn: (skill: Omit<Skill, 'id'>) => addSkill(character.id, skill),
    onSuccess: () => {
      setSkillName('')
      setModifier(0)
      setShowForm(false)
    },
    onError: () => pushToast("Impossible d'ajouter cette compétence.", 'error'),
  })
  const removeMutation = useMutation({
    mutationFn: (skillId: string) => removeSkill(character.id, skillId),
    onError: () => pushToast('Impossible de retirer cette compétence.', 'error'),
  })

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wide text-parchment-200/50">Compétences</h4>
        {canEdit && (
          <button onClick={() => setShowForm((s) => !s)} className="text-xs text-parchment-200/50 hover:text-ember-400">
            {showForm ? 'Annuler' : '+ Ajouter'}
          </button>
        )}
      </div>

      {character.skills.length === 0 && !showForm ? (
        <p className="text-sm text-parchment-200/40">Aucune compétence renseignée.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {character.skills.map((skill) => (
            <li key={skill.id} className="flex items-center justify-between gap-2 text-parchment-200/80">
              <span className="truncate">{skill.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <strong className="text-parchment-100">{skill.modifier >= 0 ? `+${skill.modifier}` : skill.modifier}</strong>
                {canEdit && (
                  <button onClick={() => removeMutation.mutate(skill.id)} className="text-xs text-parchment-200/30 hover:text-red-400">
                    ✕
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!skillName.trim()) return
            addMutation.mutate({ name: skillName.trim(), modifier })
          }}
        >
          <input
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="Nom de la compétence (ex. Discrétion)"
            autoFocus
            className="flex-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-sm outline-none focus:border-ember-500"
          />
          <input
            type="number"
            value={modifier}
            onChange={(e) => setModifier(Number(e.target.value) || 0)}
            className="w-14 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-center text-sm outline-none focus:border-ember-500"
          />
          <button
            type="submit"
            disabled={addMutation.isPending || !skillName.trim()}
            className="rounded-md bg-ember-500 px-2 py-1 text-xs font-medium text-ink-950 disabled:opacity-50"
          >
            Ajouter
          </button>
        </form>
      )}
    </div>
  )
}
