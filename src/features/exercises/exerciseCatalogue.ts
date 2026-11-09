import { currentGymExercises } from '../../db/gymSeed'
import { strengthGymExercises } from '../../db/strengthGymSeed'
import type { Exercise, ExerciseCatalogue } from '../../db/types'

const gymWomenIds = new Set(currentGymExercises.map((exercise) => exercise.id))
const strengthGymIds = new Set(strengthGymExercises.map((exercise) => exercise.id))
const sharedLegIds = new Set([
  'builtin:squat', 'builtin:bulgarian-split-squat', 'builtin:lunge', 'builtin:calf-raise',
])

function isGymWomenExercise(exercise: Exercise): boolean {
  return gymWomenIds.has(exercise.id) || sharedLegIds.has(exercise.id) || (exercise.isCustom && exercise.category === 'legs')
}

export function isGymExercise(exercise: Exercise): boolean {
  return strengthGymIds.has(exercise.id) || isGymWomenExercise(exercise)
}

/** Catalogue selection only filters the picker, not the exercises already in a workout. */
export function exercisesForCatalogue(exercises: Exercise[], catalogue: ExerciseCatalogue): Exercise[] {
  switch (catalogue) {
    case 'gym-women':
      return exercises.filter(isGymWomenExercise)
    case 'gym':
      return exercises.filter((exercise) => exercise.isCustom || isGymExercise(exercise))
    case 'calisthenics':
      return exercises.filter((exercise) => !gymWomenIds.has(exercise.id) && !strengthGymIds.has(exercise.id))
  }
}
