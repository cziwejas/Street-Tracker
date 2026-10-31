import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { repositories } from '../../db/repositories'
import type { ActiveWorkout, Exercise, ExerciseHistoryEntry, WorkoutSettings } from '../../db/types'

interface WorkoutData {
  active: ActiveWorkout | undefined
  exercises: Exercise[]
  settings: WorkoutSettings
  history: Record<string, ExerciseHistoryEntry[]>
}

type Snapshot = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: WorkoutData }

export function useWorkoutData() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const subscription = liveQuery(async (): Promise<WorkoutData> => {
      const [active, exercises, settings] = await Promise.all([
        repositories.getActiveWorkout(),
        repositories.listExercises(),
        repositories.getWorkoutSettings(),
      ])
      const selectedId = active?.state.activeExerciseId
      const history = selectedId ? { [selectedId]: await repositories.getHistoryForExercise(selectedId) } : {}
      return { active, exercises, settings, history }
    }).subscribe({
      next: (data) => setSnapshot({ status: 'ready', data }),
      error: () => setSnapshot({ status: 'error' }),
    })
    return () => subscription.unsubscribe()
  }, [attempt])

  return { snapshot, retry: () => setAttempt((value) => value + 1) }
}
