import { SettingsPanel } from '../features/settings/SettingsPanel'

export function SettingsPage() {
  return <div>
    <h1 className="mb-2 text-3xl font-bold tracking-tight">Ustawienia</h1>
    <p className="mb-6 text-sm leading-relaxed text-muted">Kopie zapasowe i przechowywanie danych na urządzeniu.</p>
    <SettingsPanel />
  </div>
}
