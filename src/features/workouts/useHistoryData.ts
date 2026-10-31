import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { repositories } from '../../db/repositories'
import type { WorkoutHistory } from '../../db/types'

type HistorySnapshot = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: WorkoutHistory }

export function useHistoryData() {
  const [snapshot, setSnapshot] = useState<HistorySnapshot>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const subscription = liveQuery(() => repositories.getWorkoutHistory()).subscribe({
      next: (data) => setSnapshot({ status: 'ready', data }),
      error: () => setSnapshot({ status: 'error' }),
    })
    return () => subscription.unsubscribe()
  }, [attempt])

  return { snapshot, retry: () => setAttempt((value) => value + 1) }
}
