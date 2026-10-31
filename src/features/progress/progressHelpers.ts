import type { Exercise, HistorySession, SetEntry, WorkoutHistory } from '../../db/types'

export interface PersonalRecord {
  setId: string
  sessionId: string
  exerciseId: string
  variant: string
  addedWeightKg: number
  date: string
  value: number
  previousValue: number | undefined
  unit: 's' | 'powt.'
}

export interface ExerciseScope {
  variant: string
  addedWeightKg: number
}

export interface ProgressPoint {
  sessionId: string
  date: string
  best: number
  volume: number | null
  isPr: boolean
}

export interface VolumeSummary {
  estimatedKgReps: number
  repsWithoutBodyweight: number
  durationSec: number
}

export function formatNumber(value: number): string {
  return value.toLocaleString('pl-PL', { maximumFractionDigits: 2 })
}

function setValue(set: SetEntry, exercise: Exercise): number {
  return (exercise.trackingType === 'time' ? set.durationSec : set.reps) ?? 0
}

export function matchesScope(set: SetEntry, scope: ExerciseScope): boolean {
  return (set.variant ?? '') === scope.variant && (set.addedWeightKg ?? 0) === scope.addedWeightKg
}

/** Strict improvements per exercise, variant and added load. First positive result establishes a PR. */
export function findPersonalRecords(history: WorkoutHistory): Map<string, PersonalRecord> {
  const exercises = new Map(history.exercises.map((exercise) => [exercise.id, exercise]))
  const best = new Map<string, number>()
  const records = new Map<string, PersonalRecord>()
  // Repository order is newest first; reverse a copy so date filters never reset PRs.
  for (const { session, sets } of [...history.sessions].reverse()) {
    for (const set of sets) {
      const exercise = exercises.get(set.exerciseId)
      if (!exercise) continue
      const value = setValue(set, exercise)
      if (value <= 0) continue
      const variant = set.variant ?? ''
      const addedWeightKg = set.addedWeightKg ?? 0
      const key = JSON.stringify([exercise.id, variant, addedWeightKg])
      const previousValue = best.get(key)
      if (previousValue !== undefined && value <= previousValue) continue
      best.set(key, value)
      records.set(set.id, {
        setId: set.id, sessionId: session.id, exerciseId: exercise.id,
        variant, addedWeightKg, date: session.date, value, previousValue,
        unit: exercise.trackingType === 'time' ? 's' : 'powt.',
      })
    }
  }
  return records
}

/** Do not add seconds, repetitions and kg·repetitions into a single misleading number. */
export function summarizeVolume({ session, sets }: HistorySession, exercises: Exercise[]): VolumeSummary {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const summary: VolumeSummary = { estimatedKgReps: 0, repsWithoutBodyweight: 0, durationSec: 0 }
  for (const set of sets) {
    const exercise = byId.get(set.exerciseId)
    if (!exercise) continue
    const value = setValue(set, exercise)
    if (exercise.trackingType === 'time') summary.durationSec += value
    else if (session.bodyweight === undefined) summary.repsWithoutBodyweight += value
    else summary.estimatedKgReps += value * (session.bodyweight + (set.addedWeightKg ?? 0))
  }
  return summary
}

export function describeVolume(summary: VolumeSummary): string {
  const parts: string[] = []
  if (summary.estimatedKgReps > 0) parts.push(`${formatNumber(summary.estimatedKgReps)} kg·powt.`)
  if (summary.repsWithoutBodyweight > 0) parts.push(`${formatNumber(summary.repsWithoutBodyweight)} powt. bez masy ciała`)
  if (summary.durationSec > 0) parts.push(`${formatNumber(summary.durationSec)} s`)
  return parts.join(' · ') || 'Brak objętości'
}

export function buildExerciseSeries(history: WorkoutHistory, exercise: Exercise, scope: ExerciseScope,
  records: ReadonlyMap<string, PersonalRecord>): ProgressPoint[] {
  return [...history.sessions].reverse().flatMap((entry) => {
    const sets = entry.sets.filter((set) => set.exerciseId === exercise.id && matchesScope(set, scope) && setValue(set, exercise) > 0)
    if (!sets.length) return []
    const volume = summarizeVolume({ ...entry, sets }, [exercise])
    return [{
      sessionId: entry.session.id, date: entry.session.date,
      best: Math.max(...sets.map((set) => setValue(set, exercise))),
      volume: exercise.trackingType === 'time' ? volume.durationSec
        : entry.session.bodyweight === undefined ? null : volume.estimatedKgReps,
      isPr: sets.some((set) => records.has(set.id)),
    }]
  })
}
