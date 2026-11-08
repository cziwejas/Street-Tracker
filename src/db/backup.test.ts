import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseBackupJson, serializeBackup } from '../features/settings/backupFiles'
import { StreetTrackerDB } from './db'
import { createRepositories } from './repositories'

const databases: StreetTrackerDB[] = []
let sequence = 0
let database: StreetTrackerDB
let source: ReturnType<typeof createRepositories>
const exportedAt = '2026-10-31T12:00:00.000Z'

function newDatabase() {
  const db = new StreetTrackerDB(`street-tracker-backup-test-${++sequence}`)
  databases.push(db)
  return db
}

beforeEach(async () => {
  database = newDatabase()
  source = createRepositories(database)
  await database.open()
})

afterEach(async () => {
  vi.restoreAllMocks()
  for (const db of databases) db.close()
  for (const name of new Set(databases.map((db) => db.name))) await new StreetTrackerDB(name).delete()
  databases.length = 0
})

async function populate() {
  await source.deleteExercise('builtin:dip')
  const exercise = await source.createExercise({
    name: 'Moje ćwiczenie „Żółw”', category: 'pull', trackingType: 'reps_weight', supportsAddedWeight: true,
    variants: ['Łatwy', 'Trudny'],
  })
  const session = await source.createWorkoutSession({
    date: '2026-10-30', startedAt: '2026-10-30T10:00:00+01:00', endedAt: '2026-10-30T11:00:00+01:00',
    bodyweight: 78.5, notes: 'Zażółć, "gęślą"\njaźń',
  })
  const set = await source.createSetEntry({
    sessionId: session.id, exerciseId: exercise.id, order: 0, reps: 8, addedWeightKg: 2.5, repsInReserve: 0,
    variant: 'Dawna nazwa wariantu', note: 'Pierwsza seria',
  })
  await source.createSetEntry({ sessionId: session.id, exerciseId: 'builtin:planche', order: 1, durationSec: 12.5, note: '' })
  // Optional measurements are absent, not coerced to zero.
  await source.createSetEntry({ sessionId: session.id, exerciseId: exercise.id, order: 2 })
  const active = await source.startWorkout('2026-10-31T10:00:00Z', '2026-10-31')
  await source.addWorkoutExercise(active.session.id, exercise.id)
  await source.logWorkoutSet(active.session.id, exercise.id, { reps: 7, durationSec: 30, addedWeightKg: 5 }, 1000)
  await source.updateWorkoutDraft(active.session.id, exercise.id, { reps: 6, durationSec: 25, addedWeightKg: 0, withAddedWeight: true, variant: 'Łatwy' })
  await source.updateWorkoutSettings({ restDurationSec: 123 })
  await source.recordBackupExport('2026-10-01T10:00:00Z')
  return { exercise, session, set, active }
}

describe('JSON backup repository', () => {
  it.each([true, false])('round trips gym mode %s through export and import', async (gymMode) => {
    await source.updateWorkoutSettings({ gymMode })
    const backup = parseBackupJson(serializeBackup(await source.exportData(), exportedAt))
    const restored = createRepositories(newDatabase())
    await restored.importData(backup.data, 'replace')
    expect(await restored.getWorkoutSettings()).toEqual({ id: 'workouts', restDurationSec: 90, gymMode })
  })

  it('round trips all tables through JSON into a fresh database, retaining IDs, deletions and active workout state after reopening', async () => {
    const { active } = await populate()
    const original = serializeBackup(await source.exportData(), exportedAt)
    const backup = parseBackupJson(original)
    const restoredDatabase = newDatabase()
    const restored = createRepositories(restoredDatabase)
    await restored.importData(backup.data, 'replace')
    restoredDatabase.close()
    const reopenedDatabase = new StreetTrackerDB(restoredDatabase.name)
    databases.push(reopenedDatabase)
    const reopened = createRepositories(reopenedDatabase)

    expect(parseBackupJson(serializeBackup(await reopened.exportData(), exportedAt))).toEqual(backup)
    expect(await reopened.getExercise('builtin:dip')).toBeUndefined()
    expect((await reopened.getActiveWorkout())?.session.id).toBe(active.session.id)
    expect((await reopened.getActiveWorkout())?.state.restEndsAt).toBe(91_000)
    expect(await reopened.getWorkoutSettings()).toEqual({ id: 'workouts', restDurationSec: 123 })
    expect(await reopened.getBackupMetadata()).toEqual({ id: 'backup', lastExportedAt: '2026-10-01T10:00:00.000Z' })
  })

  it('merges new records, preserves local collisions and is idempotent', async () => {
    const { exercise, set } = await populate()
    const target = createRepositories(newDatabase())
    await target.importData(parseBackupJson(serializeBackup(await source.exportData())).data, 'replace')
    await target.updateExercise(exercise.id, { name: 'Lokalna nazwa' })
    await target.updateSetEntry(set.id, { reps: 99 })
    await target.updateWorkoutSettings({ restDurationSec: 42 })
    await target.recordBackupExport(exportedAt)
    const local = await target.createExercise({ name: 'Tylko lokalne', category: 'legs', trackingType: 'reps', supportsAddedWeight: false })
    const added = await source.createWorkoutSession({ date: '2026-10-29', startedAt: '2026-10-29T09:00:00Z', endedAt: '2026-10-29T10:00:00Z' })
    await source.createSetEntry({ sessionId: added.id, exerciseId: exercise.id, order: 0, reps: 5 })
    const incoming = parseBackupJson(serializeBackup(await source.exportData())).data

    expect((await target.importData(incoming, 'merge')).importedRecords).toBe(2)
    expect((await target.getExercise(exercise.id))?.name).toBe('Lokalna nazwa')
    expect((await target.getSetEntry(set.id))?.reps).toBe(99)
    expect(await target.getExercise(local.id)).toEqual(local)
    expect(await target.getWorkoutSession(added.id)).toBeDefined()
    expect((await target.getWorkoutSettings()).restDurationSec).toBe(42)
    expect((await target.getBackupMetadata())?.lastExportedAt).toBe(exportedAt)
    expect((await target.importData(incoming, 'merge')).importedRecords).toBe(0)
    expect(await target.getSetEntriesForSession(added.id)).toHaveLength(1)
  })

  it('replaces every table, including clearing an empty backup without reseeding on reopen', async () => {
    await populate()
    await source.importData({ exercises: [], workoutSessions: [], setEntries: [], workoutStates: [], workoutSettings: [], backupMetadata: [] }, 'replace')
    database.close()
    await database.open()
    const data = await source.exportData()
    expect(Object.values(data).every((rows) => rows.length === 0)).toBe(true)
    expect(await source.getActiveWorkout()).toBeUndefined()
  })

  it.each(['merge', 'replace'] as const)('rejects invalid references without writes in %s mode', async (mode) => {
    const { set } = await populate()
    const before = serializeBackup(await source.exportData(), exportedAt)
    const data = parseBackupJson(before).data
    const invalid = { ...data, setEntries: [{ ...set, exerciseId: 'missing-exercise' }] }
    await expect(source.importData(invalid, mode)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(serializeBackup(await source.exportData(), exportedAt)).toBe(before)
  })

  it('rejects merge conflicts against local parent records atomically', async () => {
    await populate()
    const target = createRepositories(newDatabase())
    await target.updateExercise('builtin:pull-up', { supportsAddedWeight: false, trackingType: 'reps' })
    const session = await source.createWorkoutSession({ date: '2026-10-28', startedAt: '2026-10-28T09:00:00Z' })
    await source.createSetEntry({ sessionId: session.id, exerciseId: 'builtin:pull-up', order: 0, reps: 10, addedWeightKg: 5 })
    const before = serializeBackup(await target.exportData(), exportedAt)
    await expect(target.importData(await source.exportData(), 'merge')).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(serializeBackup(await target.exportData(), exportedAt)).toBe(before)
  })

  it('rolls back clears and earlier table writes when storage fails mid-replacement', async () => {
    await populate()
    const before = serializeBackup(await source.exportData(), exportedAt)
    vi.spyOn(database.setEntries, 'bulkPut').mockRejectedValueOnce(new Error('Storage failure'))
    const empty = { exercises: [], workoutSessions: [], setEntries: [], workoutStates: [], workoutSettings: [], backupMetadata: [] }
    await expect(source.importData(empty, 'replace')).rejects.toThrow('Storage failure')
    expect(serializeBackup(await source.exportData(), exportedAt)).toBe(before)
  })

  it('round trips a finished workout whose unused selected exercise was later deleted', async () => {
    const exercise = await source.createExercise({ name: 'Usunięte', category: 'core', trackingType: 'time', supportsAddedWeight: false })
    const active = await source.startWorkout('2026-10-31T10:00:00Z', '2026-10-31')
    await source.addWorkoutExercise(active.session.id, exercise.id)
    await source.finishWorkout(active.session.id, '2026-10-31T11:00:00Z')
    await source.deleteExercise(exercise.id)
    const json = serializeBackup(await source.exportData(), exportedAt)
    await source.importData(parseBackupJson(json).data, 'replace')
    expect(parseBackupJson(serializeBackup(await source.exportData(), exportedAt))).toEqual(parseBackupJson(json))
  })
})

describe('untrusted JSON validation', () => {
  it.each(['{', 'null', '[]', '{}', '{"format":"street-tracker","version":2}', '{"format":"other","version":1}'])('rejects malformed or unsupported input: %s', (json) => {
    expect(() => parseBackupJson(json)).toThrow()
  })

  it('accepts UTF-8 BOM and rejects missing tables, duplicate IDs, bad metrics, timestamps, drafts and settings', async () => {
    const { exercise, set, session } = await populate()
    const backup = parseBackupJson(serializeBackup(await source.exportData(), exportedAt))
    expect(parseBackupJson(`\uFEFF${JSON.stringify(backup)}`)).toEqual(backup)
    const invalidData: unknown[] = [
      { ...backup.data, workoutStates: undefined },
      { ...backup.data, exercises: [exercise, exercise] },
      { ...backup.data, exercises: [{ ...exercise, isCustom: 'true' }] },
      { ...backup.data, exercises: [{ ...exercise, id: '__proto__' }] },
      { ...backup.data, exercises: [{ ...exercise, id: 'toString' }] },
      { ...backup.data, exercises: [{ ...exercise, variants: ['A', 'A'] }] },
      { ...backup.data, setEntries: [{ ...set, reps: '8' }] },
      { ...backup.data, setEntries: [{ ...set, reps: -1 }] },
      { ...backup.data, setEntries: [{ ...set, order: 0.5 }] },
      { ...backup.data, setEntries: [{ ...set, repsInReserve: 0.5 }] },
      { ...backup.data, workoutSessions: [{ ...session, date: '2026-02-30' }] },
      { ...backup.data, workoutSessions: [{ ...session, startedAt: '2026-10-30T09:00:00' }] },
      { ...backup.data, workoutSessions: [{ ...session, endedAt: '2020-01-01T00:00:00Z' }] },
      { ...backup.data, workoutStates: [{ ...backup.data.workoutStates[0], sessionId: 'missing' }] },
      { ...backup.data, workoutStates: [{ ...backup.data.workoutStates[0], activeExerciseId: 'missing' }] },
      { ...backup.data, workoutStates: [{ ...backup.data.workoutStates[0], drafts: {} }] },
      { ...backup.data, workoutStates: [{ ...backup.data.workoutStates[0], restEndsAt: '123' }] },
      { ...backup.data, workoutSettings: [{ id: 'workouts', restDurationSec: 3601 }] },
      { ...backup.data, workoutSettings: [{ id: 'workouts', restDurationSec: 90, gymMode: 'true' }] },
      { ...backup.data, backupMetadata: [{ id: 'backup', lastExportedAt: 'yesterday' }] },
    ]
    for (const data of invalidData) expect(() => parseBackupJson(JSON.stringify({ ...backup, data }))).toThrow()
  })
})
