import { describe, expect, it, vi } from 'vitest'
import type { Exercise, ExerciseHistoryEntry, SetEntry, WorkoutSession } from '../../db/types'
import {
  describeSet,
  draftFromSet,
  formatClock,
  localWorkoutDate,
  previousExerciseSet,
  remainingRestSeconds,
} from './workoutHelpers'

const exercise: Exercise = {
  id: 'test:pull-up',
  name: 'Podciąganie',
  category: 'pull',
  trackingType: 'reps_weight',
  supportsAddedWeight: true,
  variants: ['Bez pomocy'],
  isCustom: true,
}

function createSet(changes: Partial<SetEntry> = {}): SetEntry {
  return { id: 'set:1', sessionId: 'session:recent', exerciseId: exercise.id, order: 0, reps: 8, note: '', ...changes }
}

function createSession(changes: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session:recent', date: '2026-10-31', startedAt: '2026-10-31T09:00:00.000Z',
    endedAt: '2026-10-31T10:00:00.000Z', notes: '', ...changes,
  }
}

describe('workout dates and clocks', () => {
  it('keeps the local calendar day at either end of the day and pads date components', () => {
    expect(localWorkoutDate(new Date(2026, 0, 2, 0, 15))).toBe('2026-01-02')
    expect(localWorkoutDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })

  it('uses local date components when UTC is still on the previous calendar day', () => {
    const date = new Date('2026-01-01T00:15:00+02:00')
    // Model this date in its +02:00 local timezone independently of the test host.
    vi.spyOn(date, 'getFullYear').mockReturnValue(2026)
    vi.spyOn(date, 'getMonth').mockReturnValue(0)
    vi.spyOn(date, 'getDate').mockReturnValue(1)

    expect(date.toISOString().slice(0, 10)).toBe('2025-12-31')
    expect(localWorkoutDate(date)).toBe('2026-01-01')
  })

  it.each([
    [0, '0:00'], [59.9, '0:59'], [60, '1:00'], [3599, '59:59'],
    [3600, '1:00:00'], [3661.9, '1:01:01'], [-1, '0:00'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected)
  })

  it('reconstructs rest from its saved deadline after reopening or background suspension', () => {
    const deadline = 90_000
    expect(remainingRestSeconds(deadline, 0)).toBe(90)
    expect(remainingRestSeconds(deadline, 42_000)).toBe(48)
    expect(remainingRestSeconds(deadline, 89_999)).toBe(1)
    expect(remainingRestSeconds(deadline, 90_000)).toBe(0)
    expect(remainingRestSeconds(deadline, 150_000)).toBe(0)
    expect(remainingRestSeconds(null, 42_000)).toBe(0)
  })

  it('rounds a partial remaining second upward rather than ending rest early', () => {
    expect(remainingRestSeconds(100_250, 99_000)).toBe(2)
    expect(remainingRestSeconds(100_250, 100_000)).toBe(1)
    expect(remainingRestSeconds(100_250, 100_250)).toBe(0)
  })
})

describe('previous exercise values', () => {
  it('uses the last set within the newest session, rather than the first or an older set', () => {
    const recent = createSession()
    const older = createSession({ id: 'session:old', date: '2026-10-30', startedAt: '2026-10-30T09:00:00.000Z' })
    const first = { set: createSet({ reps: 10 }), session: recent }
    const last = { set: createSet({ id: 'set:2', order: 3, reps: 6 }), session: recent }
    const history: ExerciseHistoryEntry[] = [
      first, last,
      { set: createSet({ id: 'set:old', sessionId: older.id, order: 99, reps: 20 }), session: older },
    ]

    expect(previousExerciseSet(history)).toBe(last)
    expect(previousExerciseSet([first])).toBe(first)
    expect(previousExerciseSet([])).toBeUndefined()
  })

  it('preserves fractional time, weight and a historical variant when creating the next draft', () => {
    const set = createSet({ durationSec: 12.5, addedWeightKg: 2.75, variant: 'Dawny wariant' })
    expect(draftFromSet(set, exercise)).toEqual({
      reps: 8, durationSec: 12.5, addedWeightKg: 2.75, variant: 'Dawny wariant',
    })
    expect(set.variant).toBe('Dawny wariant')
  })

  it('fills absent metrics and clears added weight for exercises that no longer support it', () => {
    expect(draftFromSet(createSet({ reps: undefined }), exercise)).toEqual({
      reps: 8, durationSec: 30, addedWeightKg: 0, variant: undefined,
    })
    const timed: Exercise = { ...exercise, trackingType: 'time', supportsAddedWeight: false }
    expect(draftFromSet(createSet({ durationSec: 22.5, addedWeightKg: 5 }), timed)).toMatchObject({
      durationSec: 22.5, addedWeightKg: 0,
    })
  })
})

describe('set descriptions', () => {
  it('shows repetitions and a positive added weight with Polish decimal formatting', () => {
    expect(describeSet(createSet({ addedWeightKg: 2.75 }), exercise)).toBe('8 powt. · +2,75 kg')
    expect(describeSet(createSet({ addedWeightKg: 0 }), exercise)).toBe('8 powt.')
    expect(describeSet(createSet(), exercise)).toBe('8 powt.')
  })

  it('uses duration for timed exercises and omits unsupported weight', () => {
    const timed: Exercise = { ...exercise, trackingType: 'time', supportsAddedWeight: false }
    const set = createSet({ durationSec: 12.5, addedWeightKg: 5 })
    expect(describeSet(set, timed)).toBe('12.5 s')
    expect(describeSet(set, { ...timed, supportsAddedWeight: true })).toBe('12.5 s · +5 kg')
  })
})
