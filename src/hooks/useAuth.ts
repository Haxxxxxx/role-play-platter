import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
}

// Module-level, not component-level: memoizes the in-flight/completed
// anonymous sign-in across every useAuth() call in this page load, so React
// StrictMode's dev-only double-invoke of the effect (mount -> cleanup ->
// mount again) can't fire signInAnonymously() twice and spawn two throwaway
// accounts — every caller awaits the same promise instead of starting a
// fresh sign-in.
let sessionPromise: Promise<User | null> | null = null

function ensureSession(): Promise<User | null> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) return data.session.user
      const { data: anon, error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error('Anonymous sign-in failed — enable "Anonymous sign-ins" in Supabase Auth settings.', error)
        sessionPromise = null // allow a retry on the next mount
        return null
      }
      return anon.user
    })()
  }
  return sessionPromise
}

/**
 * Dev-phase auth: no login screen yet — this is inside-only use until real
 * accounts matter (friends joining parties). Signs in anonymously so
 * `auth.uid()` still exists and Row Level Security keeps working exactly as
 * written; the session persists in the browser (localStorage) across
 * reloads, so campaigns created now stay owned by the same anonymous user.
 * Swap this for `signInWithGoogle` + a real login screen when it's time —
 * Supabase can upgrade an anonymous session to a real one in place
 * (`supabase.auth.updateUser` / `linkIdentity`), no data migration needed.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    let cancelled = false

    ensureSession().then((user) => {
      if (!cancelled) setState({ user, loading: false })
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

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOutUser(): Promise<void> {
  await supabase.auth.signOut()
}
