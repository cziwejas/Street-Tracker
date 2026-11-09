import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { currentGymExercises } from '../../db/gymSeed'
import { builtinExercises } from '../../db/seed'
import { strengthGymExercises } from '../../db/strengthGymSeed'
import type { Exercise, ExerciseCatalogue } from '../../db/types'
import { ExercisePicker } from '../workouts/ExercisePicker'
import { filterExercises } from '../workouts/inputHelpers'
import { exercisesForCatalogue } from './exerciseCatalogue'

const exercises = [...builtinExercises, ...currentGymExercises, ...strengthGymExercises]

describe('exercise catalogue modes', () => {
  it('preserves the original calisthenics and lower-body catalogues', () => {
    expect(exercisesForCatalogue(exercises, 'calisthenics')).toEqual(builtinExercises)
    const gym = exercisesForCatalogue(exercises, 'gym-women')
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

  it('includes strength equipment and shared lower-body exercises in the full gym catalogue', () => {
    const gym = exercisesForCatalogue(exercises, 'gym')
    expect(gym).toEqual([...exercisesForCatalogue(exercises, 'gym-women'), ...strengthGymExercises])
    expect(filterExercises(gym, 'sztangi plaskiej').map((exercise) => exercise.id)).toEqual(['builtin:barbell-bench-press'])
    expect(filterExercises(gym, 'wyciagu gornego').map((exercise) => exercise.id)).toContain('builtin:lat-pulldown')
    expect(filterExercises(gym, 'klatke maszynie').map((exercise) => exercise.id)).toContain('builtin:machine-chest-press')
  })

  it('includes custom exercises by catalogue and uses stable IDs for renamed built-ins', () => {
    const custom: Exercise = { id: 'custom:legs', name: 'Moje nogi', category: 'legs', trackingType: 'reps_weight', supportsAddedWeight: true, variants: [], isCustom: true }
    const renamed: Exercise = { ...custom, id: 'builtin:hip-thrust', name: 'Mój hip thrust', isCustom: false }
    const customPush: Exercise = { ...custom, id: 'custom:push', category: 'push' }
    expect(exercisesForCatalogue([custom, renamed, customPush], 'gym-women')).toEqual([custom, renamed])
    expect(exercisesForCatalogue([custom, renamed, customPush], 'calisthenics')).toEqual([custom, customPush])
    expect(exercisesForCatalogue([custom, renamed, customPush], 'gym')).toEqual([custom, renamed, customPush])
  })

  it.each<ExerciseCatalogue>(['calisthenics', 'gym-women', 'gym'])('renders the three options and filters the picker for %s', (catalogue) => {
    const html = renderToStaticMarkup(<ExercisePicker exercises={exercises} selectedIds={['builtin:bulgarian-split-squat']}
      busy={false} catalogue={catalogue} onCatalogueChange={() => undefined} onSelect={() => undefined} onClose={() => undefined} />)
    expect(html).toContain('aria-label="Zestaw ćwiczeń"')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2)
    expect(html.includes('Hip thrust')).toBe(catalogue !== 'calisthenics')
    expect(html.includes('Podciąganie nachwytem')).toBe(catalogue === 'calisthenics')
    expect(html.includes('Wyciskanie sztangi na ławce płaskiej')).toBe(catalogue === 'gym')
    expect(html).toContain('Przysiady bułgarskie')
    expect(html).toContain('W treningu')
  })
})
