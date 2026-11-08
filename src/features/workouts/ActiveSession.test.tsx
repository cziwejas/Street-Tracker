import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { builtinExercises } from '../../db/seed'
import { gymExercises } from '../../db/gymSeed'
import type { ActiveWorkout, SetEntry, WorkoutDraft } from '../../db/types'
import { exercisesForMode } from '../exercises/exerciseCatalogue'
import { ActiveSession } from './ActiveSession'
import { EditSet, SetFields } from './SetFields'

const exercises = [...builtinExercises]
const pullUp = exercises.find((exercise) => exercise.id === 'builtin:pull-up')
const plank = exercises.find((exercise) => exercise.id === 'builtin:plank')
if (!pullUp || !plank) throw new Error('Missing built-in exercise fixtures')

const sets: SetEntry[] = [
  { id: 'one', sessionId: 'session', exerciseId: pullUp.id, reps: 8, addedWeightKg: 2.5, order: 0, note: '' },
  { id: 'two', sessionId: 'session', exerciseId: plank.id, durationSec: 45, order: 1, note: '' },
  { id: 'three', sessionId: 'session', exerciseId: pullUp.id, reps: 6, addedWeightKg: 5, order: 2, note: '' },
]

const active: ActiveWorkout = {
  session: { id: 'session', date: '2026-10-31', startedAt: '2026-10-31T09:00:00Z', endedAt: null, notes: '' },
  state: {
    sessionId: 'session', exerciseIds: [pullUp.id, plank.id], activeExerciseId: pullUp.id,
    drafts: { [pullUp.id]: { reps: 6, durationSec: 30, addedWeightKg: 5 } }, restEndsAt: null,
  },
  sets,
}

describe('active workout screen', () => {
  it('always shows a weight input without a checkbox for every gym exercise, including shared leg exercises', () => {
    for (const exercise of exercisesForMode([...exercises, ...gymExercises], true)) {
      const html = renderToStaticMarkup(<SetFields exercise={exercise}
        draft={{ reps: 8, durationSec: 30, addedWeightKg: 0, withAddedWeight: false }}
        disabled={false} prefix="new" onChange={() => undefined} />)
      expect(html, exercise.name).toContain('for="new-weight"')
      expect(html, exercise.name).toContain('Ciężar (kg)')
      expect(html, exercise.name).toContain('value="0"')
      expect(html, exercise.name).not.toContain('type="checkbox"')
      expect(html, exercise.name).not.toContain('Wariant z obciążeniem')
    }
  })

  it.each([0, 42.5])('shows a gym weight of %s kg directly when editing a set', (addedWeightKg) => {
    const exercise = gymExercises.find((item) => item.id === 'builtin:hip-thrust')
    if (!exercise) throw new Error('Missing hip thrust fixture')
    const html = renderToStaticMarkup(<EditSet exercise={exercise}
      set={{ id: 'gym-set', sessionId: 'session', exerciseId: exercise.id, reps: 10, addedWeightKg, order: 0, note: '' }}
      busy={false} onSave={() => undefined} />)
    expect(html).toContain('for="edit-weight"')
    expect(html).toContain(`value="${addedWeightKg}"`)
    expect(html).not.toContain('type="checkbox"')
  })

  it.each([
    { label: 'default bodyweight variant', draft: { reps: 8, durationSec: 30, addedWeightKg: 0 }, visible: false },
    { label: 'explicit bodyweight variant', draft: { reps: 8, durationSec: 30, addedWeightKg: 0, withAddedWeight: false }, visible: false },
    { label: 'selected weighted variant before entering kilograms', draft: { reps: 8, durationSec: 30, addedWeightKg: 0, withAddedWeight: true }, visible: true },
    { label: 'historical weighted draft', draft: { reps: 8, durationSec: 30, addedWeightKg: 5 }, visible: true },
  ] satisfies { label: string; draft: WorkoutDraft; visible: boolean }[])('shows added weight only for $label', ({ draft, visible }) => {
    const html = renderToStaticMarkup(<SetFields exercise={pullUp} draft={draft} disabled={false} prefix="new" onChange={() => undefined} />)
    expect(html).toContain('Wariant z obciążeniem')
    expect(html).toContain('type="checkbox"')
    expect(html.includes('for="new-weight"')).toBe(visible)
    expect(html.includes('Zwiększ: Dodatkowy ciężar')).toBe(visible)
  })

  it('groups interleaved sets by exercise with independently labelled edit/delete actions', () => {
    const html = renderToStaticMarkup(<ActiveSession active={active} exercises={exercises} history={{}}
      settings={{ id: 'workouts', restDurationSec: 90 }}
      actions={{ busy: false, pending: 0, error: null, save: () => undefined, perform: async () => undefined }}
      dock={null} onFinished={() => undefined} />)

    const pullUpSection = html.slice(html.indexOf('<article'), html.indexOf('</article>'))
    expect(pullUpSection).toContain('8 powt.')
    expect(pullUpSection).toContain('6 powt.')
    expect(pullUpSection).not.toContain('45 s')
    expect(html).toContain('aria-label="Edytuj serię 2: Podciąganie nachwytem"')
    expect(html).toContain('aria-label="Usuń serię 1: Deska"')
    expect(html).toContain('id="workout-log-form"')
    expect(html).toContain('2 ćw. · 3 serie')
    expect(html).toContain('Seria 3')
    expect(html).not.toContain('Czas przerwy')
  })

  it('uses time for static exercises and retains a historical variant removed from the catalogue', () => {
    const html = renderToStaticMarkup(<SetFields exercise={plank} draft={{ reps: 8, durationSec: 12.5, addedWeightKg: 0, variant: 'Stary wariant' }}
      disabled={false} prefix="new" onChange={() => undefined} />)
    expect(html).toContain('for="new-time"')
    expect(html).not.toContain('for="new-reps"')
    expect(html).not.toContain('Dodatkowy ciężar')
    expect(html).not.toContain('Wariant z obciążeniem')
    expect(html).toContain('value="12.5"')
    expect(html).toContain('<option value="Stary wariant" selected="">Stary wariant</option>')
  })
})
