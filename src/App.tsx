import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CampaignLayout } from '@/pages/CampaignLayout'
import { ChroniclePage } from '@/pages/ChroniclePage'
import { ScenarioPage } from '@/pages/ScenarioPage'
import { NotesPage } from '@/pages/NotesPage'
import { PartyPage } from '@/pages/PartyPage'
import { CharacterPage } from '@/pages/CharacterPage'
import { MapPage } from '@/pages/MapPage'
import { LocationMapPage } from '@/pages/LocationMapPage'
import { JoinCampaignPage } from '@/pages/JoinCampaignPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SetupNoticePage } from '@/pages/SetupNoticePage'
import { Toaster } from '@/components/Toaster'

function App() {
  const { user, loading } = useAuth()

  if (!isSupabaseConfigured) {
    return <SetupNoticePage />
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-parchment-200/60">Chargement…</div>
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/campaign/:campaignId/join" element={<JoinCampaignPage />} />
        <Route path="/campaign/:campaignId" element={<CampaignLayout />}>
          <Route index element={<ChroniclePage />} />
          <Route path="scenario" element={<ScenarioPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="party" element={<PartyPage />} />
          <Route path="character/:characterId" element={<CharacterPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="map/:locationId" element={<LocationMapPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App
