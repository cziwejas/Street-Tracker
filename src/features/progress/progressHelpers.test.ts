import { describe, expect, it } from 'vitest'
import type { Exercise, HistorySession, SetEntry, WorkoutHistory } from '../../db/types'
import { buildExerciseSeries, describeVolume, findPersonalRecords, summarizeVolume } from './progressHelpers'

const pull: Exercise = { id: 'pull', name: 'Podciąganie', category: 'pull', trackingType: 'reps_weight', supportsAddedWeight: true, variants: [], isCustom: false }
const hold: Exercise = { ...pull, id: 'hold', name: 'Deska', trackingType: 'time', supportsAddedWeight: false }

function set(id: string, reps: number | undefined, changes: Partial<SetEntry> = {}): SetEntry {
  return { id, sessionId: 'session', exerciseId: pull.id, reps, order: 0, note: '', ...changes }
}

function session(id: string, date: string, sets: SetEntry[], bodyweight?: number): HistorySession {
  return {
    session: { id, date, startedAt: `${date}T10:00:00Z`, endedAt: `${date}T11:00:00Z`, notes: '', bodyweight },
    sets: sets.map((entry, order) => ({ ...entry, sessionId: id, order })),
  }
}

function history(sessions: HistorySession[]): WorkoutHistory {
  return { exercises: [pull, hold], sessions: [...sessions].reverse() }
}

describe('personal records', () => {
  it('marks first results and strict improvements in set order, retaining past PRs and ignoring ties/declines/zero/drafts', () => {
    const data = history([
      session('old', '2026-01-01', [set('zero', 0), set('draft', undefined), set('first', 8), set('tie', 8), set('second', 10)]),
      session('new', '2026-10-31', [set('lower', 9), set('equal', 10), set('third', 12)]),
    ])
    const records = findPersonalRecords(data)
    expect([...records.keys()]).toEqual(['first', 'second', 'third'])
    expect(records.get('first')?.previousValue).toBeUndefined()
    expect(records.get('second')?.previousValue).toBe(8)
    expect(records.get('third')?.previousValue).toBe(10)
    expect(data.sessions[0]?.session.id).toBe('new')
  })

  it('compares each variant/load separately, normalizing missing and zero load, and measures holds in seconds', () => {
    const records = findPersonalRecords(history([
      session('a', '2026-10-01', [set('base', 12), set('tuck', 5, { variant: 'Tuck' }), set('weighted', 6, { addedWeightKg: 10 }), set('hold', undefined, { exerciseId: hold.id, durationSec: 30 })]),
      session('b', '2026-10-02', [set('zero-load', 11, { addedWeightKg: 0 }), set('tuck-pr', 6, { variant: 'Tuck' }), set('weighted-pr', 7, { addedWeightKg: 10 }), set('hold-pr', 99, { exerciseId: hold.id, durationSec: 45 })]),
    ]))
    expect(records.has('zero-load')).toBe(false)
    expect(records.get('tuck-pr')?.previousValue).toBe(5)
    expect(records.get('weighted-pr')?.previousValue).toBe(6)
    expect(records.get('hold-pr')).toMatchObject({ value: 45, previousValue: 30, unit: 's' })
  })
})

describe('volume and per-session series', () => {
  it('estimates mass × repetitions, ignores irrelevant fields, and keeps seconds separate', () => {
    const entry = session('a', '2026-10-01', [set('one', 10, { addedWeightKg: 5, durationSec: 999 }), set('two', 5), set('three', 100, { exerciseId: hold.id, durationSec: 45 })], 70)
    expect(summarizeVolume(entry, [pull, hold])).toEqual({ estimatedKgReps: 1100, repsWithoutBodyweight: 0, durationSec: 45 })
    expect(describeVolume(summarizeVolume(entry, [pull, hold]))).toContain('kg·powt.')
    expect(describeVolume(summarizeVolume(entry, [pull, hold]))).toContain('45 s')
  })

  it('does not invent bodyweight or mix units when the session has no measurement', () => {
    const entry = session('a', '2026-10-01', [set('one', 10, { addedWeightKg: 5 }), set('two', undefined, { exerciseId: hold.id, durationSec: 60 })])
    expect(summarizeVolume(entry, [pull, hold])).toEqual({ estimatedKgReps: 0, repsWithoutBodyweight: 10, durationSec: 60 })
    expect(describeVolume(summarizeVolume(entry, [pull, hold]))).toBe('10 powt. bez masy ciała · 60 s')
    expect(describeVolume(summarizeVolume(session('empty', '2026-10-01', []), [pull]))).toBe('Brak objętości')
  })

  it('keeps each session as a point and uses the complete history as the PR baseline before date filtering', () => {
    const data = history([
      session('old', '2026-01-01', [set('first', 15)], 70),
      session('am', '2026-10-31', [set('lower', 10), set('other-load', 20, { addedWeightKg: 5 }), set('other-variant', 22, { variant: 'Tuck' })]),
      session('pm', '2026-10-31', [set('best', 16), set('repeat', 10)], 72),
    ])
    const points = buildExerciseSeries(data, pull, { variant: '', addedWeightKg: 0 }, findPersonalRecords(data))
    expect(points).toEqual([
      { sessionId: 'old', date: '2026-01-01', best: 15, volume: 1050, isPr: true },
      { sessionId: 'am', date: '2026-10-31', best: 10, volume: null, isPr: false },
      { sessionId: 'pm', date: '2026-10-31', best: 16, volume: 1872, isPr: true },
    ])
  })

  it('uses the best hold and total duration for timed exercises without requiring bodyweight', () => {
    const data = history([session('a', '2026-10-31', [set('one', undefined, { exerciseId: hold.id, durationSec: 30 }), set('two', undefined, { exerciseId: hold.id, durationSec: 45 })])])
    expect(buildExerciseSeries(data, hold, { variant: '', addedWeightKg: 0 }, findPersonalRecords(data))).toEqual([
      { sessionId: 'a', date: '2026-10-31', best: 45, volume: 75, isPr: true },
    ])
  })
})
