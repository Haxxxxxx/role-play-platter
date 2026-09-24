import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { Button, EmptyState, Input, Label } from '@/components/ui'
import type { Campaign, Scene } from '@/types/database'

/**
 * The GM's prep space: an ordered list of scenes drafted before play. AI
 * can draft one from a one-line premise, grounded in the campaign's known
 * NPCs/locations/quests. GM-only — the tab is hidden for players and the
 * RLS returns nothing for them anyway; this page still guards the direct URL.
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

  // Which scenes are expanded. A freshly added/generated scene opens
  // automatically (see the effect below); the rest start collapsed so a
  // long scenario is a readable outline, not a scroll wall.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const knownIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const fresh = scenes.filter((s) => !knownIds.current.has(s.id))
    if (fresh.length && knownIds.current.size > 0) {
      setExpanded((prev) => new Set([...prev, ...fresh.map((s) => s.id)]))
    }
    knownIds.current = new Set(scenes.map((s) => s.id))
  }, [scenes])

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

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allOpen = scenes.length > 0 && scenes.every((s) => expanded.has(s.id))

  if (!isGm) return <p className="text-sm text-parchment-300">Réservé au MJ.</p>

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h2 className="mb-1 font-display text-xl text-parchment-100">Scénario</h2>
          <p className="text-sm text-parchment-300">
            Préparez vos scènes avant la partie — texte à lire, notes secrètes, rencontres — puis jouez à partir
            d'ici.
          </p>
        </div>
        {scenes.length > 1 && (
          <button
            onClick={() => setExpanded(allOpen ? new Set() : new Set(scenes.map((s) => s.id)))}
            className="shrink-0 whitespace-nowrap text-xs text-parchment-300 hover:text-ember-400"
          >
            {allOpen ? 'Tout replier' : 'Tout déplier'}
          </button>
        )}
      </div>

      <form
        className="mb-6 flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (premise.trim()) generate.mutate()
        }}
      >
        <Label>Générer une scène (IA)</Label>
        <div className="flex gap-2">
          <Input
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            placeholder="ex. La compagnie arrive à une tour de guet en ruine à la nuit tombée"
            className="flex-1"
          />
          <Button type="submit" variant="ai" disabled={generate.isPending || !premise.trim()} className="shrink-0">
            {generate.isPending ? 'Génération…' : '✨ Générer'}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => addBlank.mutate()}
          className="self-start text-xs text-parchment-300 hover:text-ember-400"
        >
          + Scène vide
        </button>
      </form>

      {loading && <p className="text-sm text-parchment-300">Chargement…</p>}
      {!loading && scenes.length === 0 && (
        <EmptyState title="Aucune scène" description="Générez-en une ci-dessus ou partez d'une scène vide." />
      )}

      <div className="flex flex-col gap-3">
        {scenes.map((scene, i) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={i}
            total={scenes.length}
            open={expanded.has(scene.id)}
            onToggle={() => toggle(scene.id)}
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
  open,
  onToggle,
  npcs,
  locations,
  onMove,
  onPush,
}: {
  scene: Scene
  index: number
  total: number
  open: boolean
  onToggle: () => void
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
    <div
      className={`rounded-xl border bg-ink-900 transition-colors ${
        scene.done ? 'border-ink-700/60' : 'border-ink-700'
      }`}
    >
      {/* header row — always visible, click to expand/collapse */}
      <div className="flex items-start gap-2 p-3">
        <button
          onClick={onToggle}
          className="mt-0.5 shrink-0 text-parchment-400 transition-transform hover:text-ember-400"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
          aria-label={open ? 'Replier' : 'Déplier'}
        >
          ▶
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={onToggle} className="flex w-full items-baseline gap-2 text-left">
            <span className="shrink-0 text-xs text-parchment-400">{index + 1}</span>
            <span
              className={`truncate font-display text-lg ${scene.done ? 'text-parchment-300 line-through' : 'text-parchment-100'}`}
            >
              {scene.title || 'Sans titre'}
            </span>
          </button>
          {!open && (
            <p className="mt-0.5 truncate text-xs text-parchment-300">
              {scene.readAloud || scene.gmNotes || 'Vide'}
            </p>
          )}
          {!open && (scene.encounter || scene.npcIds.length > 0 || scene.done) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {scene.done && (
                <span className="rounded-full border border-ink-700 px-1.5 py-0.5 text-[10px] uppercase text-parchment-400">
                  jouée
                </span>
              )}
              {scene.encounter && (
                <span className="rounded-full border border-red-500/40 px-1.5 py-0.5 text-[10px] text-red-400">
                  ⚔ rencontre
                </span>
              )}
              {scene.npcIds.length > 0 && (
                <span className="rounded-full border border-ink-700 px-1.5 py-0.5 text-[10px] text-parchment-300">
                  {scene.npcIds.length} PNJ
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="rounded border border-ink-700 px-1.5 text-xs text-parchment-300 hover:text-ember-400 disabled:opacity-30"
          >
            ▲
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === total - 1}
            className="rounded border border-ink-700 px-1.5 text-xs text-parchment-300 hover:text-ember-400 disabled:opacity-30"
          >
            ▼
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-ink-700/70 p-4">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-parchment-400">
            Titre
          </label>
          <input
            defaultValue={scene.title}
            onBlur={(e) => e.target.value !== scene.title && save({ title: e.target.value })}
            className="mb-4 w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-1.5 font-display text-lg text-parchment-100 outline-none focus:border-ember-500"
          />

          {/* read-aloud: styled as boxed text a GM reads at the table */}
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-ember-400/70">
            📖 Lu à voix haute
          </label>
          <AutoTextarea
            value={scene.readAloud}
            onCommit={(v) => save({ read_aloud: v })}
            placeholder="Texte d'ambiance à lire aux joueurs quand la scène commence…"
            className="mb-4 border-l-2 border-l-ember-500/50 bg-ember-500/[0.04] italic text-parchment-100"
          />

          {/* GM notes: styled as secret prep */}
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-arcane-500/70">
            🔒 Notes MJ (secret)
          </label>
          <AutoTextarea
            value={scene.gmNotes}
            onCommit={(v) => save({ gm_notes: v })}
            placeholder="Ce qui se passe vraiment, ce que veulent les PNJ, les détails cachés, les issues possibles…"
            className="mb-4 border-l-2 border-l-arcane-500/40 bg-arcane-500/[0.04]"
          />

          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-parchment-400">
            ⚔ Rencontre
          </label>
          <input
            defaultValue={scene.encounter}
            onBlur={(e) => e.target.value !== scene.encounter && save({ encounter: e.target.value })}
            placeholder="ex. Melric + 3 bandits, hostiles"
            className="w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm outline-none focus:border-ember-500"
          />

          {(npcs.length > 0 || locations.length > 0) && (
            <div className="mt-4 flex flex-col gap-2">
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

          <div className="mt-4 flex items-center gap-4 border-t border-ink-700/70 pt-3">
            <label className="flex items-center gap-1.5 text-xs text-parchment-300">
              <input
                type="checkbox"
                checked={scene.done}
                onChange={(e) => save({ done: e.target.checked })}
                className="accent-ember-500"
              />
              jouée
            </label>
            <button
              onClick={() => pushMutation.mutate()}
              disabled={pushMutation.isPending}
              className="text-xs text-parchment-300 hover:text-ember-400 disabled:opacity-50"
            >
              → Envoyer dans la chronique
            </button>
            <button
              onClick={() => deleteScene(scene.id).catch(() => pushToast('Suppression impossible.', 'error'))}
              className="ml-auto text-xs text-parchment-400 hover:text-red-400"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Controlled textarea that grows to fit its content — an AI-drafted scene
 * has a long read-aloud paragraph and a longer GM-notes block, and a fixed
 * `rows` box turns those into tiny scroll windows. Commits on blur (one
 * write per edit, not per keystroke).
 */
function AutoTextarea({
  value,
  onCommit,
  placeholder,
  className = '',
}: {
  value: string
  onCommit: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(value)

  // Keep in sync when the row changes underneath us (realtime echo, AI
  // fill) as long as the field isn't being actively edited.
  useEffect(() => {
    if (ref.current !== document.activeElement) setDraft(value)
  }, [value])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

  return (
    <textarea
      ref={ref}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      rows={2}
      className={`w-full resize-none overflow-hidden rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm leading-relaxed outline-none focus:border-ember-500 ${className}`}
    />
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
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-parchment-400">{label}</span>
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
                  : 'border-ink-700 text-parchment-300 hover:text-parchment-200'
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
