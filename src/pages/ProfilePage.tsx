import { Link } from 'react-router-dom'
import { useAuth, linkGoogleAccount, signOutUser } from '@/hooks/useAuth'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useUiStore } from '@/store/useUiStore'

export function ProfilePage() {
  const { user } = useAuth()
  const { campaigns, loading } = useCampaigns(user?.id ?? null)
  const pushToast = useUiStore((s) => s.pushToast)

  if (!user) return null

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? null
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  async function handleLinkGoogle() {
    try {
      await linkGoogleAccount()
    } catch {
      pushToast('Impossible de lier un compte Google — réessayez.', 'error')
    }
  }

  const gmCount = campaigns.filter((c) => c.gmId === user.id).length
  const playerCount = campaigns.length - gmCount

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="mb-6 inline-block text-sm text-parchment-200/60 hover:text-parchment-100">
        ← Retour aux campagnes
      </Link>

      <div className="mb-8 flex items-center gap-4 rounded-xl border border-ink-700 bg-ink-900 p-5">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full border border-ink-700" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-2xl">
            {user.is_anonymous ? '🎭' : '🧑'}
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl text-parchment-100">
            {displayName ?? user.email ?? 'Invité'}
          </h1>
          <p className="text-sm text-parchment-200/60">{user.email ?? 'Session invité — aucun email'}</p>
          <span
            className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              user.is_anonymous ? 'border-arcane-500/50 text-arcane-500' : 'border-emerald-500/50 text-emerald-400'
            }`}
          >
            {user.is_anonymous ? 'Compte invité' : 'Compte Google'}
          </span>
        </div>
      </div>

      {user.is_anonymous && (
        <div className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-arcane-500/40 bg-arcane-500/10 px-4 py-3 text-sm">
          <span className="text-parchment-200/80">
            Liez un compte Google pour ne jamais perdre l'accès à vos campagnes.
          </span>
          <button
            onClick={handleLinkGoogle}
            className="shrink-0 rounded-md bg-arcane-500 px-3 py-1.5 text-xs font-medium text-ink-950 hover:opacity-90"
          >
            Lier Google
          </button>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-ink-700 bg-ink-900 p-4 text-center">
          <div className="font-display text-2xl text-ember-400">{gmCount}</div>
          <div className="text-xs uppercase tracking-wide text-parchment-200/50">Campagnes en tant que MJ</div>
        </div>
        <div className="rounded-lg border border-ink-700 bg-ink-900 p-4 text-center">
          <div className="font-display text-2xl text-parchment-100">{playerCount}</div>
          <div className="text-xs uppercase tracking-wide text-parchment-200/50">Campagnes en tant que joueur</div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 font-display text-lg text-parchment-100">Vos campagnes</h2>
        {loading && <p className="text-sm text-parchment-200/60">Chargement…</p>}
        {!loading && campaigns.length === 0 && (
          <p className="text-sm text-parchment-200/60">Aucune campagne pour le moment.</p>
        )}
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                to={`/campaign/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900 p-3 text-sm hover:border-ember-500/50"
              >
                <span className="text-parchment-100">{c.name}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    c.gmId === user.id ? 'border-ember-500/50 text-ember-400' : 'border-ink-700 text-parchment-200/50'
                  }`}
                >
                  {c.gmId === user.id ? 'MJ' : 'Joueur'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {user.is_anonymous ? (
        <p className="text-center text-xs text-parchment-200/40">
          Session invité — pas de déconnexion possible sans lier un compte Google d'abord (un compte invité n'a pas
          de mot de passe : se déconnecter le perdrait pour toujours).
        </p>
      ) : (
        <button
          onClick={() => signOutUser()}
          className="w-full rounded-md border border-ink-700 py-2 text-sm text-parchment-200/70 hover:bg-ink-800"
        >
          Se déconnecter
        </button>
      )}
    </div>
  )
}
