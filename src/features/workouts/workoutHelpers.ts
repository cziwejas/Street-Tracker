import type { Exercise, ExerciseHistoryEntry, SetEntry, WorkoutDraft } from '../../db/types'

export { localWorkoutDate } from '../../lib/dates'

const pluralRules = new Intl.PluralRules('pl-PL')
const countLabels = {
  series: { one: 'seria', few: 'serie', other: 'serii' },
  exercises: { one: 'ćwiczenie', few: 'ćwiczenia', other: 'ćwiczeń' },
  workouts: { one: 'trening', few: 'treningi', other: 'treningów' },
}

export function formatWorkoutCount(count: number, kind: keyof typeof countLabels): string {
  const forms = countLabels[kind]
  const category = pluralRules.select(count)
  return `${count} ${category === 'one' || category === 'few' ? forms[category] : forms.other}`
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

export function describeSetValue(set: SetEntry, exercise: Exercise): string {
  return exercise.trackingType === 'time' ? `${set.durationSec ?? 0} s` : `${set.reps ?? 0} powt.`
}

export function describeSet(set: SetEntry, exercise: Exercise): string {
  return `${describeSetValue(set, exercise)}${exercise.supportsAddedWeight && (set.addedWeightKg ?? 0) > 0 ? ` · +${set.addedWeightKg?.toLocaleString('pl-PL')} kg` : ''}`
}
