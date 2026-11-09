import type { BackupData, BackupMetadata, ExerciseCategory, TrackingType, WorkoutDraft, WorkoutSettings } from './types'
import { isExerciseCatalogue, normalizeExercise, normalizeSession, normalizeTimestamp, RepositoryError, validateSetEntry } from './validation'

function invalid(message: string): never {
  throw new RepositoryError('VALIDATION', `Nieprawidłowa kopia JSON: ${message}`)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requireObject(value: unknown): Record<string, unknown> {
  if (!isObject(value)) invalid('oczekiwano obiektu.')
  return value
}

function text(value: unknown): string {
  if (typeof value !== 'string') invalid('oczekiwano tekstu.')
  return value
}

function id(value: unknown): string {
  const result = text(value)
  if (!result.trim() || Object.hasOwn(Object.prototype, result) || result === 'prototype') invalid('błędny identyfikator.')
  return result
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') invalid('oczekiwano wartości logicznej.')
  return value
}

function numeric(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid('oczekiwano skończonej liczby.')
  return value
}

function optionalNumber(value: unknown): number | undefined {
  return value === undefined ? undefined : numeric(value)
}

function optionalText(value: unknown): string | undefined {
  return value === undefined ? undefined : text(value)
}

function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) invalid('brakuje wymaganej listy danych.')
  return value.map(parse)
}

function unique<T>(rows: T[], key: (row: T) => string): T[] {
  if (new Set(rows.map(key)).size !== rows.length) invalid('identyfikatory w tabeli muszą być unikalne.')
  return rows
}

function category(value: unknown): ExerciseCategory {
  if (value === 'push' || value === 'pull' || value === 'legs' || value === 'core' || value === 'skills') return value
  return invalid('nieznana kategoria ćwiczenia.')
}

function trackingType(value: unknown): TrackingType {
  if (value === 'reps' || value === 'time' || value === 'reps_weight') return value
  return invalid('nieznany sposób pomiaru ćwiczenia.')
}

function draft(value: unknown): WorkoutDraft {
  const row = requireObject(value)
  const result: WorkoutDraft = {
    reps: numeric(row.reps),
    durationSec: numeric(row.durationSec),
    addedWeightKg: numeric(row.addedWeightKg),
    ...(row.variant === undefined ? {} : { variant: text(row.variant) }),
    ...(row.withAddedWeight === undefined ? {} : { withAddedWeight: bool(row.withAddedWeight) }),
  }
  if (!Number.isInteger(result.reps) || result.reps < 0 || result.durationSec < 0 || result.addedWeightKg < 0
    || (result.variant !== undefined && !result.variant.trim())
    || (result.withAddedWeight === false && result.addedWeightKg > 0)) invalid('błędne wartości szkicu serii.')
  return result
}

/** Untrusted file data must pass structural, domain and reference validation before any writes. */
export function validateBackupData(value: unknown): BackupData {
  const data = requireObject(value)
  const exercises = unique(list(data.exercises, (value) => {
    const row = requireObject(value)
    return normalizeExercise({
      id: id(row.id), name: text(row.name), category: category(row.category), trackingType: trackingType(row.trackingType),
      supportsAddedWeight: bool(row.supportsAddedWeight), variants: list(row.variants, text), isCustom: bool(row.isCustom),
    })
  }), (row) => row.id)
  const workoutSessions = unique(list(data.workoutSessions, (value) => {
    const row = requireObject(value)
    return normalizeSession({
      id: id(row.id), date: text(row.date), startedAt: text(row.startedAt),
      endedAt: row.endedAt === null ? null : text(row.endedAt), bodyweight: optionalNumber(row.bodyweight), notes: text(row.notes),
    })
  }), (row) => row.id)
  const setEntries = unique(list(data.setEntries, (value) => {
    const row = requireObject(value)
    return {
      id: id(row.id), sessionId: id(row.sessionId), exerciseId: id(row.exerciseId), order: numeric(row.order),
      variant: optionalText(row.variant), reps: optionalNumber(row.reps), durationSec: optionalNumber(row.durationSec),
      addedWeightKg: optionalNumber(row.addedWeightKg), repsInReserve: optionalNumber(row.repsInReserve), note: text(row.note),
    }
  }), (row) => row.id)
  const workoutStates = unique(list(data.workoutStates, (value) => {
    const row = requireObject(value)
    const exerciseIds = unique(list(row.exerciseIds, id), (value) => value)
    const activeExerciseId = row.activeExerciseId === null ? null : id(row.activeExerciseId)
    const drafts = Object.fromEntries(Object.entries(requireObject(row.drafts)).map(([key, value]) => [id(key), draft(value)]))
    const restEndsAt = row.restEndsAt === null ? null : numeric(row.restEndsAt)
    if (restEndsAt !== null && !Number.isFinite(new Date(restEndsAt).getTime())) invalid('błędny czas przerwy.')
    if ((activeExerciseId !== null && !exerciseIds.includes(activeExerciseId))
      || exerciseIds.some((key) => !Object.hasOwn(drafts, key))
      || Object.keys(drafts).some((key) => !exerciseIds.includes(key))) invalid('niespójne szkice lub wybór ćwiczenia.')
    return { sessionId: id(row.sessionId), exerciseIds, activeExerciseId, drafts, restEndsAt }
  }), (row) => row.sessionId)
  const workoutSettings = unique(list<WorkoutSettings>(data.workoutSettings, (value) => {
    const row = requireObject(value)
    if (row.id !== 'workouts') return invalid('nieznany identyfikator ustawień.')
    const restDurationSec = numeric(row.restDurationSec)
    if (!Number.isInteger(restDurationSec) || restDurationSec < 0 || restDurationSec > 3600) invalid('błędna długość przerwy.')
    const gymMode = row.gymMode === undefined ? undefined : bool(row.gymMode)
    if (row.exerciseCatalogue !== undefined && !isExerciseCatalogue(row.exerciseCatalogue)) {
      return invalid('nieznany zestaw ćwiczeń.')
    }
    const exerciseCatalogue = row.exerciseCatalogue ?? (gymMode === undefined ? undefined : gymMode ? 'gym-women' : 'calisthenics')
    return { id: row.id, restDurationSec, ...(exerciseCatalogue === undefined ? {} : { exerciseCatalogue }) }
  }), (row) => row.id)
  const backupMetadata = unique(list<BackupMetadata>(data.backupMetadata, (value) => {
    const row = requireObject(value)
    if (row.id !== 'backup') return invalid('nieznany identyfikator metadanych kopii.')
    return { id: row.id, lastExportedAt: normalizeTimestamp(text(row.lastExportedAt)) }
  }), (row) => row.id)

  const exercisesById = new Map(exercises.map((row) => [row.id, row]))
  const sessionsById = new Map(workoutSessions.map((row) => [row.id, row]))
  for (const entry of setEntries) {
    const exercise = exercisesById.get(entry.exerciseId)
    if (!exercise || !sessionsById.has(entry.sessionId)) invalid('seria wskazuje na brakujące ćwiczenie lub trening.')
    validateSetEntry(entry, exercise)
  }
  for (const state of workoutStates) {
    const session = sessionsById.get(state.sessionId)
    if (!session) invalid('szkic wskazuje na brakujący trening.')
    for (const exerciseId of state.exerciseIds) {
      const exercise = exercisesById.get(exerciseId)
      // Deleting an unused exercise after finishing a workout is allowed by the repositories.
      if (!exercise && session.endedAt === null) invalid('aktywny trening wskazuje na brakujące ćwiczenie.')
    }
  }
  return { exercises, workoutSessions, setEntries, workoutStates, workoutSettings, backupMetadata }
}
