import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CampaignLayout } from '@/pages/CampaignLayout'
import { ChroniclePage } from '@/pages/ChroniclePage'
import { NotesPage } from '@/pages/NotesPage'
import { PartyPage } from '@/pages/PartyPage'
import { MapPage } from '@/pages/MapPage'
import { Toaster } from '@/components/Toaster'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-parchment-200/60">Loading…</div>
  }

  return (
    <>
      <Routes>
        {!user ? (
          <Route path="*" element={<LoginPage />} />
        ) : (
          <>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/campaign/:campaignId" element={<CampaignLayout />}>
              <Route index element={<ChroniclePage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="party" element={<PartyPage />} />
              <Route path="map" element={<MapPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      <Toaster />
    </>
  )
}

export default App
