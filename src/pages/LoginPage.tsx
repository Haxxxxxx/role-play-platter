import { useState } from 'react'
import { continueAsGuest, signInWithGoogle } from '@/hooks/useAuth'
import { useUiStore } from '@/store/useUiStore'

export function LoginPage() {
  const pushToast = useUiStore((s) => s.pushToast)
  const [pending, setPending] = useState<'google' | 'guest' | null>(null)

  async function handleGoogle() {
    setPending('google')
    try {
      await signInWithGoogle()
    } catch {
      pushToast('Sign-in failed — try again.', 'error')
      setPending(null)
    }
  }

  async function handleGuest() {
    setPending('guest')
    try {
      await continueAsGuest()
    } catch {
      pushToast(
        'Could not start a guest session — enable "Anonymous sign-ins" in Supabase Auth settings.',
        'error',
      )
      setPending(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="font-display text-4xl text-parchment-100">Role Play Platter</h1>
        <p className="mt-2 max-w-md text-parchment-200/70">
          A living chronicle for your table — drop in session notes, watch the timeline, NPC codex,
          quest log, and party history write themselves.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleGoogle}
          disabled={pending !== null}
          className="rounded-lg bg-ember-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-ember-400 disabled:opacity-50"
        >
          {pending === 'google' ? 'Redirecting…' : 'Sign in with Google'}
        </button>
        <button
          onClick={handleGuest}
          disabled={pending !== null}
          className="text-sm text-parchment-200/60 underline decoration-dotted hover:text-parchment-100 disabled:opacity-50"
        >
          {pending === 'guest' ? 'Starting…' : 'Continue as a guest instead'}
        </button>
      </div>
    </div>
  )
}
