import { signInWithGoogle } from '@/hooks/useAuth'
import { useUiStore } from '@/store/useUiStore'

export function LoginPage() {
  const pushToast = useUiStore((s) => s.pushToast)

  async function handleSignIn() {
    try {
      await signInWithGoogle()
    } catch {
      pushToast('Sign-in failed — try again.', 'error')
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
      <button
        onClick={handleSignIn}
        className="rounded-lg bg-ember-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-ember-400"
      >
        Sign in with Google
      </button>
    </div>
  )
}
