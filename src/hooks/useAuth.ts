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

export async function continueAsGuest(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
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
