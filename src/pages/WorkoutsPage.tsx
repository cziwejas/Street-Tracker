import { useState } from 'react'
import { Icon } from '../components/Icon'
import { repositories } from '../db/repositories'
import { ActiveSession } from '../features/workouts/ActiveSession'
import { useWorkoutActions } from '../features/workouts/useWorkoutActions'
import { useWorkoutData } from '../features/workouts/useWorkoutData'
import { localWorkoutDate } from '../features/workouts/workoutHelpers'

export function WorkoutsPage() {
  const { snapshot, retry } = useWorkoutData()
  const actions = useWorkoutActions()
  const [finished, setFinished] = useState(false)
  const active = snapshot.status === 'ready' ? snapshot.data.active : undefined

  return (
    <div className={active ? 'workout-page workout-active' : 'workout-page'}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Trening</h1>
        <p className="text-xs text-muted">{new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' }).format(new Date())}</p>
      </div>
      {actions.error && <p className="workout-error mb-5" role="alert">{actions.error}</p>}
      {snapshot.status === 'loading' && <p className="text-sm text-muted" role="status">Wczytywanie treningu…</p>}
      {snapshot.status === 'error' && <div className="workout-card" role="alert"><p className="mb-4 text-sm text-muted">Nie udało się odczytać treningu z pamięci urządzenia.</p><button type="button" className="workout-button workout-secondary" onClick={retry}>Spróbuj ponownie</button></div>}
      {snapshot.status === 'ready' && (active ? (
        <ActiveSession key={active.session.id} active={active} exercises={snapshot.data.exercises} history={snapshot.data.history}
          settings={snapshot.data.settings} actions={actions} onFinished={() => setFinished(true)} />
      ) : (
        <>
          <section className="workout-card mt-10 py-9 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-accent/20 bg-accent/10 text-accent"><Icon name="workouts" width={38} height={38} /></div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">{finished ? 'Dobra robota' : 'Twój czas na progres'}</p>
            <h2 className="mb-3 text-2xl font-semibold tracking-tight">{finished ? 'Trening zapisany' : 'Gotowość do treningu?'}</h2>
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted">{finished ? 'Wszystkie serie są zapisane na tym urządzeniu. Czas na regenerację.' : 'Wybierz ćwiczenia, zapisuj serie i skup się na kolejnym powtórzeniu.'}</p>
          </section>
          <p className="mt-5 text-center text-xs leading-relaxed text-muted">Trening zapisuje się automatycznie.<br />Możesz zamknąć aplikację i wrócić do niego później.</p>
          <div className="workout-dock safe-inline">
            <button type="button" className="workout-button workout-primary w-full text-base" disabled={actions.busy} onClick={() => { void actions.perform(async () => {
              const now = new Date()
              await repositories.startWorkout(now.toISOString(), localWorkoutDate(now))
              setFinished(false)
            }) }}>{actions.busy ? 'Rozpoczynanie…' : 'Rozpocznij trening'}</button>
          </div>
        </>
      ))}
      {snapshot.status === 'ready' && <p role="status" className="mt-6 text-center text-[11px] text-muted">{actions.error ? 'Zmiany nie zostały zapisane' : actions.pending > 0 ? 'Zapisywanie na urządzeniu…' : 'Zapisano na urządzeniu'}</p>}
    </div>
  )
}
