import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { builtinExercises } from '../../db/seed'
import type { ActiveWorkout, SetEntry } from '../../db/types'
import { ActiveSession } from './ActiveSession'
import { SetFields } from './SetFields'

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
  it('groups interleaved sets by exercise with independently labelled edit/delete actions', () => {
    const html = renderToStaticMarkup(<ActiveSession active={active} exercises={exercises} history={{}}
      settings={{ id: 'workouts', restDurationSec: 90 }}
      actions={{ busy: false, pending: 0, error: null, save: () => undefined, perform: async () => undefined }}
      onFinished={() => undefined} />)

    const pullUpSection = html.slice(html.indexOf('<article'), html.indexOf('</article>'))
    expect(pullUpSection).toContain('8 powt.')
    expect(pullUpSection).toContain('6 powt.')
    expect(pullUpSection).not.toContain('45 s')
    expect(html).toContain('aria-label="Edytuj serię 2: Podciąganie nachwytem"')
    expect(html).toContain('aria-label="Usuń serię 1: Deska"')
    expect(html).toContain('form="workout-log-form"')
    expect(html).toContain('Powtórz poprzednią serię')
    expect(html).toContain('aria-label="Ustaw domyślną przerwę"')
  })

  it('uses time for static exercises and retains a historical variant removed from the catalogue', () => {
    const html = renderToStaticMarkup(<SetFields exercise={plank} draft={{ reps: 8, durationSec: 12.5, addedWeightKg: 0, variant: 'Stary wariant' }}
      disabled={false} prefix="new" onChange={() => undefined} />)
    expect(html).toContain('for="new-time"')
    expect(html).not.toContain('for="new-reps"')
    expect(html).not.toContain('Dodatkowy ciężar')
    expect(html).toContain('value="12.5"')
    expect(html).toContain('<option value="Stary wariant" selected="">Stary wariant</option>')
  })
})
