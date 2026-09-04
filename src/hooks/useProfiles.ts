import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  isAnonymous: boolean
}

interface ProfileRow {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  is_anonymous: boolean
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isAnonymous: row.is_anonymous,
  }
}

/**
 * Looks a user up by email (or display name, for Google accounts) to invite
 * them onto a campaign directly instead of just handing out a blind link —
 * only finds people who've already signed into the app at least once
 * (that's what populates `profiles`); a guest who's never opened it still
 * needs the invite-link flow.
 */
export async function searchProfiles(query: string, excludeUserId?: string): Promise<Profile[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  let q = supabase
    .from('profiles')
    .select('*')
    .or(`email.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
    .limit(5)
  if (excludeUserId) q = q.neq('id', excludeUserId)

  const { data, error } = await q
  if (error) throw error
  return (data as ProfileRow[]).map(mapProfile)
}
