import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useSessionNotes } from '@/hooks/useChronicle'
import { submitGmNote } from '@/hooks/useNotesPipeline'
import { fetchGmRecommendations, type Recommendation, type RecommendationCategory } from '@/hooks/useRecommendations'
import { useUiStore } from '@/store/useUiStore'
import type { Campaign, SessionNoteKind } from '@/types/database'

const KIND_LABEL: Record<SessionNoteKind, string> = {
  'session-recap': 'Récap de session',
  'item-update': 'Mise à jour d\'objet',
  freeform: 'Note libre',
}

const CATEGORY_STYLE: Record<RecommendationCategory, { label: string; color: string }> = {
  quest: { label: 'Quête', color: 'border-arcane-500/50 text-arcane-500' },
  npc: { label: 'PNJ', color: 'border-ember-500/50 text-ember-400' },
  pacing: { label: 'Rythme', color: 'border-emerald-500/50 text-emerald-400' },
  worldbuilding: { label: 'Univers', color: 'border-blue-500/50 text-blue-400' },
  combat: { label: 'Combat', color: 'border-red-500/50 text-red-400' },
}

export function NotesPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { campaign } = useOutletContext<{ campaign: Campaign }>()
  const { user } = useAuth()
  const isGm = user?.id === campaign.gmId
  const { data: notes, loading } = useSessionNotes(campaignId)
  const [text, setText] = useState('')
  const [kind, setKind] = useState<SessionNoteKind>('session-recap')
  const pushToast = useUiStore((s) => s.pushToast)

  const submit = useMutation({
    mutationFn: () => submitGmNote({ campaignId: campaignId!, authorId: user!.id, kind, rawText: text }),
    onSuccess: (result) => {
      setText('')
      pushToast(
        `Chronique mise à jour : ${result.timelineEventsCreated} événements, ${result.npcsTouched} PNJ, ${result.questsTouched} quêtes, ${result.itemChangesApplied} objets.`,
        'success',
      )
    },
    onError: () => pushToast("Gemini n'a pas pu traiter cette note — voir l'historique pour le détail.", 'error'),
  })

  const recommendations = useMutation({
    mutationFn: () => fetchGmRecommendations(campaignId!),
    onError: (error: Error) => pushToast(error.message, 'error'),
  })

  return (
    <div className="flex flex-col gap-8">
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <section>
        {isGm ? (
          <>
            <h2 className="mb-3 font-display text-xl text-parchment-100">Racontez ce qui s'est passé</h2>
            <p className="mb-4 text-sm text-parchment-200/60">
              Collez vos notes de session brutes, ou une simple ligne comme « Elyne a récupéré une
              dague +1 sur le capitaine des bandits » — Gemini structure ça automatiquement dans la
              timeline, le codex des PNJ, le journal des quêtes et l'inventaire du groupe. Ceci est une
              mémoire de travail temporaire : rien n'est définitif tant que ça n'a pas atterri dans la
              chronique.
            </p>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (!text.trim() || !user) return
                submit.mutate()
              }}
            >
              <div className="flex gap-2">
                {(Object.keys(KIND_LABEL) as SessionNoteKind[]).map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setKind(k)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      kind === k
                        ? 'border-ember-500 bg-ember-500/10 text-ember-400'
                        : 'border-ink-700 text-parchment-200/60'
                    }`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="ex. La compagnie atteint enfin les ruines de Kaer Doreth. Le passeur Amrod les met en garde : les cultistes de la Brume vénèrent quelque chose sous les eaux noires. Elyne a trouvé une clé rouillée sur le second palier..."
                className="rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
              />
              <button
                type="submit"
                disabled={submit.isPending || !text.trim()}
                className="self-start rounded-md bg-ember-500 px-4 py-2 text-sm font-medium text-ink-950 disabled:opacity-50"
              >
                {submit.isPending ? 'Gemini réfléchit…' : 'Traiter avec Gemini'}
              </button>
            </form>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-ink-700 p-6 text-center">
            <h2 className="font-display text-lg text-parchment-100">Réservé au MJ</h2>
            <p className="mt-2 text-sm text-parchment-200/60">
              Seul le MJ peut ajouter des notes de session — l'historique reste visible ci-contre.
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-parchment-100">Historique des notes</h2>
        {loading && <p className="text-sm text-parchment-200/60">Chargement…</p>}
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-ink-700 bg-ink-900 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="uppercase text-parchment-200/50">{KIND_LABEL[note.kind]}</span>
                <StatusBadge status={note.status} />
              </div>
              <p className="text-parchment-200/70">{note.rawText}</p>
              {note.narrativeRecap && (
                <p className="mt-2 border-l-2 border-ember-500/40 pl-2 italic text-parchment-100/90">
                  {note.narrativeRecap}
                </p>
              )}
              {note.errorMessage && <p className="mt-2 text-red-400">{note.errorMessage}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>

    {isGm && (
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg text-parchment-100">Recommandations</h2>
            <p className="text-sm text-parchment-200/60">
              Une lecture algorithmique de l'état actuel de la campagne — pas une conversation, juste une liste
              fraîche à chaque clic.
            </p>
          </div>
          <button
            onClick={() => recommendations.mutate()}
            disabled={recommendations.isPending}
            className="shrink-0 rounded-md border border-arcane-500/50 px-3 py-1.5 text-sm text-arcane-500 hover:bg-arcane-500/10 disabled:opacity-50"
          >
            {recommendations.isPending
              ? 'Analyse…'
              : recommendations.data
                ? '🔄 Régénérer'
                : '🧠 Générer des recommandations'}
          </button>
        </div>

        {recommendations.data && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.data.map((rec: Recommendation, i: number) => (
              <div key={i} className="rounded-lg border border-ink-700 bg-ink-900 p-3 text-sm">
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${CATEGORY_STYLE[rec.category].color}`}
                >
                  {CATEGORY_STYLE[rec.category].label}
                </span>
                <h3 className="mt-2 font-medium text-parchment-100">{rec.title}</h3>
                <p className="mt-1 text-parchment-200/70">{rec.detail}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'processed'
      ? 'text-emerald-400'
      : status === 'error'
        ? 'text-red-400'
        : 'text-parchment-200/50'
  return <span className={color}>{status}</span>
}
