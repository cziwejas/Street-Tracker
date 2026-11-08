import { currentGymExercises } from '../../db/gymSeed'
import type { Exercise } from '../../db/types'

const gymOnlyIds = new Set(currentGymExercises.map((exercise) => exercise.id))
const sharedGymIds = new Set([
  'builtin:squat', 'builtin:bulgarian-split-squat', 'builtin:lunge', 'builtin:calf-raise',
])

export function isGymExercise(exercise: Exercise): boolean {
  return gymOnlyIds.has(exercise.id) || sharedGymIds.has(exercise.id) || (exercise.isCustom && exercise.category === 'legs')
}

/** Filter the picker only: changing modes never removes exercises from a workout. */
export function exercisesForMode(exercises: Exercise[], gymMode: boolean): Exercise[] {
  return exercises.filter((exercise) => gymMode
    ? isGymExercise(exercise)
    : !gymOnlyIds.has(exercise.id))
}
