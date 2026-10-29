export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'core' | 'skills'
export type TrackingType = 'reps' | 'time' | 'reps_weight'

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  trackingType: TrackingType
  supportsAddedWeight: boolean
  /** Progression steps in display order, from easiest to hardest. */
  variants: string[]
  isCustom: boolean
}

export interface WorkoutSession {
  id: string
  /** Local calendar day in YYYY-MM-DD format; never derived from UTC by the DB. */
  date: string
  /** ISO 8601 UTC timestamp. */
  startedAt: string
  /** null while the session is in progress. */
  endedAt: string | null
  /** Bodyweight in kilograms. */
  bodyweight?: number
  notes: string
}

export interface SetEntry {
  id: string
  sessionId: string
  exerciseId: string
  /** A label snapshot, kept even if exercise progression labels later change. */
  variant?: string
  /** Zero-based position within the entire session. */
  order: number
  reps?: number
  durationSec?: number
  addedWeightKg?: number
  repsInReserve?: number
  note: string
}

export type NewExercise = Omit<Exercise, 'id' | 'isCustom' | 'variants'> & {
  variants?: string[]
}
export type ExerciseChanges = Partial<Omit<Exercise, 'id' | 'isCustom'>>

export type NewWorkoutSession = Omit<WorkoutSession, 'id' | 'endedAt' | 'notes'> & {
  endedAt?: string | null
  notes?: string
}
export type WorkoutSessionChanges = Partial<Omit<WorkoutSession, 'id'>>

export type NewSetEntry = Omit<SetEntry, 'id' | 'note'> & { note?: string }
export type SetEntryChanges = Partial<Omit<SetEntry, 'id'>>

export interface ExerciseHistoryEntry {
  set: SetEntry
  session: WorkoutSession
}
