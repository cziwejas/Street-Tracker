import { SettingsPanel } from '../features/settings/SettingsPanel'
import { WorkoutRestSettings } from '../features/settings/WorkoutRestSettings'

export function SettingsPage() {
  return <div>
    <h1 className="mb-2 text-3xl font-bold tracking-tight">Ustawienia</h1>
    <p className="mb-6 text-sm leading-relaxed text-muted">Przerwy, kopie zapasowe i przechowywanie danych.</p>
    <WorkoutRestSettings />
    <SettingsPanel />
  </div>
}
