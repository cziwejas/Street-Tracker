import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Exercise } from '../../db/types'
import { builtinExercises } from '../../db/seed'
import { ExercisePicker } from './ExercisePicker'
import { NumberStepper } from './NumberStepper'
import { WorkoutDialog } from './WorkoutDialog'
import { adjustStepperValue, filterExercises, normalizeSearch, parseStepperInput } from './inputHelpers'

describe('workout numeric input', () => {
  it('accepts Polish decimals and preserves fractional historical values', () => {
    expect(parseStepperInput('2,75')).toBe(2.75)
    expect(parseStepperInput('12.5')).toBe(12.5)
    expect(parseStepperInput(' 0 ')).toBe(0)
    expect(parseStepperInput('10', { integer: true })).toBe(10)
    expect(parseStepperInput('2,5', { integer: true })).toBeUndefined()
  })

  it.each(['', ' ', 'NaN', 'Infinity', '1e3', '-1', '1,2,3', '10 kg'])('rejects invalid input %j without converting it to zero', (input) => {
    expect(parseStepperInput(input)).toBeUndefined()
  })

  it('enforces lower and upper boundaries', () => {
    expect(parseStepperInput('0', { min: 1 })).toBeUndefined()
    expect(parseStepperInput('3601', { max: 3600 })).toBeUndefined()
    expect(adjustStepperValue(1, -5)).toBe(0)
    expect(adjustStepperValue(3590, 15, 0, 3600)).toBe(3600)
  })

  it('steps decimal weights without floating-point drift or rounding existing quarters', () => {
    expect(adjustStepperValue(0.2, 0.1)).toBe(0.3)
    expect(adjustStepperValue(2.75, 0.5)).toBe(3.25)
    expect(adjustStepperValue(12.5, 5)).toBe(17.5)
  })

  it('labels large increment controls and exposes the correct phone keyboard', () => {
    const html = renderToStaticMarkup(<NumberStepper id="weight" label="Dodatkowy ciężar" unit="kg" value={2.75} step={0.5} onChange={() => undefined} />)
    expect(html).toContain('aria-label="Zmniejsz: Dodatkowy ciężar"')
    expect(html).toContain('aria-label="Zwiększ: Dodatkowy ciężar"')
    expect(html).toContain('inputMode="decimal"')
    expect(html).toContain('value="2.75"')
    expect(html).toContain('for="weight"')
    expect(html).toContain('size-14')
  })
})

describe('exercise search', () => {
  const exercises: Exercise[] = [...builtinExercises]

  it('matches Polish names without accents, including ł and uppercase letters', () => {
    expect(normalizeSearch('  ŁÓDECZKI  ')).toBe('lodeczki')
    expect(filterExercises(exercises, 'PODCIAGANIE nachwytem').map((exercise) => exercise.id)).toEqual(['builtin:pull-up'])
    expect(filterExercises(exercises, 'lodeczki').map((exercise) => exercise.id)).toEqual(['builtin:hollow-body-hold'])
  })

  it('searches categories, supports multiple words, and handles empty results', () => {
    expect(filterExercises(exercises, 'umiejetnosci')).toHaveLength(5)
    expect(filterExercises(exercises, '   ')).toHaveLength(exercises.length)
    expect(filterExercises(exercises, 'nieistniejące ćwiczenie')).toEqual([])
  })

  it('keeps already selected exercises available and labels the search and dialog', () => {
    const html = renderToStaticMarkup(<ExercisePicker exercises={exercises.filter((exercise) => exercise.id === 'builtin:pull-up')} selectedIds={['builtin:pull-up']} busy={false} onSelect={() => undefined} onClose={() => undefined} />)
    expect(html).toContain('Dodaj ćwiczenie')
    expect(html).toContain('Szukaj ćwiczenia')
    expect(html).toContain('aria-labelledby=')
    expect(html).toContain('W treningu')
    expect(html).toContain('Podciąganie nachwytem')
  })

  it('shows storage failures inside the modal so inert background content is not needed', () => {
    const html = renderToStaticMarkup(<WorkoutDialog title="Edytuj serię" error="Nie udało się zapisać zmian." onClose={() => undefined}><p>Formularz</p></WorkoutDialog>)
    expect(html).toContain('role="alert"')
    expect(html.indexOf('Nie udało się zapisać zmian.')).toBeLessThan(html.indexOf('</dialog>'))
  })
})
