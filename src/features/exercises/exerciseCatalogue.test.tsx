import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { currentGymExercises } from '../../db/gymSeed'
import { builtinExercises } from '../../db/seed'
import type { Exercise } from '../../db/types'
import { ExercisePicker } from '../workouts/ExercisePicker'
import { filterExercises } from '../workouts/inputHelpers'
import { exercisesForMode } from './exerciseCatalogue'

const exercises = [...builtinExercises, ...currentGymExercises]

describe('exercise catalogue modes', () => {
  it('keeps the original catalogue with gym mode off and includes lower-body gym exercises when on', () => {
    expect(exercisesForMode(exercises, false)).toEqual(builtinExercises)
    const gym = exercisesForMode(exercises, true)
    expect(gym).toHaveLength(15)
    expect(gym.every((exercise) => exercise.category === 'legs')).toBe(true)
    expect(gym.map((exercise) => exercise.id)).toEqual(expect.arrayContaining([
      'builtin:hip-thrust', 'builtin:bulgarian-split-squat', 'builtin:romanian-deadlift', 'builtin:hip-abduction',
    ]))
    expect(filterExercises(gym, 'bulgarskie').map((exercise) => exercise.id)).toEqual(['builtin:bulgarian-split-squat'])
    expect(filterExercises(gym, 'hip thrust').map((exercise) => exercise.id)).toEqual(['builtin:hip-thrust'])
    expect(filterExercises(gym, 'kickback').map((exercise) => exercise.id)).toEqual(['builtin:cable-kickback'])
    expect(filterExercises(gym, 'przywodzenie nog').map((exercise) => exercise.id)).toEqual(['builtin:hip-adduction'])
    expect(gym.find((exercise) => exercise.id === 'builtin:hip-adduction')).toMatchObject({
      trackingType: 'reps_weight', supportsAddedWeight: true,
    })
  })

  it('includes custom leg exercises in gym mode and uses stable IDs for renamed built-ins', () => {
    const custom: Exercise = { id: 'custom:legs', name: 'Moje nogi', category: 'legs', trackingType: 'reps_weight', supportsAddedWeight: true, variants: [], isCustom: true }
    const renamed: Exercise = { ...custom, id: 'builtin:hip-thrust', name: 'Mój hip thrust', isCustom: false }
    const customPush: Exercise = { ...custom, id: 'custom:push', category: 'push' }
    expect(exercisesForMode([custom, renamed, customPush], true)).toEqual([custom, renamed])
    expect(exercisesForMode([custom, renamed, customPush], false)).toEqual([custom, customPush])
  })

  it.each([false, true])('renders a labelled checkbox and the matching picker for gym mode %s', (gymMode) => {
    const html = renderToStaticMarkup(<ExercisePicker exercises={exercises} selectedIds={['builtin:bulgarian-split-squat']}
      busy={false} gymMode={gymMode} onGymModeChange={() => undefined} onSelect={() => undefined} onClose={() => undefined} />)
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('aria-label="Siłownia"')
    expect(html.includes('checked=""')).toBe(gymMode)
    expect(html.includes('Hip thrust')).toBe(gymMode)
    expect(html.includes('Podciąganie nachwytem')).toBe(!gymMode)
    expect(html).toContain('Przysiady bułgarskie')
    expect(html).toContain('W treningu')
  })
})
