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
      pushToast('Impossible de démarrer une session — activez "Anonymous sign-ins" dans les réglages Auth de Supabase.', 'error')
      setPending(null)
    }
  }

  async function handleGoogle() {
    setPending('google')
    try {
      await signInWithGoogle()
    } catch {
      pushToast('Connexion échouée — réessayez.', 'error')
      setPending(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="font-display text-4xl text-parchment-100">Role Play Platter</h1>
        <p className="mt-2 max-w-md text-parchment-300">
          La chronique vivante de votre table — déposez vos notes de session, et regardez la timeline, le
          codex des PNJ, le journal des quêtes et l'historique du groupe s'écrire tout seuls.
        </p>
      </div>

      <form onSubmit={handleStart} className="flex w-full max-w-xs flex-col items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Votre nom"
          maxLength={40}
          autoFocus
          className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-2.5 text-center text-sm outline-none focus:border-ember-500"
        />
        <button
          type="submit"
          disabled={pending !== null || !name.trim()}
          className="w-full rounded-lg bg-ember-500 px-6 py-3 font-medium text-ink-950 transition hover:bg-ember-400 disabled:opacity-50"
        >
          {pending === 'guest' ? 'Démarrage…' : 'Commencer à jouer'}
        </button>
        <p className="text-xs text-parchment-400">
          Aucun compte requis — créez et jouez une campagne tout de suite. Vous pourrez la sauvegarder sur
          un vrai compte plus tard, depuis votre profil, quand vous voudrez.
        </p>
      </form>

      <button
        onClick={handleGoogle}
        disabled={pending !== null}
        className="text-sm text-parchment-300 underline decoration-dotted hover:text-parchment-100 disabled:opacity-50"
      >
        {pending === 'google' ? 'Redirection…' : 'Déjà un compte ? Se connecter avec Google'}
      </button>
    </div>
  )
}
