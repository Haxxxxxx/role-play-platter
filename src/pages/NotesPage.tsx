import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useSessionNotes } from '@/hooks/useChronicle'
import { submitGmNote } from '@/hooks/useNotesPipeline'
import { fetchGmRecommendations, type Recommendation, type RecommendationCategory } from '@/hooks/useRecommendations'
import { Badge, Button, EmptyState, Textarea } from '@/components/ui'
import { useUiStore } from '@/store/useUiStore'
import type { Campaign, SessionNoteKind, SessionNoteStatus } from '@/types/database'

const NOTE_STATUS: Record<SessionNoteStatus, { label: string; variant: 'neutral' | 'arcane' | 'success' | 'danger' }> = {
  pending: { label: 'En attente', variant: 'neutral' },
  processing: { label: 'Traitement…', variant: 'arcane' },
  processed: { label: 'Traité', variant: 'success' },
  error: { label: 'Erreur', variant: 'danger' },
}
const FALLBACK_NOTE_STATUS = { label: 'Inconnu', variant: 'neutral' as const }

const KIND_LABEL: Record<SessionNoteKind, string> = {
  'session-recap': 'Récap de session',
  'item-update': 'Mise à jour d\'objet',
  freeform: 'Note libre',
}

const CATEGORY_STYLE: Record<RecommendationCategory, { label: string; variant: 'arcane' | 'ember' | 'success' | 'info' | 'danger' }> = {
  quest: { label: 'Quête', variant: 'arcane' },
  npc: { label: 'PNJ', variant: 'ember' },
  pacing: { label: 'Rythme', variant: 'success' },
  worldbuilding: { label: 'Univers', variant: 'info' },
  combat: { label: 'Combat', variant: 'danger' },
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
            <p className="mb-4 text-sm text-parchment-300">
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
                        : 'border-ink-700 text-parchment-300'
                    }`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="ex. La compagnie atteint enfin les ruines de Kaer Doreth. Le passeur Amrod les met en garde : les cultistes de la Brume vénèrent quelque chose sous les eaux noires. Elyne a trouvé une clé rouillée sur le second palier..."
              />
              <Button type="submit" disabled={submit.isPending || !text.trim()} className="self-start">
                {submit.isPending ? 'Gemini réfléchit…' : 'Traiter avec Gemini'}
              </Button>
            </form>
          </>
        ) : (
          <EmptyState
            title="Réservé au MJ"
            description="Seul le MJ peut ajouter des notes de session — l'historique reste visible ci-contre."
          />
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-parchment-100">Historique des notes</h2>
        {loading && <p className="text-sm text-parchment-300">Chargement…</p>}
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-ink-700 bg-ink-900 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="uppercase text-parchment-400">{KIND_LABEL[note.kind]}</span>
                <Badge variant={(NOTE_STATUS[note.status] ?? FALLBACK_NOTE_STATUS).variant}>
                  {(NOTE_STATUS[note.status] ?? FALLBACK_NOTE_STATUS).label}
                </Badge>
              </div>
              <p className="text-parchment-300">{note.rawText}</p>
              {note.narrativeRecap && (
                <p className="mt-2 border-l-2 border-ember-500/40 pl-2 italic text-parchment-100">
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
            <p className="text-sm text-parchment-300">
              Une lecture algorithmique de l'état actuel de la campagne — pas une conversation, juste une liste
              fraîche à chaque clic.
            </p>
          </div>
          <Button variant="ai" size="sm" onClick={() => recommendations.mutate()} disabled={recommendations.isPending}>
            {recommendations.isPending
              ? 'Analyse…'
              : recommendations.data
                ? '🔄 Régénérer'
                : '🧠 Générer des recommandations'}
          </Button>
        </div>

        {recommendations.data && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.data.map((rec: Recommendation, i: number) => (
              <div key={i} className="rounded-xl border border-ink-700 bg-ink-900 p-3 text-sm">
                <Badge variant={CATEGORY_STYLE[rec.category].variant}>{CATEGORY_STYLE[rec.category].label}</Badge>
                <h3 className="mt-2 font-medium text-parchment-100">{rec.title}</h3>
                <p className="mt-1 text-parchment-300">{rec.detail}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    )}
    </div>
  )
}
