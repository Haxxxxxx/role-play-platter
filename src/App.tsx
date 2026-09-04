import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { DashboardPage } from '@/pages/DashboardPage'
import { CampaignLayout } from '@/pages/CampaignLayout'
import { ChroniclePage } from '@/pages/ChroniclePage'
import { NotesPage } from '@/pages/NotesPage'
import { PartyPage } from '@/pages/PartyPage'
import { MapPage } from '@/pages/MapPage'
import { SetupNoticePage } from '@/pages/SetupNoticePage'
import { Toaster } from '@/components/Toaster'

function App() {
  const { user, loading } = useAuth()

  if (!isSupabaseConfigured) {
    return <SetupNoticePage />
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-parchment-200/60">Loading…</div>
  }

  // No login screen for this dev phase (see useAuth) — anonymous sign-in
  // stands in for a real account. If it failed, "Anonymous sign-ins" almost
  // certainly isn't enabled yet: Supabase dashboard -> Authentication ->
  // Sign In / Providers -> Anonymous.
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-2xl text-parchment-100">Couldn't start a session</h1>
        <p className="max-w-md text-parchment-200/70">
          Enable <strong>Anonymous sign-ins</strong> in your Supabase project (Authentication → Sign In /
          Providers → Anonymous), then reload.
        </p>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/campaign/:campaignId" element={<CampaignLayout />}>
          <Route index element={<ChroniclePage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="party" element={<PartyPage />} />
          <Route path="map" element={<MapPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App
