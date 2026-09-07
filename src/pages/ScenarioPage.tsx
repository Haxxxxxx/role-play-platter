import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useLocations, useNpcs } from '@/hooks/useChronicle'
import {
  createScene,
  deleteScene,
  generateScene,
  moveScene,
  pushSceneToChronicle,
  updateScene,
  useScenes,
} from '@/hooks/useScenes'
import { useUiStore } from '@/store/useUiStore'
import type { Campaign, Scene } from '@/types/database'

/**
 * The GM's prep space: an ordered list of scenes drafted before play. AI
 * can draft one from a one-line premise, grounded in the campaign's known
 * NPCs/locations/quests. GM-only — the tab is hidden for players and the
 * RLS returns nothing for them anyway; this page still guards the direct
 * URL.
 */
export function ScenarioPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { campaign } = useOutletContext<{ campaign: Campaign }>()
  const { user } = useAuth()
  const isGm = user?.id === campaign.gmId
  const { data: scenes, loading } = useScenes(isGm ? campaignId : undefined)
  const { data: npcs } = useNpcs(campaignId)
  const { data: locations } = useLocations(campaignId)
  const pushToast = useUiStore((s) => s.pushToast)
  const [premise, setPremise] = useState('')

  const nextOrder = scenes.length > 0 ? Math.max(...scenes.map((s) => s.order)) + 1 : 1

  const addBlank = useMutation({
    mutationFn: () => createScene(campaignId!, nextOrder),
    onError: () => pushToast("Impossible d'ajouter la scène.", 'error'),
  })
  const generate = useMutation({
    mutationFn: () => generateScene(campaignId!, premise),
    onSuccess: () => {
      setPremise('')
      pushToast('Scène générée.', 'success')
    },
    onError: (e: Error) => pushToast(e.message, 'error'),
  })

  if (!isGm) {
    return <p className="text-sm text-parchment-200/60">Réservé au MJ.</p>
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="mb-1 font-display text-xl text-parchment-100">Scénario</h2>
        <p className="text-sm text-parchment-200/60">
          Préparez vos scènes avant la partie — texte à lire, notes secrètes, rencontres — puis jouez à partir
          d'ici.
        </p>
      </div>

      <form
        className="mb-6 flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (premise.trim()) generate.mutate()
        }}
      >
        <label className="text-[10px] font-medium uppercase tracking-wider text-parchment-200/40">
          Générer une scène (IA)
        </label>
        <div className="flex gap-2">
          <input
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            placeholder="ex. La compagnie arrive à une tour de guet en ruine à la nuit tombée"
            className="flex-1 rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
          />
          <button
            type="submit"
            disabled={generate.isPending || !premise.trim()}
            className="shrink-0 whitespace-nowrap rounded-md border border-arcane-500/50 px-3 py-2 text-sm text-arcane-500 hover:bg-arcane-500/10 disabled:opacity-50"
          >
            {generate.isPending ? 'Génération…' : '✨ Générer'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => addBlank.mutate()}
          className="self-start text-xs text-parchment-200/50 hover:text-ember-400"
        >
          + Scène vide
        </button>
      </form>

      {loading && <p className="text-sm text-parchment-200/60">Chargement…</p>}
      {!loading && scenes.length === 0 && (
        <p className="text-sm text-parchment-200/60">
          Aucune scène — générez-en une ci-dessus ou partez d'une scène vide.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {scenes.map((scene, i) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={i}
            total={scenes.length}
            npcs={npcs}
            locations={locations}
            onMove={(dir) => moveScene(scenes, scene.id, dir)}
            onPush={() => pushSceneToChronicle(campaignId!, scene)}
          />
        ))}
      </div>
    </div>
  )
}

function SceneCard({
  scene,
  index,
  total,
  npcs,
  locations,
  onMove,
  onPush,
}: {
  scene: Scene
  index: number
  total: number
  npcs: { id: string; name: string }[]
  locations: { id: string; name: string }[]
  onMove: (dir: 'up' | 'down') => void
  onPush: () => Promise<void>
}) {
  const pushToast = useUiStore((s) => s.pushToast)

  function save(patch: Parameters<typeof updateScene>[1]) {
    updateScene(scene.id, patch).catch(() => pushToast("Impossible d'enregistrer.", 'error'))
  }

  const pushMutation = useMutation({
    mutationFn: onPush,
    onSuccess: () => pushToast('Scène envoyée dans la chronique.', 'success'),
    onError: () => pushToast("Impossible d'envoyer dans la chronique.", 'error'),
  })

  function toggleRef(field: 'npc_ids' | 'location_ids', current: string[], id: string) {
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    save({ [field]: next })
  }

  return (
    <div className={`rounded-xl border bg-ink-900 p-4 ${scene.done ? 'border-ink-700 opacity-60' : 'border-ink-700'}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-parchment-200/40">Scène {index + 1}</span>
        <div className="flex gap-1">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="rounded border border-ink-700 px-1.5 text-xs text-parchment-200/50 hover:text-ember-400 disabled:opacity-30"
          >
            ▲
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === total - 1}
            className="rounded border border-ink-700 px-1.5 text-xs text-parchment-200/50 hover:text-ember-400 disabled:opacity-30"
          >
            ▼
          </button>
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-parchment-200/50">
          <input
            type="checkbox"
            checked={scene.done}
            onChange={(e) => save({ done: e.target.checked })}
            className="accent-ember-500"
          />
          jouée
        </label>
        <button
          onClick={() => deleteScene(scene.id).catch(() => pushToast('Suppression impossible.', 'error'))}
          className="text-xs text-parchment-200/30 hover:text-red-400"
        >
          ✕
        </button>
      </div>

      <input
        defaultValue={scene.title}
        onBlur={(e) => e.target.value !== scene.title && save({ title: e.target.value })}
        className="mb-3 w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-1.5 font-display text-lg text-parchment-100 outline-none focus:border-ember-500"
      />

      <Field
        label="Lu à voix haute"
        defaultValue={scene.readAloud}
        onCommit={(v) => save({ read_aloud: v })}
        rows={3}
      />
      <Field label="Notes MJ (secret)" defaultValue={scene.gmNotes} onCommit={(v) => save({ gm_notes: v })} rows={4} />
      <div className="mt-3">
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-parchment-200/40">
          Rencontre
        </label>
        <input
          defaultValue={scene.encounter}
          onBlur={(e) => e.target.value !== scene.encounter && save({ encounter: e.target.value })}
          placeholder="ex. Melric + 3 bandits, hostiles"
          className="w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm outline-none focus:border-ember-500"
        />
      </div>

      {(npcs.length > 0 || locations.length > 0) && (
        <div className="mt-3 flex flex-col gap-2">
          {npcs.length > 0 && (
            <RefChips
              label="PNJ de la scène"
              options={npcs}
              selected={scene.npcIds}
              onToggle={(id) => toggleRef('npc_ids', scene.npcIds, id)}
            />
          )}
          {locations.length > 0 && (
            <RefChips
              label="Lieux de la scène"
              options={locations}
              selected={scene.locationIds}
              onToggle={(id) => toggleRef('location_ids', scene.locationIds, id)}
            />
          )}
        </div>
      )}

      <button
        onClick={() => pushMutation.mutate()}
        disabled={pushMutation.isPending}
        className="mt-4 text-xs text-parchment-200/50 hover:text-ember-400 disabled:opacity-50"
      >
        → Envoyer dans la chronique
      </button>
    </div>
  )
}

function Field({
  label,
  defaultValue,
  onCommit,
  rows,
}: {
  label: string
  defaultValue: string
  onCommit: (value: string) => void
  rows: number
}) {
  return (
    <div className="mt-3">
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-parchment-200/40">
        {label}
      </label>
      <textarea
        defaultValue={defaultValue}
        rows={rows}
        onBlur={(e) => e.target.value !== defaultValue && onCommit(e.target.value)}
        className="w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
      />
    </div>
  )
}

function RefChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { id: string; name: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-parchment-200/40">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = selected.includes(o.id)
          return (
            <button
              key={o.id}
              onClick={() => onToggle(o.id)}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                on
                  ? 'border-ember-500/50 bg-ember-500/10 text-ember-400'
                  : 'border-ink-700 text-parchment-200/50 hover:text-parchment-200/80'
              }`}
            >
              {o.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
