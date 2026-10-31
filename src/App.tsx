import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ExercisesPage } from './pages/ExercisesPage'
import { ProgressPage } from './pages/ProgressPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkoutsPage } from './pages/WorkoutsPage'
import { HistoryPage } from './pages/HistoryPage'
import { SessionDetailPage } from './pages/SessionDetailPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WorkoutsPage />} />
        <Route path="historia" element={<HistoryPage />} />
        <Route path="historia/:sessionId" element={<SessionDetailPage />} />
        <Route path="cwiczenia" element={<ExercisesPage />} />
        <Route path="progres" element={<ProgressPage />} />
        <Route path="ustawienia" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
