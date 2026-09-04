import { useParams } from 'react-router-dom'
import { useNpcs, useQuests, useTimeline } from '@/hooks/useChronicle'
import type { NpcDisposition, QuestStatus } from '@/types/firestore'

const DISPOSITION_COLOR: Record<NpcDisposition, string> = {
  ally: 'text-emerald-400',
  enemy: 'text-red-400',
  neutral: 'text-parchment-200/70',
  unknown: 'text-parchment-200/40',
}

const QUEST_STATUS_COLOR: Record<QuestStatus, string> = {
  active: 'border-arcane-500/50 text-arcane-500',
  completed: 'border-emerald-500/50 text-emerald-400',
  failed: 'border-red-500/50 text-red-400',
}

export function ChroniclePage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { data: timeline, loading: timelineLoading } = useTimeline(campaignId)
  const { data: npcs } = useNpcs(campaignId)
  const { data: quests } = useQuests(campaignId)

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <section>
        <h2 className="mb-4 font-display text-xl text-parchment-100">Party History</h2>
        {timelineLoading && <p className="text-parchment-200/60">Loading…</p>}
        {!timelineLoading && timeline.length === 0 && (
          <p className="text-sm text-parchment-200/60">
            Nothing recorded yet — add a session in <em>GM Notes</em> and it'll appear here.
          </p>
        )}
        <ol className="relative border-l border-ink-700 pl-6">
          {timeline.map((event) => (
            <li key={event.id} className="mb-6">
              <div className="absolute -ml-[29px] mt-1.5 h-2.5 w-2.5 rounded-full bg-ember-500" />
              <h3 className="font-medium text-parchment-100">{event.title}</h3>
              <p className="mt-1 text-sm text-parchment-200/70">{event.description}</p>
              {event.tags.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {event.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-parchment-200/60">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <aside className="flex flex-col gap-8">
        <div>
          <h2 className="mb-3 font-display text-lg text-parchment-100">Quest Log</h2>
          {quests.length === 0 && <p className="text-sm text-parchment-200/60">No quests yet.</p>}
          <ul className="flex flex-col gap-2">
            {quests.map((q) => (
              <li key={q.id} className={`rounded-lg border p-3 text-sm ${QUEST_STATUS_COLOR[q.status]}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-parchment-100">{q.title}</span>
                  <span className="text-xs uppercase">{q.status}</span>
                </div>
                <p className="mt-1 text-parchment-200/70">{q.description}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-3 font-display text-lg text-parchment-100">NPC Codex</h2>
          {npcs.length === 0 && <p className="text-sm text-parchment-200/60">No NPCs recorded yet.</p>}
          <ul className="flex flex-col gap-2">
            {npcs.map((npc) => (
              <li key={npc.id} className="rounded-lg border border-ink-700 bg-ink-900 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-parchment-100">{npc.name}</span>
                  <span className={`text-xs uppercase ${DISPOSITION_COLOR[npc.disposition]}`}>
                    {npc.disposition}
                  </span>
                </div>
                <p className="mt-1 text-parchment-200/70">{npc.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
