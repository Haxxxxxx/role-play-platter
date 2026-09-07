import { useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import {
  addInventoryItem,
  addSkill,
  addSkillsBulk,
  adjustCharacterArmorClass,
  adjustCharacterHp,
  generateCharacterPortrait,
  removeInventoryItem,
  removeSkill,
  toggleItemEquipped,
  uploadCharacterPortrait,
  useParty,
} from '@/hooks/useParty'
import { findTokenLocation } from '@/hooks/useBattleMap'
import { useSystemReference } from '@/hooks/useSystemReference'
import { useUiStore } from '@/store/useUiStore'
import type { AbilityScores, Campaign, InventoryItem, Skill } from '@/types/database'

const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  str: 'FOR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'SAG', cha: 'CHA',
}

/**
 * A proper page for one hero, not just a card in the roster grid — a large
 * portrait, and room for stats/inventory/skills to breathe. PartyPage's
 * grid links here for the full sheet; this is also where all the editing
 * (HP/AC, inventory, skills, portrait) actually lives now.
 */
export function CharacterPage() {
  const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>()
  const { campaign } = useOutletContext<{ campaign: Campaign }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const pushToast = useUiStore((s) => s.pushToast)
  const { data: party, loading } = useParty(campaignId)
  const { reference } = useSystemReference(campaignId)
  const character = party.find((c) => c.id === characterId)
  const isGm = user?.id === campaign.gmId
  const canEdit = !!character && (isGm || character.ownerId === user?.id)

  const hpMutation = useMutation({
    mutationFn: (delta: number) => adjustCharacterHp(character!.id, delta),
    onError: () => pushToast('Impossible de modifier les PV.', 'error'),
  })
  const acMutation = useMutation({
    mutationFn: (delta: number) => adjustCharacterArmorClass(character!.id, delta),
    onError: () => pushToast('Impossible de modifier la CA.', 'error'),
  })

  async function openOnMap() {
    if (!campaignId || !character) return
    const match = await findTokenLocation({ campaignId, refCharacterId: character.id })
    if (!match) {
      pushToast(`${character.name} n'est pas encore placé sur la carte.`, 'info')
      return
    }
    const path = match.locationId ? `/campaign/${campaignId}/map/${match.locationId}` : `/campaign/${campaignId}/map`
    navigate(path, { state: { centerTokenId: match.tokenId } })
  }

  if (loading) return <div className="p-10 text-parchment-200/60">Chargement…</div>
  if (!character) return <div className="p-10 text-parchment-200/60">Personnage introuvable.</div>

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/campaign/${campaignId}/party`} className="mb-4 inline-block text-sm text-parchment-200/60 hover:text-parchment-100">
        ← Retour au groupe
      </Link>

      <div className="flex flex-col gap-6 rounded-xl border border-ink-700 bg-ink-900 p-6 sm:flex-row">
        <PortraitPanel character={character} canEdit={canEdit} />

        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="font-display text-2xl text-parchment-100">{character.name}</h1>
            <span className="text-sm text-parchment-200/50">{character.playerName}</span>
          </div>
          <p className="text-sm text-ember-400">
            {character.classAndLevel} · {character.race}
          </p>

          <div className="mt-4 flex items-center gap-6 text-sm">
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

          <div className="mt-4 grid grid-cols-6 gap-1.5 text-center text-xs">
            {Object.entries(character.abilityScores).map(([key, value]) => (
              <div key={key} className="rounded bg-ink-800 py-1.5">
                <div className="uppercase text-parchment-200/50">{ABILITY_LABELS[key as keyof AbilityScores]}</div>
                <div className="font-medium text-parchment-100">{value}</div>
              </div>
            ))}
          </div>

          <button
            onClick={openOnMap}
            className="mt-4 w-full rounded-md border border-ink-700 py-1.5 text-xs text-parchment-200/60 hover:border-ember-500/50 hover:text-ember-400"
          >
            📍 Voir sur la carte
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
          <InventorySection characterId={character.id} inventory={character.inventory} canEdit={canEdit} />
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
          <SkillsSection characterId={character.id} skills={character.skills} canEdit={canEdit} reference={reference} />
        </div>
      </div>
    </div>
  )
}

function PortraitPanel({
  character,
  canEdit,
}: {
  character: { id: string; name: string; portraitUrl: string | null }
  canEdit: boolean
}) {
  const pushToast = useUiStore((s) => s.pushToast)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCharacterPortrait(character.id, file),
    onError: (error: Error) => {
      setPreviewUrl(null)
      pushToast(error.message || "Impossible d'envoyer l'image.", 'error')
    },
  })

  const generateMutation = useMutation({
    mutationFn: () => generateCharacterPortrait(character.id),
    onError: (error: Error) => pushToast(error.message || 'La génération a échoué.', 'error'),
  })

  function handleFile(file: File) {
    setPreviewUrl(URL.createObjectURL(file)) // instant feedback while it uploads
    uploadMutation.mutate(file)
  }

  const busy = uploadMutation.isPending || generateMutation.isPending
  const shownUrl = previewUrl ?? character.portraitUrl

  return (
    <div className="mx-auto shrink-0 sm:mx-0">
      <div className="relative h-48 w-48 overflow-hidden rounded-xl border border-ink-700 bg-ink-800">
        {shownUrl ? (
          <img src={shownUrl} alt={character.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl text-parchment-200/20">🧑</div>
        )}
        {generateMutation.isPending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink-950/75 px-3 text-center text-xs text-parchment-200/80">
            <span>Génération…</span>
            <span className="text-[10px] text-parchment-200/50">jusqu'à une minute</span>
          </div>
        )}
        {canEdit && !generateMutation.isPending && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="absolute inset-x-0 bottom-0 bg-ink-950/85 py-1.5 text-xs text-parchment-200/80 backdrop-blur-sm hover:text-ember-400 disabled:opacity-50"
          >
            {uploadMutation.isPending ? 'Envoi…' : '📷 Changer l\'image'}
          </button>
        )}
      </div>

      {canEdit && (
        <button
          onClick={() => generateMutation.mutate()}
          disabled={busy}
          className="mt-2 w-48 rounded-md border border-arcane-500/50 py-1.5 text-xs text-arcane-500 hover:bg-arcane-500/10 disabled:opacity-50"
        >
          {generateMutation.isPending ? 'Génération…' : '✨ Générer (IA)'}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function InventorySection({
  characterId,
  inventory,
  canEdit,
}: {
  characterId: string
  inventory: InventoryItem[]
  canEdit: boolean
}) {
  const [showForm, setShowForm] = useState(false)
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const pushToast = useUiStore((s) => s.pushToast)

  const addMutation = useMutation({
    mutationFn: (item: Omit<InventoryItem, 'id'>) => addInventoryItem(characterId, item),
    onSuccess: () => {
      setItemName('')
      setQuantity(1)
      setShowForm(false)
    },
    onError: () => pushToast("Impossible d'ajouter cet objet.", 'error'),
  })
  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeInventoryItem(characterId, itemId),
    onError: () => pushToast('Impossible de retirer cet objet.', 'error'),
  })
  const toggleMutation = useMutation({
    mutationFn: (itemId: string) => toggleItemEquipped(characterId, itemId),
    onError: () => pushToast('Action impossible.', 'error'),
  })

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wide text-parchment-200/50">Inventaire</h4>
        {canEdit && (
          <button onClick={() => setShowForm((s) => !s)} className="text-xs text-parchment-200/50 hover:text-ember-400">
            {showForm ? 'Annuler' : '+ Ajouter'}
          </button>
        )}
      </div>

      {inventory.length === 0 && !showForm ? (
        <p className="text-sm text-parchment-200/40">Vide — les objets arrivent aussi automatiquement depuis les notes du MJ.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {inventory.map((item) => (
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

function SkillsSection({
  characterId,
  skills,
  canEdit,
  reference,
}: {
  characterId: string
  skills: Skill[]
  canEdit: boolean
  reference: { classes: { name: string; description: string }[]; skills: { name: string; description: string }[] } | null
}) {
  const [showForm, setShowForm] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [modifier, setModifier] = useState(0)
  const pushToast = useUiStore((s) => s.pushToast)

  const addMutation = useMutation({
    mutationFn: (skill: Omit<Skill, 'id'>) => addSkill(characterId, skill),
    onSuccess: () => {
      setSkillName('')
      setModifier(0)
      setShowForm(false)
    },
    onError: () => pushToast("Impossible d'ajouter cette compétence.", 'error'),
  })
  const removeMutation = useMutation({
    mutationFn: (skillId: string) => removeSkill(characterId, skillId),
    onError: () => pushToast('Impossible de retirer cette compétence.', 'error'),
  })
  const bulkAddMutation = useMutation({
    mutationFn: () => addSkillsBulk(characterId, reference!.skills),
    onError: () => pushToast("Impossible d'ajouter les compétences du système.", 'error'),
  })

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wide text-parchment-200/50">Compétences</h4>
        {canEdit && (
          <button onClick={() => setShowForm((s) => !s)} className="text-xs text-parchment-200/50 hover:text-ember-400">
            {showForm ? 'Annuler' : '+ Ajouter'}
          </button>
        )}
      </div>

      {canEdit && reference && reference.skills.length > 0 && (
        <button
          onClick={() => bulkAddMutation.mutate()}
          disabled={bulkAddMutation.isPending}
          className="mb-2 text-xs text-arcane-500 hover:text-arcane-500/80 disabled:opacity-50"
        >
          {bulkAddMutation.isPending
            ? 'Ajout…'
            : `+ Ajouter les compétences du système (${reference.skills.length})`}
        </button>
      )}

      {skills.length === 0 && !showForm ? (
        <p className="text-sm text-parchment-200/40">Aucune compétence renseignée.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {skills.map((skill) => (
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
