import { supabase } from '@/lib/supabase'
import { useSupabaseCollection } from '@/hooks/useSupabaseCollection'

export interface ReferenceEntry {
  name: string
  description: string
}

export interface SystemReferenceState {
  classes: ReferenceEntry[]
  skills: ReferenceEntry[]
}

interface SystemReferenceRow {
  campaign_id: string
  classes: ReferenceEntry[]
  skills: ReferenceEntry[]
}

/** At most one row per campaign — reuses useSupabaseCollection (which
 * filters by a column, here campaign_id) rather than a bespoke single-row
 * hook, so it gets the same live-update-on-any-change behavior for free. */
export function useSystemReference(campaignId: string | undefined) {
  const { data, loading } = useSupabaseCollection<SystemReferenceRow, SystemReferenceState>({
    table: 'system_reference',
    filterColumn: 'campaign_id',
    filterValue: campaignId,
    mapRow: (row) => ({ classes: row.classes ?? [], skills: row.skills ?? [] }),
  })
  return { reference: data[0] ?? null, loading }
}

/**
 * Calls the Gemini-backed endpoint that (re)generates the class/skill list
 * for this campaign's system. GM-only server-side; nothing here enforces
 * that client-side beyond not showing the button to a player.
 */
export async function generateSystemReference(campaignId: string): Promise<SystemReferenceState> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in.')

  const response = await fetch('/api/generate-system-reference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ campaignId }),
  })

  const body = (await response.json()) as SystemReferenceState | { error: string }
  if (!response.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : 'Failed to generate the system reference.')
  }
  return body
}
