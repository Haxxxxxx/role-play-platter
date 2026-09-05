import { useNavigate, useParams } from 'react-router-dom'
import { useLocations, useNpcs, useQuests, useTimeline } from '@/hooks/useChronicle'
import { findTokenLocation } from '@/hooks/useBattleMap'
import { useUiStore } from '@/store/useUiStore'
import type { Npc, NpcDisposition, QuestStatus } from '@/types/database'

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
  const navigate = useNavigate()
  const pushToast = useUiStore((s) => s.pushToast)
  const { data: timeline, loading: timelineLoading } = useTimeline(campaignId)
  const { data: npcs } = useNpcs(campaignId)
  const { data: quests } = useQuests(campaignId)
  const { data: locations } = useLocations(campaignId)

  const locationById = new Map(locations.map((l) => [l.id, l]))

  async function openNpcOnMap(npc: Npc) {
    if (!campaignId) return
    const match = await findTokenLocation({ campaignId, refNpcId: npc.id })
    if (!match) {
      pushToast(`${npc.name} n'est pas encore placé sur la carte.`, 'info')
      return
    }
    const path = match.locationId ? `/campaign/${campaignId}/map/${match.locationId}` : `/campaign/${campaignId}/map`
    navigate(path, { state: { centerTokenId: match.tokenId } })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <section>
        <h2 className="mb-4 font-display text-xl text-parchment-100">Historique du groupe</h2>
        {timelineLoading && <p className="text-parchment-200/60">Chargement…</p>}
        {!timelineLoading && timeline.length === 0 && (
          <p className="text-sm text-parchment-200/60">
            Rien pour l'instant — ajoutez une session dans <em>Notes du MJ</em> et elle apparaîtra ici.
          </p>
        )}
        <ol className="relative border-l border-ink-700 pl-6">
          {timeline.map((event) => {
            const eventLocation = event.locationId ? locationById.get(event.locationId) : null
            return (
              <li key={event.id} className="mb-6">
                <div className="absolute -ml-[29px] mt-1.5 h-2.5 w-2.5 rounded-full bg-ember-500" />
                <h3 className="font-medium text-parchment-100">{event.title}</h3>
                <p className="mt-1 text-sm text-parchment-200/70">{event.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {eventLocation && (
                    <button
                      onClick={() => navigate(`/campaign/${campaignId}/map/${eventLocation.id}`)}
                      className="rounded-full border border-ember-500/40 px-2 py-0.5 text-xs text-ember-400 hover:bg-ember-500/10"
                    >
                      📍 {eventLocation.name}
                    </button>
                  )}
                  {event.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-parchment-200/60">
                      {tag}
                    </span>
                  ))}
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <aside className="flex flex-col gap-8">
        <div>
          <h2 className="mb-3 font-display text-lg text-parchment-100">Journal des quêtes</h2>
          {quests.length === 0 && <p className="text-sm text-parchment-200/60">Aucune quête pour l'instant.</p>}
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
          <h2 className="mb-3 font-display text-lg text-parchment-100">Lieux</h2>
          {locations.length === 0 && <p className="text-sm text-parchment-200/60">Aucun lieu découvert.</p>}
          <div className="flex flex-wrap gap-1.5">
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => navigate(`/campaign/${campaignId}/map/${loc.id}`)}
                className="rounded-full border border-ink-700 bg-ink-900 px-3 py-1 text-sm text-parchment-100 hover:border-ember-500/50 hover:text-ember-400"
              >
                📍 {loc.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-display text-lg text-parchment-100">Codex des PNJ</h2>
          {npcs.length === 0 && <p className="text-sm text-parchment-200/60">Aucun PNJ pour l'instant.</p>}
          <ul className="flex flex-col gap-2">
            {npcs.map((npc) => (
              <li key={npc.id}>
                <button
                  onClick={() => openNpcOnMap(npc)}
                  className="group w-full rounded-lg border border-ink-700 bg-ink-900 p-3 text-left text-sm hover:border-ember-500/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-parchment-100">{npc.name}</span>
                    <span className={`text-xs uppercase ${DISPOSITION_COLOR[npc.disposition]}`}>
                      {npc.disposition}
                    </span>
                  </div>
                  <p className="mt-1 text-parchment-200/70">{npc.description}</p>
                  <p className="mt-1.5 text-xs text-parchment-200/0 group-hover:text-ember-400/80">
                    Voir sur la carte →
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
