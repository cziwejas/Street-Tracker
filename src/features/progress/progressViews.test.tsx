import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Exercise, WorkoutHistory } from '../../db/types'
import { SessionDetail } from '../workouts/SessionDetail'
import { ExerciseProgress } from './ExerciseProgress'
import { MetricChart } from './MetricChart'
import { findPersonalRecords } from './progressHelpers'

const hold: Exercise = { id: 'hold', name: 'Deska', category: 'core', trackingType: 'time', variants: [], supportsAddedWeight: false, isCustom: false }
const history: WorkoutHistory = {
  exercises: [hold],
  sessions: [{
    session: { id: 'one', date: '2026-10-31', startedAt: '2026-10-31T10:00:00Z', endedAt: '2026-10-31T10:30:00Z', notes: 'Dobry trening', bodyweight: 78.5 },
    sets: [
      { id: 'first', sessionId: 'one', exerciseId: hold.id, durationSec: 30, order: 0, note: 'Pierwsza próba' },
      { id: 'second', sessionId: 'one', exerciseId: hold.id, durationSec: 45, order: 1, note: '' },
    ],
  }],
}

describe('history and progress views', () => {
  it.each([
    { weights: [0, 10], visible: false, best: 8 },
    { weights: [10], visible: true, best: 9 },
  ])('shows the load filter only when the weighted variant is selected ($weights)', ({ weights, visible, best }) => {
    const exercise: Exercise = { ...hold, id: 'pull', name: 'Podciąganie', trackingType: 'reps_weight', supportsAddedWeight: true }
    const entry = history.sessions[0]
    if (!entry) throw new Error('Missing history fixture')
    const data: WorkoutHistory = {
      exercises: [exercise],
      sessions: [{ ...entry, sets: weights.map((weight) => ({
        id: `set-${weight}`, sessionId: entry.session.id, exerciseId: exercise.id, order: weight,
        addedWeightKg: weight, reps: weight === 0 ? 8 : 9, note: '',
      })) }],
    }
    const html = renderToStaticMarkup(<MemoryRouter><ExerciseProgress exercise={exercise} history={data} range="all" records={findPersonalRecords(data)} /></MemoryRouter>)
    expect(html).toContain('Wariant z obciążeniem')
    expect(html.includes('for="progress-load"')).toBe(visible)
    expect(html).toContain(`${best} <span`)
    if (visible) expect(html).toContain('+10 kg')
  })

  it('renders timed best/volume charts with a persistent PR and links to its training', () => {
    const html = renderToStaticMarkup(<MemoryRouter><ExerciseProgress exercise={hold} history={history} range="all" records={findPersonalRecords(history)} /></MemoryRouter>)
    expect(html).toContain('Najlepszy czas utrzymania')
    expect(html).toContain('Łączny czas w sesji')
    expect(html).toContain('Rekord osobisty · cały okres')
    expect(html).toContain('45')
    expect(html).toContain('75')
    expect(html).toContain('href="/historia/one"')
    expect(html).toContain('★ PR')
    expect(html).not.toContain('kg·powt.')
  })

  it('shows a Polish empty state for an exercise without sets', () => {
    const html = renderToStaticMarkup(<MemoryRouter><ExerciseProgress exercise={hold} history={{ exercises: [hold], sessions: [] }} range="all" records={new Map()} /></MemoryRouter>)
    expect(html).toContain('Jeszcze bez wyników')
    expect(html).toContain('zakończ trening')
  })

  it('retains rows for missing volume measurements, without showing a fabricated latest value', () => {
    const html = renderToStaticMarkup(<MemoryRouter><MetricChart title="Objętość" unit="kg·powt." description="Szacunek" emptyText="Uzupełnij masę ciała."
      data={[{ sessionId: 'one', date: '2026-10-31', value: null }]} /></MemoryRouter>)
    expect(html).toContain('Uzupełnij masę ciała.')
    expect(html).toContain('Brak masy ciała')
    expect(html).toContain('href="/historia/one"')
    expect(html).not.toContain('ostatni pomiar')
  })

  it('shows individual sets, historical PRs, notes and an accessible bodyweight form in session details', () => {
    const entry = history.sessions[0]
    if (!entry) throw new Error('Missing history fixture')
    const html = renderToStaticMarkup(<MemoryRouter><SessionDetail entry={entry} exercises={history.exercises} records={findPersonalRecords(history)} /></MemoryRouter>)
    expect(html).toContain('30 s')
    expect(html).toContain('45 s')
    expect(html).toContain('Poprzedni rekord: 30 s')
    expect(html).toContain('PIERWSZY PR')
    expect(html).toContain('Pierwsza próba')
    expect(html).toContain('Dobry trening')
    expect(html).toContain('75 s')
    expect(html).toContain('for="session-bodyweight"')
    expect(html).toContain('value="78,5"')
    expect(html).toContain('Zapisz pomiar')
  })
})
