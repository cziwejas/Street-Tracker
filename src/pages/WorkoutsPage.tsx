import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import type { WorkoutLayout } from '../components/AppShell'
import { repositories } from '../db/repositories'
import type { ExerciseCatalogue } from '../db/types'
import { ActiveSession } from '../features/workouts/ActiveSession'
import { WorkoutHome } from '../features/workouts/WorkoutHome'
import { useWorkoutActions } from '../features/workouts/useWorkoutActions'
import { useWorkoutData } from '../features/workouts/useWorkoutData'
import { localWorkoutDate } from '../lib/dates'

export function WorkoutsPage() {
  const { snapshot, retry } = useWorkoutData()
  const actions = useWorkoutActions()
  const { dock, openSessionId, setOpenSessionId } = useOutletContext<WorkoutLayout>()
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const active = data?.active
  const catalogue = data?.settings.exerciseCatalogue ?? 'calisthenics'

  function changeCatalogue(exerciseCatalogue: ExerciseCatalogue) {
    void actions.perform(async () => { await repositories.updateWorkoutSettings({ exerciseCatalogue }) })
  }

  if (data && active && openSessionId === active.session.id) {
    return <ActiveSession key={active.session.id} active={active} exercises={data.exercises}
      history={data.history} catalogue={catalogue} onCatalogueChange={changeCatalogue}
      actions={actions} dock={dock} onFinished={() => setOpenSessionId(null)} />
  }

  function startOrContinue() {
    if (active) {
      setOpenSessionId(active.session.id)
      return
    }
    void actions.perform(async () => {
      const now = new Date()
      const workout = await repositories.startWorkout(now.toISOString(), localWorkoutDate(now))
      setOpenSessionId(workout.session.id)
    })
  }

  return (
    <div className="safe-inline py-4">
      <h1 className="mb-3 text-2xl font-bold tracking-tight">Trening</h1>
      {actions.error && <p className="workout-error mb-3" role="alert">{actions.error}</p>}
      {snapshot.status === 'loading' && <p className="text-sm text-muted" role="status">Wczytywanie treningu…</p>}
      {snapshot.status === 'error' && <div className="workout-card" role="alert">
        <p className="mb-3 text-sm text-muted">Nie udało się odczytać treningu.</p>
        <button type="button" className="workout-button workout-secondary" onClick={retry}>Spróbuj ponownie</button>
      </div>}
      {data && <>
        <WorkoutHome catalogue={catalogue} busy={actions.busy} onCatalogueChange={changeCatalogue} />
        <p className="mt-4 text-xs text-muted"><span aria-hidden="true">✓ </span>Zapis na urządzeniu</p>
        {dock && createPortal(
          <div className="workout-dock safe-inline">
            <button type="button" className="workout-button workout-primary w-full" disabled={actions.busy} onClick={startOrContinue}>
              {active ? 'Kontynuuj trening' : 'Rozpocznij trening'}
            </button>
          </div>, dock)}
      </>}
    </div>
  )
}
