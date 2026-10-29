import type { Exercise, SetEntry, WorkoutSession } from './types'

export type RepositoryErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'IN_USE'

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode

  constructor(code: RepositoryErrorCode, message: string) {
    super(message)
    this.name = 'RepositoryError'
    this.code = code
  }
}

function invalid(message: string): never {
  throw new RepositoryError('VALIDATION', message)
}

function nonNegative(value: number | undefined, label: string, integer = false): void {
  if (value === undefined) return

  if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
    invalid(`${label}: wymagana jest ${integer ? 'całkowita ' : ''}liczba nieujemna.`)
  }
}

export function validateDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    invalid('Data musi mieć format RRRR-MM-DD.')
  }

  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    invalid('Data nie istnieje w kalendarzu.')
  }
}

function normalizeTimestamp(timestamp: string): string {
  // A timezone is mandatory so storage never depends on the device's timezone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) {
    invalid('Znacznik czasu musi być datą ISO 8601 ze strefą czasową.')
  }

  validateDate(timestamp.slice(0, 10))
  const parsed = new Date(timestamp)
  if (!Number.isFinite(parsed.getTime())) {
    invalid('Nieprawidłowy znacznik czasu.')
  }
  return parsed.toISOString()
}

export function normalizeExercise(exercise: Exercise): Exercise {
  if (typeof exercise.name !== 'string') invalid('Nazwa ćwiczenia musi być tekstem.')
  const name = exercise.name.trim()
  if (!name) invalid('Nazwa ćwiczenia nie może być pusta.')
  if (!['push', 'pull', 'legs', 'core', 'skills'].includes(exercise.category)) {
    invalid('Nieprawidłowa kategoria ćwiczenia.')
  }
  if (!['reps', 'time', 'reps_weight'].includes(exercise.trackingType)) {
    invalid('Nieprawidłowy sposób mierzenia ćwiczenia.')
  }
  if (typeof exercise.supportsAddedWeight !== 'boolean') {
    invalid('Określ, czy ćwiczenie obsługuje dodatkowy ciężar.')
  }
  if (exercise.trackingType === 'reps_weight' && !exercise.supportsAddedWeight) {
    invalid('Pomiar powtórzeń z ciężarem wymaga obsługi dodatkowego ciężaru.')
  }

  if (!Array.isArray(exercise.variants) || exercise.variants.some((variant) => typeof variant !== 'string')) {
    invalid('Warianty ćwiczenia muszą być listą nazw.')
  }
  const variants = exercise.variants.map((variant) => variant.trim())
  if (variants.some((variant) => !variant) || new Set(variants).size !== variants.length) {
    invalid('Warianty ćwiczenia muszą mieć niepuste, unikalne nazwy.')
  }

  return { ...exercise, name, variants }
}

export function normalizeSession(session: WorkoutSession): WorkoutSession {
  if (typeof session.notes !== 'string') invalid('Notatki treningu muszą być tekstem.')
  validateDate(session.date)
  const startedAt = normalizeTimestamp(session.startedAt)
  const endedAt = session.endedAt === null ? null : normalizeTimestamp(session.endedAt)
  if (endedAt !== null && endedAt < startedAt) {
    invalid('Koniec treningu nie może poprzedzać jego rozpoczęcia.')
  }
  if (session.bodyweight !== undefined && (!Number.isFinite(session.bodyweight) || session.bodyweight <= 0)) {
    invalid('Masa ciała musi być dodatnią liczbą kilogramów.')
  }
  return { ...session, startedAt, endedAt }
}

export function validateSetEntry(entry: SetEntry, exercise: Exercise): void {
  if (!Number.isInteger(entry.order) || entry.order < 0) {
    invalid('Kolejność serii musi być nieujemną liczbą całkowitą.')
  }
  if (typeof entry.note !== 'string') invalid('Notatka serii musi być tekstem.')
  if (entry.variant !== undefined && (typeof entry.variant !== 'string' || !entry.variant.trim())) {
    invalid('Wariant serii musi mieć niepustą nazwę.')
  }
  nonNegative(entry.reps, 'Liczba powtórzeń', true)
  nonNegative(entry.durationSec, 'Czas trwania')
  nonNegative(entry.addedWeightKg, 'Dodatkowy ciężar')
  nonNegative(entry.repsInReserve, 'Zapas powtórzeń', true)

  if ((entry.addedWeightKg ?? 0) > 0 && !exercise.supportsAddedWeight) {
    invalid('To ćwiczenie nie obsługuje dodatkowego ciężaru.')
  }
}
