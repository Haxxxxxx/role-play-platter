import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
}

/**
 * No more auto-anonymous sign-in — that was fine for solo dev use, but real
 * multi-user play needs an actual account so a friend joining a campaign is
 * still them next time they open the app. LoginPage now offers a real
 * choice: sign in with Google, or continue as a guest (anonymous) — either
 * way `session_notes`/`campaign_members` RLS treats auth.uid() the same.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setState({ user: data.session?.user ?? null, loading: false })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setState({ user: session?.user ?? null, loading: false })
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return state
}

/**
 * The primary path in for a brand-new visitor: no account, just a name —
 * try the whole app (create/edit/play a campaign) before ever signing up.
 * Still a real anonymous Supabase user under the hood (so campaign
 * ownership, RLS, everything works identically to a Google account), just
 * with the name captured immediately instead of staying nameless. The
 * `handle_user_updated` trigger (0007 migration) syncs it into `profiles`
 * automatically, which is what makes a guest findable-by-name for invites.
 */
export async function startAsGuest(name: string): Promise<void> {
  const { error: signInError } = await supabase.auth.signInAnonymously()
  if (signInError) throw signInError
  const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
  if (updateError) throw updateError
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

/**
 * Upgrades the *current* anonymous session to a real Google account in
 * place — same auth.uid(), so any campaign this guest already GMs or plays
 * in stays theirs. A fresh signInWithGoogle() would instead create a brand
 * new user and orphan all of that.
 */
export async function linkGoogleAccount(): Promise<void> {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOutUser(): Promise<void> {
  await supabase.auth.signOut()
}
