import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StreetTrackerDB } from './db'
import { createRepositories } from './repositories'

type Repositories = ReturnType<typeof createRepositories>
type ExerciseInput = Parameters<Repositories['createExercise']>[0]
type WorkoutSessionInput = Parameters<Repositories['createWorkoutSession']>[0]

let database: StreetTrackerDB
let repositories: Repositories

beforeEach(async () => {
  database = new StreetTrackerDB(`StreetTracker-repositories-${crypto.randomUUID()}`)
  await database.open()
  repositories = createRepositories(database)
})

afterEach(async () => {
  await database.delete()
})

function createExercise(overrides: Partial<ExerciseInput> = {}) {
  return repositories.createExercise({
    name: 'Podciąganie testowe',
    category: 'pull',
    trackingType: 'reps_weight',
    supportsAddedWeight: true,
    ...overrides,
  })
}

function createSession(overrides: Partial<WorkoutSessionInput> = {}) {
  return repositories.createWorkoutSession({
    date: '2026-10-29',
    startedAt: '2026-10-29T08:00:00.000Z',
    ...overrides,
  })
}

describe('exercise repository', () => {
  it('creates a custom exercise with defaults, reads it, and updates its progression', async () => {
    const exercise = await createExercise()

    expect(exercise.id).toEqual(expect.any(String))
    expect(exercise.id).not.toBe('')
    expect(exercise).toMatchObject({ isCustom: true, variants: [] })
    expect(await repositories.getExercise(exercise.id)).toEqual(exercise)

    const updated = await repositories.updateExercise(exercise.id, {
      name: 'Podciąganie na jednej ręce',
      variants: ['Z pomocą', 'Negatyw', 'Pełne'],
    })

    expect(updated).toEqual({
      ...exercise,
      name: 'Podciąganie na jednej ręce',
      variants: ['Z pomocą', 'Negatyw', 'Pełne'],
    })
    expect(await repositories.getExercise(exercise.id)).toEqual(updated)
  })

  it('lists exercises in Polish name order', async () => {
    const last = await createExercise({ name: 'Żuraw testowy' })
    const middle = await createExercise({ name: 'Łucznik testowy' })
    const first = await createExercise({ name: 'Burpee testowe' })
    const ids = new Set([first.id, middle.id, last.id])

    const customExercises = (await repositories.listExercises()).filter((exercise) =>
      ids.has(exercise.id),
    )

    expect(customExercises.map((exercise) => exercise.id)).toEqual([
      first.id,
      middle.id,
      last.id,
    ])
  })

  it('deletes an unreferenced exercise and handles missing records', async () => {
    const exercise = await createExercise()

    expect(await repositories.deleteExercise(exercise.id)).toBe(true)
    expect(await repositories.getExercise(exercise.id)).toBeUndefined()
    expect(await repositories.deleteExercise(exercise.id)).toBe(false)
    await expect(repositories.updateExercise(exercise.id, { name: 'Brak' })).rejects.toThrow()
  })

  it('rejects a blank name without persisting an exercise', async () => {
    const before = await repositories.listExercises()

    await expect(createExercise({ name: '   ' })).rejects.toThrow()
    expect(await repositories.listExercises()).toEqual(before)
  })

  it('protects an exercise referenced by a set without deleting either record', async () => {
    const exercise = await createExercise()
    const session = await createSession()
    const set = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      order: 0,
      reps: 6,
    })

    await expect(repositories.deleteExercise(exercise.id)).rejects.toThrow()
    expect(await repositories.getExercise(exercise.id)).toEqual(exercise)
    expect(await repositories.getSetEntry(set.id)).toEqual(set)
  })
})

describe('workout session repository', () => {
  it('round-trips defaults and optional session fields', async () => {
    const session = await createSession()

    expect(session).toMatchObject({ endedAt: null, notes: '' })
    expect(session.bodyweight).toBeUndefined()
    expect(await repositories.getWorkoutSession(session.id)).toEqual(session)

    const updated = await repositories.updateWorkoutSession(session.id, {
      endedAt: '2026-10-29T09:15:00.000Z',
      bodyweight: 78.5,
      notes: 'Trening na drążkach w parku.',
    })

    expect(updated).toEqual({
      ...session,
      endedAt: '2026-10-29T09:15:00.000Z',
      bodyweight: 78.5,
      notes: 'Trening na drążkach w parku.',
    })
    expect(await repositories.getWorkoutSession(session.id)).toEqual(updated)
  })

  it('lists sessions by date and start time', async () => {
    const late = await createSession({ startedAt: '2026-10-29T18:00:00.000Z' })
    const early = await createSession()
    const previous = await createSession({
      date: '2026-10-28',
      startedAt: '2026-10-28T12:00:00.000Z',
    })

    expect((await repositories.listWorkoutSessions()).map((session) => session.id)).toEqual([
      previous.id,
      early.id,
      late.id,
    ])
  })

  it('normalizes offset timestamps to UTC while preserving the supplied local calendar date', async () => {
    const session = await createSession({
      date: '2026-10-29',
      startedAt: '2026-10-29T00:30:00+02:00',
      endedAt: '2026-10-29T01:45:00+02:00',
    })

    expect(session).toMatchObject({
      date: '2026-10-29',
      startedAt: '2026-10-28T22:30:00.000Z',
      endedAt: '2026-10-28T23:45:00.000Z',
    })
    expect(await repositories.getWorkoutSession(session.id)).toEqual(session)
    expect(await repositories.getSessionsByDateRange('2026-10-29', '2026-10-29')).toEqual([
      session,
    ])
    await expect(
      createSession({
        startedAt: '2026-10-29T08:00:00+01:00',
        endedAt: '2026-10-29T08:30:00+02:00',
      }),
    ).rejects.toThrow()
    expect(await repositories.listWorkoutSessions()).toEqual([session])
  })

  it('rejects clearing required notes and preserves the existing session', async () => {
    const session = await createSession({ notes: 'Rozgrzewka i trening siłowy.' })

    await expect(
      repositories.updateWorkoutSession(session.id, { notes: undefined }),
    ).rejects.toThrow()

    expect(await repositories.getWorkoutSession(session.id)).toEqual(session)
  })

  it('includes both date-range boundaries and orders sessions on the same day', async () => {
    await createSession({ date: '2026-10-27', startedAt: '2026-10-27T08:00:00.000Z' })
    const last = await createSession({ date: '2026-10-30', startedAt: '2026-10-30T08:00:00.000Z' })
    const late = await createSession({ startedAt: '2026-10-29T18:00:00.000Z' })
    const first = await createSession({ date: '2026-10-28', startedAt: '2026-10-28T08:00:00.000Z' })
    const early = await createSession()
    await createSession({ date: '2026-10-31', startedAt: '2026-10-31T08:00:00.000Z' })

    const sessions = await repositories.getSessionsByDateRange('2026-10-28', '2026-10-30')

    expect(sessions.map((session) => session.id)).toEqual([
      first.id,
      early.id,
      late.id,
      last.id,
    ])
    expect(await repositories.getSessionsByDateRange('2026-10-29', '2026-10-29')).toEqual([
      early,
      late,
    ])
    expect(await repositories.getSessionsByDateRange('2026-11-01', '2026-11-03')).toEqual([])
  })

  it('rejects reversed ranges and malformed or nonexistent calendar dates', async () => {
    await expect(
      repositories.getSessionsByDateRange('2026-10-30', '2026-10-28'),
    ).rejects.toThrow()
    await expect(
      repositories.getSessionsByDateRange('29.10.2026', '2026-10-30'),
    ).rejects.toThrow()
    await expect(
      repositories.getSessionsByDateRange('2026-02-30', '2026-03-01'),
    ).rejects.toThrow()
  })

  it('rejects invalid session chronology and preserves the stored session on failure', async () => {
    const session = await createSession()

    await expect(
      repositories.updateWorkoutSession(session.id, {
        endedAt: '2026-10-29T07:59:00.000Z',
        notes: 'Ta zmiana nie powinna zostać zapisana.',
      }),
    ).rejects.toThrow()
    expect(await repositories.getWorkoutSession(session.id)).toEqual(session)
    await expect(createSession({ date: '2026-02-30' })).rejects.toThrow()
    await expect(createSession({ bodyweight: Number.POSITIVE_INFINITY })).rejects.toThrow()
  })

  it('deletes a session with all its sets and preserves other sessions and exercises', async () => {
    const exercise = await createExercise()
    const removed = await createSession()
    const retained = await createSession({ startedAt: '2026-10-29T18:00:00.000Z' })
    const first = await repositories.createSetEntry({
      sessionId: removed.id,
      exerciseId: exercise.id,
      order: 0,
      reps: 5,
    })
    const second = await repositories.createSetEntry({
      sessionId: removed.id,
      exerciseId: exercise.id,
      order: 1,
      reps: 4,
    })
    const retainedSet = await repositories.createSetEntry({
      sessionId: retained.id,
      exerciseId: exercise.id,
      order: 0,
      reps: 8,
    })

    expect(await repositories.deleteWorkoutSession(removed.id)).toBe(true)
    expect(await repositories.getWorkoutSession(removed.id)).toBeUndefined()
    expect(await repositories.getSetEntriesForSession(removed.id)).toEqual([])
    expect(await repositories.getSetEntry(first.id)).toBeUndefined()
    expect(await repositories.getSetEntry(second.id)).toBeUndefined()
    expect(await repositories.getWorkoutSession(retained.id)).toEqual(retained)
    expect(await repositories.getSetEntry(retainedSet.id)).toEqual(retainedSet)
    expect(await repositories.getExercise(exercise.id)).toEqual(exercise)
    expect(await repositories.deleteWorkoutSession(removed.id)).toBe(false)
    await expect(
      repositories.updateWorkoutSession(removed.id, { notes: 'Brak' }),
    ).rejects.toThrow()
  })

  it('rolls back the set cascade when deleting the parent session fails', async () => {
    const exercise = await createExercise()
    const session = await createSession()
    const set = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      order: 0,
      reps: 8,
    })
    const failDeletion = () => {
      throw new Error('Forced session deletion failure')
    }
    database.workoutSessions.hook('deleting', failDeletion)

    try {
      await expect(repositories.deleteWorkoutSession(session.id)).rejects.toThrow(
        'Forced session deletion failure',
      )
    } finally {
      database.workoutSessions.hook('deleting').unsubscribe(failDeletion)
    }

    expect(await repositories.getWorkoutSession(session.id)).toEqual(session)
    expect(await repositories.getSetEntry(set.id)).toEqual(set)
    expect(await repositories.getSetEntriesForSession(session.id)).toEqual([set])
  })
})

describe('set entry repository', () => {
  it('creates, reads, updates, orders, and deletes sets with optional metrics', async () => {
    const exercise = await createExercise({ variants: ['Z pomocą', 'Pełne'] })
    const session = await createSession()
    const second = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      order: 1,
    })
    const first = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      variant: 'Z pomocą',
      order: 0,
      reps: 8,
      addedWeightKg: 7.5,
      repsInReserve: 2,
      note: 'Pełen zakres ruchu.',
    })

    expect(second).toMatchObject({ note: '' })
    expect(second.reps).toBeUndefined()
    expect(second.durationSec).toBeUndefined()
    expect(await repositories.getSetEntry(first.id)).toEqual(first)
    expect(await repositories.getSetEntriesForSession(session.id)).toEqual([first, second])

    const updated = await repositories.updateSetEntry(second.id, {
      reps: 6,
      addedWeightKg: 10,
      note: 'Ostatnia seria.',
    })

    expect(updated).toEqual({ ...second, reps: 6, addedWeightKg: 10, note: 'Ostatnia seria.' })
    expect(await repositories.getSetEntry(second.id)).toEqual(updated)
    expect(await repositories.deleteSetEntry(first.id)).toBe(true)
    expect(await repositories.getSetEntry(first.id)).toBeUndefined()
    expect(await repositories.getSetEntriesForSession(session.id)).toEqual([updated])
    expect(await repositories.deleteSetEntry(first.id)).toBe(false)
    await expect(repositories.updateSetEntry(first.id, { reps: 10 })).rejects.toThrow()
  })

  it('requires an existing session and exercise before inserting a set', async () => {
    const exercise = await createExercise()
    const session = await createSession()

    await expect(
      repositories.createSetEntry({
        sessionId: 'missing-session',
        exerciseId: exercise.id,
        order: 0,
        reps: 5,
      }),
    ).rejects.toThrow()
    await expect(
      repositories.createSetEntry({
        sessionId: session.id,
        exerciseId: 'missing-exercise',
        order: 0,
        reps: 5,
      }),
    ).rejects.toThrow()
    expect(await repositories.getSetEntriesForSession(session.id)).toEqual([])
    expect(await repositories.getHistoryForExercise(exercise.id)).toEqual([])
  })

  it('preserves a set if an update would reference missing records', async () => {
    const exercise = await createExercise()
    const session = await createSession()
    const set = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      order: 0,
      reps: 5,
    })

    await expect(
      repositories.updateSetEntry(set.id, { sessionId: 'missing-session', reps: 20 }),
    ).rejects.toThrow()
    await expect(
      repositories.updateSetEntry(set.id, { exerciseId: 'missing-exercise', reps: 20 }),
    ).rejects.toThrow()
    expect(await repositories.getSetEntry(set.id)).toEqual(set)
    expect(await repositories.getSetEntriesForSession(session.id)).toEqual([set])
  })

  it('rejects invalid numeric metrics and leaves existing values intact', async () => {
    const exercise = await createExercise()
    const session = await createSession()
    const set = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      order: 0,
      reps: 5,
    })

    await expect(repositories.updateSetEntry(set.id, { reps: -1 })).rejects.toThrow()
    await expect(repositories.updateSetEntry(set.id, { reps: 1.5 })).rejects.toThrow()
    await expect(repositories.updateSetEntry(set.id, { durationSec: Number.NaN })).rejects.toThrow()
    await expect(
      repositories.updateSetEntry(set.id, { addedWeightKg: Number.POSITIVE_INFINITY }),
    ).rejects.toThrow()
    await expect(repositories.updateSetEntry(set.id, { order: 0.5 })).rejects.toThrow()
    await expect(repositories.updateSetEntry(set.id, { repsInReserve: 1.5 })).rejects.toThrow()
    expect(await repositories.getSetEntry(set.id)).toEqual(set)
  })

  it('rejects clearing required order or note without losing the set from its session index', async () => {
    const exercise = await createExercise()
    const session = await createSession()
    const set = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      order: 0,
      reps: 8,
      note: 'Zachowaj tę serię.',
    })

    await expect(repositories.updateSetEntry(set.id, { order: undefined })).rejects.toThrow()
    await expect(repositories.updateSetEntry(set.id, { note: undefined })).rejects.toThrow()

    expect(await repositories.getSetEntry(set.id)).toEqual(set)
    expect(await repositories.getSetEntriesForSession(session.id)).toEqual([set])
  })

  it('allows optional session and set values to be explicitly cleared', async () => {
    const exercise = await createExercise({ variants: ['Z pomocą', 'Pełne'] })
    const session = await createSession({ bodyweight: 78.5 })
    const set = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      order: 0,
      variant: 'Pełne',
      reps: 8,
      durationSec: 20,
      addedWeightKg: 5,
      repsInReserve: 2,
    })

    const updatedSession = await repositories.updateWorkoutSession(session.id, {
      bodyweight: undefined,
    })
    const updatedSet = await repositories.updateSetEntry(set.id, {
      variant: undefined,
      reps: undefined,
      durationSec: undefined,
      addedWeightKg: undefined,
      repsInReserve: undefined,
    })

    expect(updatedSession.bodyweight).toBeUndefined()
    expect(await repositories.getWorkoutSession(session.id)).toEqual(updatedSession)
    expect(updatedSet).toEqual({
      ...set,
      variant: undefined,
      reps: undefined,
      durationSec: undefined,
      addedWeightKg: undefined,
      repsInReserve: undefined,
    })
    expect(await repositories.getSetEntry(set.id)).toEqual(updatedSet)
    expect(await repositories.getSetEntriesForSession(session.id)).toEqual([updatedSet])
  })

  it('prevents positive added weight for an exercise that does not support it', async () => {
    const exercise = await createExercise({
      name: 'Stanie na rękach testowe',
      category: 'skills',
      trackingType: 'time',
      supportsAddedWeight: false,
    })
    const session = await createSession()

    await expect(
      repositories.createSetEntry({
        sessionId: session.id,
        exerciseId: exercise.id,
        order: 0,
        durationSec: 20,
        addedWeightKg: 5,
      }),
    ).rejects.toThrow()

    const set = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      order: 0,
      durationSec: 20,
      addedWeightKg: 0,
    })

    expect(await repositories.getSetEntriesForSession(session.id)).toEqual([set])
    await expect(repositories.updateSetEntry(set.id, { addedWeightKg: 1 })).rejects.toThrow()
    expect(await repositories.getSetEntry(set.id)).toEqual(set)
  })
})

describe('exercise history', () => {
  it('keeps a set variant snapshot after the exercise progression labels change', async () => {
    const exercise = await createExercise({ variants: ['Tuck', 'Advanced tuck'] })
    const session = await createSession()
    const set = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      order: 0,
      variant: 'Tuck',
      durationSec: 15,
    })

    await repositories.updateExercise(exercise.id, {
      variants: ['Zwinięta', 'Rozkroczna'],
    })

    expect(await repositories.getSetEntry(set.id)).toEqual(set)
    expect(await repositories.getHistoryForExercise(exercise.id)).toEqual([{ set, session }])
  })

  it('joins only the requested exercise, newest sessions first and sets in workout order', async () => {
    const exercise = await createExercise({
      name: 'Waga przodem testowa',
      category: 'skills',
      trackingType: 'time',
      variants: ['Tuck', 'Advanced tuck', 'Straddle'],
    })
    const otherExercise = await createExercise()
    const previous = await createSession({ date: '2026-10-28', startedAt: '2026-10-28T08:00:00.000Z' })
    const early = await createSession({ bodyweight: 78.5 })
    const late = await createSession({ startedAt: '2026-10-29T18:00:00.000Z' })
    const previousSet = await repositories.createSetEntry({
      sessionId: previous.id,
      exerciseId: exercise.id,
      order: 0,
      durationSec: 10,
      variant: 'Tuck',
    })
    const secondSet = await repositories.createSetEntry({
      sessionId: early.id,
      exerciseId: exercise.id,
      order: 2,
      durationSec: 12.5,
      variant: 'Advanced tuck',
      addedWeightKg: 2.5,
      repsInReserve: 1,
      note: 'Własna progresja.',
    })
    const firstSet = await repositories.createSetEntry({
      sessionId: early.id,
      exerciseId: exercise.id,
      order: 0,
      durationSec: 15,
      variant: 'Advanced tuck',
    })
    const latestSet = await repositories.createSetEntry({
      sessionId: late.id,
      exerciseId: exercise.id,
      order: 0,
      durationSec: 20,
      variant: 'Straddle',
    })
    await repositories.createSetEntry({
      sessionId: early.id,
      exerciseId: otherExercise.id,
      order: 1,
      reps: 8,
    })

    expect(await repositories.getHistoryForExercise(exercise.id)).toEqual([
      { set: latestSet, session: late },
      { set: firstSet, session: early },
      { set: secondSet, session: early },
      { set: previousSet, session: previous },
    ])
    expect(await repositories.getHistoryForExercise('missing-exercise')).toEqual([])
  })

  it('uses current session dates and bodyweight after a session update', async () => {
    const exercise = await createExercise()
    const session = await createSession({ bodyweight: 78 })
    const set = await repositories.createSetEntry({
      sessionId: session.id,
      exerciseId: exercise.id,
      order: 0,
      reps: 8,
    })
    const updated = await repositories.updateWorkoutSession(session.id, {
      date: '2026-10-30',
      startedAt: '2026-10-30T08:00:00.000Z',
      bodyweight: 79,
    })

    expect(await repositories.getHistoryForExercise(exercise.id)).toEqual([
      { set, session: updated },
    ])
    expect(await repositories.getSessionsByDateRange('2026-10-29', '2026-10-29')).toEqual([])
    expect(await repositories.getSessionsByDateRange('2026-10-30', '2026-10-30')).toEqual([
      updated,
    ])
  })
})
