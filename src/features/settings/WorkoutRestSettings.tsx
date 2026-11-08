import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { repositories } from '../../db/repositories'
import type { WorkoutSettings } from '../../db/types'
import { RestSettings } from '../workouts/SetFields'
import { useWorkoutActions } from '../workouts/useWorkoutActions'

export function WorkoutRestSettings() {
  const [settings, setSettings] = useState<WorkoutSettings>()
  const [attempt, setAttempt] = useState(0)
  const [readFailed, setReadFailed] = useState(false)
  const [savedDuration, setSavedDuration] = useState<number>()
  const { busy, error, perform } = useWorkoutActions()

  useEffect(() => {
    const subscription = liveQuery(() => repositories.getWorkoutSettings()).subscribe({
      next: setSettings,
      error: () => setReadFailed(true),
    })
    return () => subscription.unsubscribe()
  }, [attempt])

  return (
    <section className="workout-card mb-5" aria-labelledby="rest-settings-heading">
      <h2 id="rest-settings-heading" className="text-lg font-semibold">Przerwa między seriami</h2>
      {readFailed ? <div className="mt-3" role="alert">
        <p className="text-sm text-muted">Nie udało się odczytać czasu przerwy.</p>
        <button type="button" className="workout-button workout-secondary mt-2"
          onClick={() => { setReadFailed(false); setAttempt(attempt + 1) }}>Spróbuj ponownie</button>
      </div> : settings ? <>
        <RestSettings key={settings.restDurationSec} settings={settings} busy={busy} onSave={(restDurationSec) => {
          setSavedDuration(undefined)
          void perform(async () => {
            await repositories.updateWorkoutSettings({ restDurationSec })
            setSavedDuration(restDurationSec)
          })
        }} />
        {error && <p role="alert" className="workout-error mt-3">{error}</p>}
        {savedDuration === settings.restDurationSec && <p role="status" className="mt-3 text-xs text-accent">Zapisano. Zmiana od następnej serii.</p>}
      </> : <p role="status" className="mt-3 text-sm text-muted">Wczytywanie czasu przerwy…</p>}
    </section>
  )
}
