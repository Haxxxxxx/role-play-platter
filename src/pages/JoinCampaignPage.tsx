import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useUiStore } from '@/store/useUiStore'

/**
 * The whole invite mechanism: the campaign's (unguessable) id doubles as the
 * invite token. Visiting this route self-inserts the signed-in user (real
 * account or guest — either works) as a player via the "self join via
 * invite link" RLS policy, then drops them straight into the campaign.
 */
export function JoinCampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const pushToast = useUiStore((s) => s.pushToast)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!campaignId || !user) return
    let cancelled = false

    async function join() {
      const { error } = await supabase
        .from('campaign_members')
        .insert({ campaign_id: campaignId, user_id: user!.id, role: 'player' })
      if (cancelled) return
      // 23505 = unique_violation — already a member, that's fine, just enter.
      if (error && error.code !== '23505') {
        setFailed(true)
        return
      }
      pushToast('Vous avez rejoint la campagne !', 'success')
      navigate(`/campaign/${campaignId}`, { replace: true })
    }
    join()

    return () => {
      cancelled = true
    }
  }, [campaignId, user, navigate, pushToast])

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-2xl text-parchment-100">Impossible de rejoindre cette campagne</h1>
        <p className="max-w-md text-parchment-300">Ce lien d'invitation n'est pas valide.</p>
        <Link to="/" className="text-sm text-ember-400 hover:underline">
          ← Retour à l'accueil
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-parchment-300">
      {authLoading ? 'Connexion…' : 'Rejoindre la campagne…'}
    </div>
  )
}
