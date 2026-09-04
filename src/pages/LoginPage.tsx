import { useState } from 'react'
import { startAsGuest, signInWithGoogle } from '@/hooks/useAuth'
import { useUiStore } from '@/store/useUiStore'

/**
 * Primary path: type a name, start playing — no account required. The
 * Google option underneath is for someone who already made an account
 * previously (on a new device/browser) and wants to get back into it, not
 * the main flow. Turning a guest into a permanent account happens later,
 * from the Profile page, once there's actually something worth saving.
 */
export function LoginPage() {
  const pushToast = useUiStore((s) => s.pushToast)
  const [name, setName] = useState('')
  const [pending, setPending] = useState<'guest' | 'google' | null>(null)

  async function handleStart(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setPending('guest')
    try {
      await startAsGuest(name)
    } catch {
      pushToast('Could not start a session — enable "Anonymous sign-ins" in Supabase Auth settings.', 'error')
      setPending(null)
    }
  }

  async function handleGoogle() {
    setPending('google')
    try {
      await signInWithGoogle()
    } catch {
      pushToast('Sign-in failed — try again.', 'error')
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

      <form onSubmit={handleStart} className="flex w-full max-w-xs flex-col items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={40}
          autoFocus
          className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-2.5 text-center text-sm outline-none focus:border-ember-500"
        />
        <button
          type="submit"
          disabled={pending !== null || !name.trim()}
          className="w-full rounded-lg bg-ember-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-ember-400 disabled:opacity-50"
        >
          {pending === 'guest' ? 'Starting…' : 'Start playing'}
        </button>
        <p className="text-xs text-parchment-200/40">
          No account needed — create and play a campaign right away. Save it to a real account later,
          from your profile, whenever you're ready.
        </p>
      </form>

      <button
        onClick={handleGoogle}
        disabled={pending !== null}
        className="text-sm text-parchment-200/60 underline decoration-dotted hover:text-parchment-100 disabled:opacity-50"
      >
        {pending === 'google' ? 'Redirecting…' : 'Already have an account? Sign in with Google'}
      </button>
    </div>
  )
}
