import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
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

    async function init() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        if (!cancelled) setState({ user: data.session.user, loading: false })
        return
      }
      const { data: anon, error } = await supabase.auth.signInAnonymously()
      if (cancelled) return
      if (error) {
        console.error('Anonymous sign-in failed — enable "Anonymous sign-ins" in Supabase Auth settings.', error)
        setState({ user: null, loading: false })
        return
      }
      setState({ user: anon.user, loading: false })
    }
    init()

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
