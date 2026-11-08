import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StreetTrackerDB } from './db'
import { createRepositories } from './repositories'
import type { WorkoutDraft } from './types'

let database: StreetTrackerDB
let repositories: ReturnType<typeof createRepositories>
let sequence = 0
const connections: StreetTrackerDB[] = []
const startedAt = '2026-10-31T09:00:00.000Z'
const now = new Date(startedAt).getTime()
const draft: WorkoutDraft = { reps: 8, durationSec: 30, addedWeightKg: 2.5 }

beforeEach(async () => {
  database = new StreetTrackerDB(`street-tracker-workout-test-${++sequence}`)
  connections.push(database)
  repositories = createRepositories(database)
  await database.open()
})

afterEach(async () => {
  for (const connection of connections) connection.close()
  connections.length = 0
  await database.delete()
})

async function startWithExercise(exerciseId = 'builtin:pull-up') {
  const workout = await repositories.startWorkout(startedAt, '2026-10-31')
  await repositories.addWorkoutExercise(workout.session.id, exerciseId)
  return workout.session.id
}

describe('persistent workout workflow', () => {
  it('persists gym mode independently of rest settings and preserves selected exercises and sets', async () => {
    const sessionId = await startWithExercise()
    const set = await repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, now)
    const active = await repositories.getActiveWorkout()
    await repositories.updateWorkoutSettings({ gymMode: true })
    await repositories.updateWorkoutSettings({ restDurationSec: 120 })
    expect(await repositories.getActiveWorkout()).toEqual(active)
    database.close()
    const reopened = new StreetTrackerDB(database.name)
    connections.push(reopened)
    const restored = createRepositories(reopened)
    expect(await restored.getWorkoutSettings()).toEqual({ id: 'workouts', gymMode: true, restDurationSec: 120 })
    await restored.addWorkoutExercise(sessionId, 'builtin:hip-thrust')
    const gymSet = await restored.logWorkoutSet(sessionId, 'builtin:hip-thrust', { ...draft, reps: 12, addedWeightKg: 40 }, now)
    expect(gymSet).toMatchObject({ reps: 12, addedWeightKg: 40, exerciseId: 'builtin:hip-thrust' })
    await restored.updateWorkoutSettings({ gymMode: false })
    expect(await restored.getWorkoutSettings()).toEqual({ id: 'workouts', gymMode: false, restDurationSec: 120 })
    expect((await restored.getActiveWorkout())?.state.exerciseIds).toEqual(['builtin:pull-up', 'builtin:hip-thrust'])
    expect(await restored.getSetEntriesForSession(sessionId)).toEqual([set, gymSet])
  })

  it('persists the weighted selection before a load is entered and logs zero after switching it off', async () => {
    const sessionId = await startWithExercise()
    const selected = { ...draft, addedWeightKg: 0, withAddedWeight: true }
    await repositories.updateWorkoutDraft(sessionId, 'builtin:pull-up', selected)
    database.close()
    const reopened = new StreetTrackerDB(database.name)
    connections.push(reopened)
    const reopenedRepositories = createRepositories(reopened)
    expect((await reopenedRepositories.getActiveWorkout())?.state.drafts['builtin:pull-up']).toEqual(selected)

    const unweighted = { ...selected, withAddedWeight: false }
    await reopenedRepositories.updateWorkoutDraft(sessionId, 'builtin:pull-up', unweighted)
    expect(await reopenedRepositories.logWorkoutSet(sessionId, 'builtin:pull-up', unweighted, now)).toMatchObject({ addedWeightKg: 0, reps: draft.reps })
  })

  it('rejects a hidden nonzero load when the weighted variant is explicitly disabled', async () => {
    const sessionId = await startWithExercise()
    const invalid = { ...draft, withAddedWeight: false }
    await expect(repositories.updateWorkoutDraft(sessionId, 'builtin:pull-up', invalid)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(repositories.logWorkoutSet(sessionId, 'builtin:pull-up', invalid, now)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await repositories.getSetEntriesForSession(sessionId)).toEqual([])
  })

  it('atomically starts one session for concurrent starts and resumes it on reopening', async () => {
    const [first, second] = await Promise.all([
      repositories.startWorkout(startedAt, '2026-10-31'),
      repositories.startWorkout(startedAt, '2026-10-31'),
    ])
    expect(first.session.id).toBe(second.session.id)
    expect(await database.workoutSessions.count()).toBe(1)
    const sessionId = first.session.id
    await repositories.addWorkoutExercise(sessionId, 'builtin:pull-up')
    await repositories.addWorkoutExercise(sessionId, 'builtin:plank')
    await repositories.selectWorkoutExercise(sessionId, 'builtin:pull-up')
    await repositories.updateWorkoutDraft(sessionId, 'builtin:pull-up', draft)
    await repositories.updateWorkoutSettings({ restDurationSec: 120 })
    const set = await repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, now)
    await repositories.updateWorkoutDraft(sessionId, 'builtin:pull-up', { ...draft, reps: 11 })
    database.close()

    const reopened = new StreetTrackerDB(database.name)
    connections.push(reopened)
    const reopenedRepositories = createRepositories(reopened)
    const resumed = await reopenedRepositories.getActiveWorkout()
    expect(resumed?.session.id).toBe(sessionId)
    expect(resumed?.sets).toEqual([set])
    expect(resumed?.state).toMatchObject({
      exerciseIds: ['builtin:pull-up', 'builtin:plank'], activeExerciseId: 'builtin:pull-up',
      drafts: { 'builtin:pull-up': { ...draft, reps: 11 } }, restEndsAt: now + 120_000,
    })
    expect(await reopenedRepositories.getWorkoutSettings()).toEqual({ id: 'workouts', restDurationSec: 120 })
  })

  it('prefills the last set of the latest historical session, then preserves unsaved edits when switching', async () => {
    const old = await repositories.createWorkoutSession({
      date: '2026-10-29', startedAt: '2026-10-29T09:00:00Z', endedAt: '2026-10-29T10:00:00Z',
    })
    const recent = await repositories.createWorkoutSession({
      date: '2026-10-30', startedAt: '2026-10-30T09:00:00Z', endedAt: '2026-10-30T10:00:00Z',
    })
    await repositories.createSetEntry({ sessionId: old.id, exerciseId: 'builtin:pull-up', order: 99, reps: 99 })
    await repositories.createSetEntry({ sessionId: recent.id, exerciseId: 'builtin:pull-up', order: 0, reps: 10, addedWeightKg: 5 })
    await repositories.createSetEntry({
      sessionId: recent.id, exerciseId: 'builtin:pull-up', order: 4, reps: 7, addedWeightKg: 10, variant: 'Bez pomocy',
    })
    const sessionId = await startWithExercise()
    expect((await repositories.getWorkoutState(sessionId))?.drafts['builtin:pull-up']).toEqual({
      reps: 7, durationSec: 30, addedWeightKg: 10, variant: 'Bez pomocy',
    })
    await repositories.updateWorkoutDraft(sessionId, 'builtin:pull-up', { ...draft, reps: 12 })
    await repositories.addWorkoutExercise(sessionId, 'builtin:plank')
    const state = await repositories.addWorkoutExercise(sessionId, 'builtin:pull-up')
    expect(state.exerciseIds).toEqual(['builtin:pull-up', 'builtin:plank'])
    expect(state.drafts['builtin:pull-up']).toEqual({ ...draft, reps: 12 })
  })

  it('repeats the previous set of the requested exercise and resets rest atomically', async () => {
    const sessionId = await startWithExercise()
    const first = await repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, now)
    await repositories.addWorkoutExercise(sessionId, 'builtin:plank')
    const timed = await repositories.logWorkoutSet(sessionId, 'builtin:plank', { ...draft, addedWeightKg: 0, durationSec: 45 }, now + 10_000)
    await repositories.updateWorkoutDraft(sessionId, 'builtin:pull-up', { ...draft, reps: 20 })
    const repeated = await repositories.repeatWorkoutSet(sessionId, 'builtin:pull-up', now + 20_000)
    expect(repeated).toMatchObject({ exerciseId: first.exerciseId, reps: 8, addedWeightKg: 2.5, order: 2 })
    expect(repeated.id).not.toBe(first.id)
    expect(timed.durationSec).toBe(45)
    expect(timed.reps).toBeUndefined()
    const state = await repositories.getWorkoutState(sessionId)
    expect(state?.restEndsAt).toBe(now + 110_000)
    expect(state?.drafts['builtin:pull-up']).toEqual(draft)
    expect(state?.activeExerciseId).toBe('builtin:pull-up')
  })

  it('repeats historical values when this session has no set yet, rejecting missing history', async () => {
    const previous = await repositories.createWorkoutSession({
      date: '2026-10-30', startedAt: '2026-10-30T09:00:00Z', endedAt: '2026-10-30T10:00:00Z',
    })
    await repositories.createSetEntry({ sessionId: previous.id, exerciseId: 'builtin:pull-up', order: 0, reps: 11 })
    const sessionId = await startWithExercise()
    expect(await repositories.repeatWorkoutSet(sessionId, 'builtin:pull-up', now)).toMatchObject({ reps: 11, order: 0 })
    await repositories.addWorkoutExercise(sessionId, 'builtin:plank')
    await expect(repositories.repeatWorkoutSet(sessionId, 'builtin:plank', now)).rejects.toThrow('Brak poprzedniej serii')
    expect(await repositories.getSetEntriesForSession(sessionId)).toHaveLength(1)
  })

  it('assigns unique increasing order under concurrent logging, including after deletions', async () => {
    const sessionId = await startWithExercise()
    const results = await Promise.all(Array.from({ length: 4 }, () =>
      repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, now),
    ))
    expect(results.map((set) => set.order).sort()).toEqual([0, 1, 2, 3])
    const second = results.find((set) => set.order === 1)
    if (!second) throw new Error('Expected second set')
    await repositories.deleteSetEntry(second.id)
    expect(await repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, now)).toMatchObject({ order: 4 })
  })

  it('finishes with history intact, clears rest and rejects queued writes to a closed workout', async () => {
    const sessionId = await startWithExercise()
    const set = await repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, now)
    const [finished, lateLog] = await Promise.allSettled([
      repositories.finishWorkout(sessionId, '2026-10-31T10:00:00.000Z'),
      repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, now),
    ])
    expect(finished.status).toBe('fulfilled')
    expect(lateLog.status).toBe('rejected')
    expect(await repositories.getActiveWorkout()).toBeUndefined()
    expect(await repositories.getSetEntriesForSession(sessionId)).toEqual([set])
    expect((await repositories.getWorkoutState(sessionId))?.restEndsAt).toBeNull()
    await expect(repositories.updateWorkoutDraft(sessionId, 'builtin:pull-up', draft)).rejects.toThrow('zakończony')
    await expect(repositories.addWorkoutExercise(sessionId, 'builtin:plank')).rejects.toThrow('zakończony')
    const next = await repositories.startWorkout('2026-10-31T11:00:00Z', '2026-10-31')
    expect(next.session.id).not.toBe(sessionId)
  })

  it('uses configurable defaults, supports disabling rest and stopping an active timer', async () => {
    expect(await repositories.getWorkoutSettings()).toEqual({ id: 'workouts', restDurationSec: 90 })
    const sessionId = await startWithExercise()
    await repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, now)
    expect((await repositories.getWorkoutState(sessionId))?.restEndsAt).toBe(now + 90_000)
    await repositories.stopWorkoutRest(sessionId)
    expect((await repositories.getWorkoutState(sessionId))?.restEndsAt).toBeNull()
    await repositories.updateWorkoutSettings({ restDurationSec: 0 })
    await repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, now)
    expect((await repositories.getWorkoutState(sessionId))?.restEndsAt).toBeNull()
    await expect(repositories.updateWorkoutSettings({ restDurationSec: 3601 })).rejects.toThrow()
    await expect(repositories.updateWorkoutSettings({ restDurationSec: 1.5 })).rejects.toThrow()
    expect((await repositories.getWorkoutSettings()).restDurationSec).toBe(0)
  })

  it('rolls back invalid logs without altering the previous draft, sets or timer', async () => {
    const sessionId = await startWithExercise()
    await repositories.updateWorkoutDraft(sessionId, 'builtin:pull-up', draft)
    const state = await repositories.getWorkoutState(sessionId)
    await expect(repositories.logWorkoutSet(sessionId, 'builtin:pull-up', { ...draft, reps: 0 }, now)).rejects.toThrow()
    await expect(repositories.logWorkoutSet(sessionId, 'builtin:pull-up', { ...draft, reps: 1.5 }, now)).rejects.toThrow()
    await expect(repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, NaN)).rejects.toThrow()
    await expect(repositories.updateWorkoutDraft(sessionId, 'builtin:pull-up', { ...draft, addedWeightKg: -1 })).rejects.toThrow()
    await repositories.addWorkoutExercise(sessionId, 'builtin:plank')
    await expect(repositories.logWorkoutSet(sessionId, 'builtin:plank', { ...draft, durationSec: 0, addedWeightKg: 0 }, now)).rejects.toThrow()
    expect(await repositories.getSetEntriesForSession(sessionId)).toEqual([])
    expect((await repositories.getWorkoutState(sessionId))?.drafts['builtin:pull-up']).toEqual(state?.drafts['builtin:pull-up'])
    expect((await repositories.getWorkoutState(sessionId))?.restEndsAt).toBeNull()
  })

  it('recovers legacy open sessions without writes in a read query and cascades state on deletion', async () => {
    const session = await repositories.createWorkoutSession({ date: '2026-10-31', startedAt })
    await repositories.createSetEntry({ sessionId: session.id, exerciseId: 'builtin:pull-up', order: 0, reps: 9, addedWeightKg: 5 })
    await repositories.createSetEntry({ sessionId: session.id, exerciseId: 'builtin:plank', order: 1, durationSec: 60 })
    const active = await repositories.getActiveWorkout()
    expect(active?.state).toMatchObject({
      exerciseIds: ['builtin:pull-up', 'builtin:plank'], activeExerciseId: 'builtin:plank',
      drafts: { 'builtin:pull-up': { reps: 9, addedWeightKg: 5 }, 'builtin:plank': { durationSec: 60 } },
    })
    expect(await database.workoutStates.count()).toBe(0)
    await repositories.selectWorkoutExercise(session.id, 'builtin:pull-up')
    expect(await database.workoutStates.count()).toBe(1)
    await repositories.discardWorkout(session.id)
    expect(await repositories.getActiveWorkout()).toBeUndefined()
    expect(await database.workoutStates.count()).toBe(0)
    expect(await database.setEntries.count()).toBe(0)
  })

  it('protects a workout that was finished before discard could run', async () => {
    const sessionId = await startWithExercise()
    await repositories.logWorkoutSet(sessionId, 'builtin:pull-up', draft, now)
    await repositories.finishWorkout(sessionId, '2026-10-31T10:00:00Z')
    await expect(repositories.discardWorkout(sessionId)).rejects.toThrow('już zakończony')
    expect(await repositories.getSetEntriesForSession(sessionId)).toHaveLength(1)
  })

  it('protects an exercise selected in an open session before its first set', async () => {
    const sessionId = await startWithExercise()
    await expect(repositories.deleteExercise('builtin:pull-up')).rejects.toThrow('wybrane w treningu')
    await repositories.finishWorkout(sessionId, '2026-10-31T10:00:00Z')
    expect(await repositories.deleteExercise('builtin:pull-up')).toBe(true)
  })
})
