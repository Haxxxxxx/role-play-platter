import { Link } from 'react-router-dom'
import { useAuth, linkGoogleAccount, signOutUser } from '@/hooks/useAuth'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useUiStore } from '@/store/useUiStore'
import { Badge, Button, Card, EmptyState } from '@/components/ui'

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
      <Link to="/" className="mb-6 inline-block text-sm text-parchment-300 hover:text-parchment-100">
        ← Retour aux campagnes
      </Link>

      <Card className="mb-8 flex items-center gap-4">
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
          <p className="text-sm text-parchment-300">{user.email ?? 'Session invité — aucun email'}</p>
          <Badge variant={user.is_anonymous ? 'arcane' : 'success'} className="mt-1.5">
            {user.is_anonymous ? 'Compte invité' : 'Compte Google'}
          </Badge>
        </div>
      </Card>

      {user.is_anonymous && (
        <div className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-arcane-500/40 bg-arcane-500/10 px-4 py-3 text-sm">
          <span className="text-parchment-200">
            Liez un compte Google pour ne jamais perdre l'accès à vos campagnes.
          </span>
          <button
            onClick={handleLinkGoogle}
            className="shrink-0 whitespace-nowrap rounded-md bg-arcane-500 px-3 py-1.5 text-xs font-medium text-ink-950 hover:opacity-90"
          >
            Lier Google
          </button>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3">
        <Card padding="sm" className="text-center">
          <div className="font-display text-2xl text-ember-400">{gmCount}</div>
          <div className="text-xs uppercase tracking-wide text-parchment-300">Campagnes en tant que MJ</div>
        </Card>
        <Card padding="sm" className="text-center">
          <div className="font-display text-2xl text-parchment-100">{playerCount}</div>
          <div className="text-xs uppercase tracking-wide text-parchment-300">Campagnes en tant que joueur</div>
        </Card>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 font-display text-lg text-parchment-100">Vos campagnes</h2>
        {loading && <p className="text-sm text-parchment-300">Chargement…</p>}
        {!loading && campaigns.length === 0 && <EmptyState title="Aucune campagne pour le moment" />}
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                to={`/campaign/${c.id}`}
                className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900 p-3 text-sm transition hover:border-ember-500/50"
              >
                <span className="text-parchment-100">{c.name}</span>
                <Badge variant={c.gmId === user.id ? 'ember' : 'neutral'}>{c.gmId === user.id ? 'MJ' : 'Joueur'}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {user.is_anonymous ? (
        <p className="text-center text-xs text-parchment-400">
          Session invité — pas de déconnexion possible sans lier un compte Google d'abord (un compte invité n'a pas
          de mot de passe : se déconnecter le perdrait pour toujours).
        </p>
      ) : (
        <Button variant="secondary" onClick={() => signOutUser()} className="w-full">
          Se déconnecter
        </Button>
      )}
    </div>
  )
}
