import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useSessionNotes } from '@/hooks/useChronicle'
import { submitGmNote } from '@/hooks/useNotesPipeline'
import { useUiStore } from '@/store/useUiStore'
import type { Campaign, SessionNoteKind } from '@/types/database'

const KIND_LABEL: Record<SessionNoteKind, string> = {
  'session-recap': 'Session recap',
  'item-update': 'Item / inventory update',
  freeform: 'Freeform note',
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
        `Chronicle updated: ${result.timelineEventsCreated} events, ${result.npcsTouched} NPCs, ${result.questsTouched} quests, ${result.itemChangesApplied} item changes.`,
        'success',
      )
    },
    onError: () => pushToast('Claude could not process that note — check the note history for details.', 'error'),
  })

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <section>
        {isGm ? (
          <>
            <h2 className="mb-3 font-display text-xl text-parchment-100">Drop in what happened</h2>
            <p className="mb-4 text-sm text-parchment-200/60">
              Paste raw session notes, or a quick line like "Elyne a récupéré une dague +1 sur le
              capitaine des bandits" — Claude structures it into the timeline, NPC codex, quest log,
              and party inventory automatically. This is temporary/working memory: nothing here is
              final until it lands in the chronicle.
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
                {submit.isPending ? 'Claude is reading…' : 'Process with Claude'}
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
        <h2 className="mb-3 font-display text-lg text-parchment-100">Note history</h2>
        {loading && <p className="text-sm text-parchment-200/60">Loading…</p>}
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
