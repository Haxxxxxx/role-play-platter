import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { createCharacter, useParty } from '@/hooks/useParty'
import { findTokenLocation } from '@/hooks/useBattleMap'
import { useUiStore } from '@/store/useUiStore'
import type { Character } from '@/types/database'

export function PartyPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuth()
  const { data: party, loading } = useParty(campaignId)
  const [showForm, setShowForm] = useState(false)
  const navigate = useNavigate()
  const pushToast = useUiStore((s) => s.pushToast)

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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl text-parchment-100">Party</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-parchment-200/70 hover:bg-ink-800"
        >
          {showForm ? 'Cancel' : '+ Add character'}
        </button>
      </div>

      {showForm && campaignId && (
        <NewCharacterForm
          campaignId={campaignId}
          ownerId={user?.id ?? null}
          onDone={() => setShowForm(false)}
        />
      )}

      {loading && <p className="text-parchment-200/60">Loading…</p>}
      {!loading && party.length === 0 && !showForm && (
        <p className="text-sm text-parchment-200/60">No characters yet — add one above.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {party.map((character) => (
          <CharacterSheet key={character.id} character={character} onOpenOnMap={() => openOnMap(character)} />
        ))}
      </div>
    </div>
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
      pushToast('Character added.', 'success')
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
        placeholder="Character name (ex. Elyne)"
        className="rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
      />
      <input
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Player name"
        className="rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
      />
      <input
        value={classAndLevel}
        onChange={(e) => setClassAndLevel(e.target.value)}
        placeholder="Class & level (ex. Roublard 3)"
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
        {mutation.isPending ? 'Adding…' : 'Add to party'}
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
          HP <strong className="text-parchment-100">{character.hp.current}/{character.hp.max}</strong>
        </span>
        <span>
          AC <strong className="text-parchment-100">{character.armorClass}</strong>
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
        <h4 className="mb-1 text-xs uppercase tracking-wide text-parchment-200/50">Inventory</h4>
        {character.inventory.length === 0 ? (
          <p className="text-sm text-parchment-200/40">Empty — items land here automatically from GM notes.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {character.inventory.map((item) => (
              <li key={item.id} className="flex justify-between text-parchment-200/80">
                <span>
                  {item.name} {item.quantity > 1 && `×${item.quantity}`}
                </span>
                {item.equipped && <span className="text-xs text-arcane-500">equipped</span>}
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
