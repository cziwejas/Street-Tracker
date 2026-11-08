import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { StreetTrackerDB } from './db'
import { currentGymExercises, gymExercises, hipAdduction, kickbackName } from './gymSeed'

const connections: Dexie[] = []
const databaseNames = new Set<string>()
let databaseSequence = 0

function createDatabaseName(): string {
  const name = `street-tracker-schema-test-${++databaseSequence}`
  databaseNames.add(name)
  return name
}

function createDatabase(name = createDatabaseName()): StreetTrackerDB {
  const database = new StreetTrackerDB(name)
  connections.push(database)
  return database
}

afterEach(async () => {
  for (const connection of connections) {
    connection.close()
  }

  await Promise.all([...databaseNames].map((name) => Dexie.delete(name)))
  connections.length = 0
  databaseNames.clear()
})

describe('StreetTrackerDB schema and first-run seed', () => {
  it.each(['default', 'renamed', 'deleted'])('upgrades v5 with a %s kickback, preserving history and deletions', async (mode) => {
    const name = createDatabaseName()
    const original = new Dexie(name)
    connections.push(original)
    original.version(5).stores({
      exercises: 'id, name, category, trackingType', workoutSessions: 'id, date, startedAt',
      setEntries: 'id, sessionId, exerciseId, [sessionId+order]', workoutStates: 'sessionId',
      workoutSettings: 'id', backupMetadata: 'id',
    })
    await original.open()
    await original.table('exercises').bulkAdd(gymExercises)
    await original.table('exercises').delete('builtin:hip-thrust')
    if (mode === 'renamed') {
      await original.table('exercises').update('builtin:cable-kickback', { name: 'Mój kickback' })
      await original.table('exercises').add({ ...hipAdduction, name: 'Moje przywodzenie' })
    } else if (mode === 'deleted') {
      await original.table('exercises').delete('builtin:cable-kickback')
    }
    const session = { id: 'legacy', date: '2026-11-01', startedAt: '2026-11-01T10:00:00Z', endedAt: null, notes: '' }
    const set = { id: 'legacy-set', sessionId: session.id, exerciseId: 'builtin:leg-press', order: 0, reps: 12, addedWeightKg: 30 }
    await original.table('workoutSessions').add(session)
    await original.table('setEntries').add(set)
    original.close()

    const upgraded = createDatabase(name)
    await upgraded.open()
    expect(await upgraded.exercises.get(hipAdduction.id)).toEqual({
      ...hipAdduction, name: mode === 'renamed' ? 'Moje przywodzenie' : hipAdduction.name,
    })
    expect((await upgraded.exercises.get('builtin:cable-kickback'))?.name).toBe(
      mode === 'deleted' ? undefined : mode === 'renamed' ? 'Mój kickback' : kickbackName,
    )
    expect(await upgraded.exercises.get('builtin:hip-thrust')).toBeUndefined()
    expect(await upgraded.workoutSessions.toArray()).toEqual([session])
    expect(await upgraded.setEntries.toArray()).toEqual([set])
    await upgraded.exercises.delete(hipAdduction.id)
    upgraded.close()
    const reopened = createDatabase(name)
    await reopened.open()
    expect(await reopened.exercises.get(hipAdduction.id)).toBeUndefined()
  })

  it('opens version 6 with all domain tables and both built-in catalogues', async () => {
    const database = createDatabase()
    await database.open()

    expect(database.verno).toBe(6)
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'backupMetadata',
      'exercises',
      'setEntries',
      'workoutSessions',
      'workoutSettings',
      'workoutStates',
    ])
    expect(await database.workoutSessions.count()).toBe(0)
    expect(await database.setEntries.count()).toBe(0)

    const exercises = await database.exercises.toArray()
    expect(exercises).toHaveLength(41)
    expect(new Set(exercises.map((exercise) => exercise.id)).size).toBe(41)
    expect(new Set(exercises.map((exercise) => exercise.name)).size).toBe(41)
    expect(new Set(exercises.map((exercise) => exercise.category))).toEqual(
      new Set(['push', 'pull', 'legs', 'core', 'skills']),
    )
    expect(exercises.every((exercise) => exercise.id.startsWith('builtin:'))).toBe(true)
    expect(exercises.every((exercise) => !exercise.isCustom)).toBe(true)
    expect(exercises.map((exercise) => exercise.id)).toEqual(
      expect.arrayContaining([
        'builtin:pull-up',
        'builtin:dip',
        'builtin:push-up',
        'builtin:muscle-up',
        'builtin:l-sit',
        'builtin:planche',
        'builtin:front-lever',
        'builtin:pistol-squat',
        'builtin:hip-thrust',
        'builtin:leg-press',
      ]),
    )
  })

  it('seeds Polish names, weighted repetitions, and ordered static skill progressions', async () => {
    const database = createDatabase()
    await database.open()

    expect(await database.exercises.get('builtin:pull-up')).toMatchObject({
      name: 'Podciąganie nachwytem',
      category: 'pull',
      trackingType: 'reps_weight',
      supportsAddedWeight: true,
      isCustom: false,
    })
    expect(await database.exercises.get('builtin:planche')).toMatchObject({
      name: 'Waga w podporze (planche)',
      category: 'skills',
      trackingType: 'time',
      supportsAddedWeight: false,
      variants: [
        'Kuczna (tuck)',
        'Zaawansowana kuczna (advanced tuck)',
        'Rozkroczna (straddle)',
        'Pełna (full)',
      ],
    })

    const skills = await database.exercises.where('category').equals('skills').toArray()
    expect(skills).toHaveLength(5)
    expect(skills.every((exercise) => exercise.trackingType === 'time')).toBe(true)
    expect(await database.exercises.where('name').equals('Deska').count()).toBe(1)
  })

  it('preserves edits, deletions, and custom exercises when an existing database reopens', async () => {
    const database = createDatabase()
    await database.open()
    await database.exercises.update('builtin:pull-up', {
      name: 'Moje podciąganie',
      variants: ['Mój pierwszy krok', 'Mój drugi krok'],
    })
    await database.exercises.delete('builtin:dip')
    await database.exercises.delete('builtin:hip-thrust')
    await database.exercises.add({
      id: 'custom:test-exercise',
      name: 'Moje ćwiczenie',
      category: 'core',
      trackingType: 'time',
      supportsAddedWeight: false,
      variants: [],
      isCustom: true,
    })
    database.close()

    const reopenedDatabase = createDatabase(database.name)
    await reopenedDatabase.open()

    expect(await reopenedDatabase.exercises.count()).toBe(40)
    expect(await reopenedDatabase.exercises.get('builtin:pull-up')).toMatchObject({
      name: 'Moje podciąganie',
      variants: ['Mój pierwszy krok', 'Mój drugi krok'],
    })
    expect(await reopenedDatabase.exercises.get('builtin:dip')).toBeUndefined()
    expect(await reopenedDatabase.exercises.get('builtin:hip-thrust')).toBeUndefined()
    expect(await reopenedDatabase.exercises.get('custom:test-exercise')).toMatchObject({
      name: 'Moje ćwiczenie',
      isCustom: true,
    })
  })

  it('does not restore the catalogue after the user deletes every exercise', async () => {
    const database = createDatabase()
    await database.open()
    await database.exercises.clear()
    database.close()

    const reopenedDatabase = createDatabase(database.name)
    await reopenedDatabase.open()

    expect(await reopenedDatabase.exercises.count()).toBe(0)
  })

  it('upgrades the original empty version 1 database and seeds its new exercise table', async () => {
    const name = createDatabaseName()
    const originalDatabase = new Dexie(name)
    connections.push(originalDatabase)
    originalDatabase.version(1).stores({})
    await originalDatabase.open()
    expect(originalDatabase.verno).toBe(1)
    expect(originalDatabase.tables).toHaveLength(0)
    originalDatabase.close()

    const upgradedDatabase = createDatabase(name)
    await upgradedDatabase.open()

    expect(upgradedDatabase.verno).toBe(6)
    expect(await upgradedDatabase.exercises.count()).toBe(41)
    expect(await upgradedDatabase.exercises.get('builtin:front-lever')).toMatchObject({
      name: 'Waga przodem (front lever)',
      trackingType: 'time',
    })
    expect(await upgradedDatabase.workoutSessions.count()).toBe(0)
    expect(await upgradedDatabase.setEntries.count()).toBe(0)
  })

  it('upgrades version 2 adding gym exercises without restoring old deletions or rewriting history', async () => {
    const name = createDatabaseName()
    const originalDatabase = new Dexie(name)
    connections.push(originalDatabase)
    originalDatabase.version(2).stores({
      exercises: 'id, name, category, trackingType',
      workoutSessions: 'id, date, startedAt',
      setEntries: 'id, sessionId, exerciseId, [sessionId+order]',
    })
    await originalDatabase.open()
    const exercise = {
      id: 'builtin:pull-up', name: 'Moje podciąganie', category: 'pull',
      trackingType: 'reps_weight', supportsAddedWeight: true, variants: ['Mój wariant'], isCustom: false,
    }
    const session = {
      id: 'legacy-session', date: '2026-10-29', startedAt: '2026-10-29T10:00:00.000Z', endedAt: null, notes: 'Zachowaj',
    }
    const set = { id: 'legacy-set', sessionId: session.id, exerciseId: exercise.id, order: 0, reps: 12, note: 'Seria' }
    await originalDatabase.table('exercises').add(exercise)
    await originalDatabase.table('workoutSessions').add(session)
    await originalDatabase.table('setEntries').add(set)
    originalDatabase.close()

    const upgradedDatabase = createDatabase(name)
    await upgradedDatabase.open()

    expect(upgradedDatabase.verno).toBe(6)
    expect(await upgradedDatabase.exercises.count()).toBe(12)
    expect(await upgradedDatabase.exercises.get(exercise.id)).toEqual(exercise)
    expect(await upgradedDatabase.exercises.get('builtin:dip')).toBeUndefined()
    expect(await upgradedDatabase.exercises.bulkGet(currentGymExercises.map((exercise) => exercise.id))).toEqual(currentGymExercises)
    expect(await upgradedDatabase.workoutSessions.toArray()).toEqual([session])
    expect(await upgradedDatabase.setEntries.toArray()).toEqual([set])
    expect(await upgradedDatabase.workoutStates.count()).toBe(0)
    expect(await upgradedDatabase.workoutSettings.count()).toBe(0)
  })

  it('upgrades version 3 adding only gym exercises and preserving workout drafts and settings', async () => {
    const name = createDatabaseName()
    const originalDatabase = new Dexie(name)
    connections.push(originalDatabase)
    originalDatabase.version(3).stores({
      exercises: 'id, name, category, trackingType', workoutSessions: 'id, date, startedAt',
      setEntries: 'id, sessionId, exerciseId, [sessionId+order]', workoutStates: 'sessionId', workoutSettings: 'id',
    })
    await originalDatabase.open()
    const state = { sessionId: 'legacy', exerciseIds: [], activeExerciseId: null, drafts: {}, restEndsAt: null }
    const settings = { id: 'workouts', restDurationSec: 120 }
    await originalDatabase.table('workoutStates').add(state)
    await originalDatabase.table('workoutSettings').add(settings)
    originalDatabase.close()

    const upgradedDatabase = createDatabase(name)
    await upgradedDatabase.open()
    expect(upgradedDatabase.verno).toBe(6)
    expect(await upgradedDatabase.exercises.count()).toBe(11)
    expect(await upgradedDatabase.workoutStates.toArray()).toEqual([state])
    expect(await upgradedDatabase.workoutSettings.toArray()).toEqual([settings])
    expect(await upgradedDatabase.backupMetadata.count()).toBe(0)
  })

  it('upgrades version 4 once, preserving existing gym IDs and all user data', async () => {
    const name = createDatabaseName()
    const originalDatabase = new Dexie(name)
    connections.push(originalDatabase)
    originalDatabase.version(4).stores({
      exercises: 'id, name, category, trackingType', workoutSessions: 'id, date, startedAt',
      setEntries: 'id, sessionId, exerciseId, [sessionId+order]', workoutStates: 'sessionId',
      workoutSettings: 'id', backupMetadata: 'id',
    })
    await originalDatabase.open()
    const exercise = { id: 'builtin:hip-thrust', name: 'Mój hip thrust', category: 'legs', trackingType: 'reps_weight', supportsAddedWeight: true, variants: ['Mój wariant'], isCustom: true }
    const settings = { id: 'workouts', restDurationSec: 150 }
    const metadata = { id: 'backup', lastExportedAt: '2026-10-31T09:00:00.000Z' }
    await originalDatabase.table('exercises').add(exercise)
    await originalDatabase.table('workoutSettings').add(settings)
    await originalDatabase.table('backupMetadata').add(metadata)
    originalDatabase.close()

    const upgraded = createDatabase(name)
    await upgraded.open()
    expect(upgraded.verno).toBe(6)
    expect(await upgraded.exercises.count()).toBe(11)
    expect(await upgraded.exercises.get(exercise.id)).toEqual(exercise)
    expect(await upgraded.exercises.get('builtin:dip')).toBeUndefined()
    expect(await upgraded.workoutSettings.get('workouts')).toEqual(settings)
    expect(await upgraded.backupMetadata.get('backup')).toEqual(metadata)
    await upgraded.exercises.delete('builtin:leg-press')
    upgraded.close()

    const reopened = createDatabase(name)
    await reopened.open()
    expect(await reopened.exercises.count()).toBe(10)
    expect(await reopened.exercises.get('builtin:leg-press')).toBeUndefined()
  })
})
