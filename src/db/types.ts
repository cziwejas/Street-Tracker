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

/** Values for the next set, persisted even before the set is logged. */
export interface WorkoutDraft {
  reps: number
  durationSec: number
  addedWeightKg: number
  /** Explicit weighted-mode selection; old drafts infer it from positive added weight. */
  withAddedWeight?: boolean
  variant?: string
}

export interface WorkoutState {
  sessionId: string
  exerciseIds: string[]
  activeExerciseId: string | null
  drafts: Record<string, WorkoutDraft>
  /** Absolute Unix milliseconds; survives suspension and app restarts. */
  restEndsAt: number | null
}

export interface WorkoutSettings {
  id: 'workouts'
  /** Zero disables automatic rest. */
  restDurationSec: number
}

export interface BackupMetadata {
  id: 'backup'
  /** Time the last JSON download was requested on this device. */
  lastExportedAt: string
}

export interface BackupData {
  exercises: Exercise[]
  workoutSessions: WorkoutSession[]
  setEntries: SetEntry[]
  workoutStates: WorkoutState[]
  workoutSettings: WorkoutSettings[]
  backupMetadata: BackupMetadata[]
}

export type ImportMode = 'merge' | 'replace'

export interface ActiveWorkout {
  session: WorkoutSession
  state: WorkoutState
  sets: SetEntry[]
}

export interface HistorySession {
  session: WorkoutSession
  sets: SetEntry[]
}

export interface WorkoutHistory {
  exercises: Exercise[]
  /** Completed sessions, newest first, including sessions without sets. */
  sessions: HistorySession[]
}
