import type { Exercise, ExerciseHistoryEntry, SetEntry, WorkoutDraft } from '../../db/types'

export function localWorkoutDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const remainder = String(whole % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`
}

export function remainingRestSeconds(endsAt: number | null, now: number): number {
  return endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000))
}

export function draftFromSet(set: SetEntry, exercise: Exercise): WorkoutDraft {
  return {
    reps: set.reps ?? 8,
    durationSec: set.durationSec ?? 30,
    addedWeightKg: exercise.supportsAddedWeight ? set.addedWeightKg ?? 0 : 0,
    variant: set.variant,
  }
}

/** History is newest session first, but ascending set order within each session. */
export function previousExerciseSet(history: ExerciseHistoryEntry[]): ExerciseHistoryEntry | undefined {
  const newestSessionId = history[0]?.session.id
  return history.filter((entry) => entry.session.id === newestSessionId).at(-1)
}

export function describeSet(set: SetEntry, exercise: Exercise): string {
  const value = exercise.trackingType === 'time' ? `${set.durationSec ?? 0} s` : `${set.reps ?? 0} powt.`
  return `${value}${exercise.supportsAddedWeight && (set.addedWeightKg ?? 0) > 0 ? ` · +${set.addedWeightKg?.toLocaleString('pl-PL')} kg` : ''}`
}
