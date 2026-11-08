import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StreetTrackerDB } from './db'
import { createRepositories } from './repositories'

let database: StreetTrackerDB
let repositories: ReturnType<typeof createRepositories>

beforeEach(async () => {
  database = new StreetTrackerDB(`StreetTracker-history-${crypto.randomUUID()}`)
  await database.open()
  repositories = createRepositories(database)
})

afterEach(async () => { await database.delete() })

describe('history snapshots', () => {
  it('includes only completed sessions, newest first, and keeps empty sessions and ordered sets', async () => {
    const first = await repositories.createWorkoutSession({ date: '2026-10-01', startedAt: '2026-10-01T08:00:00Z', endedAt: '2026-10-01T09:00:00Z' })
    const later = await repositories.createWorkoutSession({ date: '2026-10-01', startedAt: '2026-10-01T18:00:00Z', endedAt: '2026-10-01T19:00:00Z' })
    const active = await repositories.createWorkoutSession({ date: '2026-10-31', startedAt: '2026-10-31T08:00:00Z' })
    const secondSet = await repositories.createSetEntry({ sessionId: first.id, exerciseId: 'builtin:pull-up', order: 2, reps: 10 })
    const firstSet = await repositories.createSetEntry({ sessionId: first.id, exerciseId: 'builtin:plank', order: 0, durationSec: 30 })
    await repositories.createSetEntry({ sessionId: active.id, exerciseId: 'builtin:pull-up', order: 0, reps: 20 })

    const history = await repositories.getWorkoutHistory()
    expect(history.sessions).toEqual([{ session: later, sets: [] }, { session: first, sets: [firstSet, secondSet] }])
    expect(history.exercises).toHaveLength(40)
    expect(history.exercises).toEqual(await repositories.listExercises())

    await repositories.finishWorkout(active.id, '2026-10-31T09:00:00Z')
    expect((await repositories.getWorkoutHistory()).sessions[0]?.session.id).toBe(active.id)
  })

  it('reflects saved, edited and cleared bodyweight without changing other sessions or sets', async () => {
    const session = await repositories.createWorkoutSession({ date: '2026-10-31', startedAt: '2026-10-31T08:00:00Z', endedAt: '2026-10-31T09:00:00Z', notes: 'Zachowaj' })
    const set = await repositories.createSetEntry({ sessionId: session.id, exerciseId: 'builtin:pull-up', order: 0, reps: 8 })
    await repositories.updateWorkoutSession(session.id, { bodyweight: 78.5 })
    expect((await repositories.getWorkoutHistory()).sessions[0]?.session.bodyweight).toBe(78.5)
    await repositories.updateWorkoutSession(session.id, { bodyweight: 79 })
    expect((await repositories.getWorkoutHistory()).sessions[0]?.session.bodyweight).toBe(79)
    await repositories.updateWorkoutSession(session.id, { bodyweight: undefined })
    expect((await repositories.getWorkoutHistory()).sessions).toEqual([{ session: { ...session, bodyweight: undefined }, sets: [set] }])
    await expect(repositories.updateWorkoutSession(session.id, { bodyweight: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('returns an empty history with the exercise catalogue when no session has finished', async () => {
    const history = await repositories.getWorkoutHistory()
    expect(history.sessions).toEqual([])
    expect(history.exercises).toHaveLength(40)
  })
})
