import type { Exercise, ExerciseCategory, TrackingType } from '../../db/types'

export const categoryLabels: Record<ExerciseCategory, string> = {
  push: 'Pchanie',
  pull: 'Przyciąganie',
  legs: 'Nogi',
  core: 'Brzuch',
  skills: 'Umiejętności',
}

export const trackingLabels: Record<TrackingType, string> = {
  reps: 'Powtórzenia',
  time: 'Czas',
  reps_weight: 'Powtórzenia + ciężar',
}

export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l').trim()
}

export function filterExercises(exercises: Exercise[], query: string): Exercise[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  return exercises.filter((exercise) => {
    const searchable = normalizeSearch(`${exercise.name} ${categoryLabels[exercise.category]}`)
    return words.every((word) => searchable.includes(word))
  })
}

interface NumberLimits {
  min?: number
  max?: number
  integer?: boolean
}

export function parseStepperInput(text: string, { min = 0, max = Infinity, integer = false }: NumberLimits = {}): number | undefined {
  const normalized = text.trim().replace(',', '.')
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return undefined
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) return undefined
  return value
}

export function adjustStepperValue(value: number, delta: number, min = 0, max = Infinity): number {
  const result = Number((value + delta).toPrecision(12))
  return Math.min(max, Math.max(min, result))
}
