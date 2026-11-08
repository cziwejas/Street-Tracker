import Dexie, { type Table } from 'dexie'
import { builtinExercises } from './seed'
import { gymExercises } from './gymSeed'
import type { BackupMetadata, Exercise, SetEntry, WorkoutSession, WorkoutSettings, WorkoutState } from './types'

export class StreetTrackerDB extends Dexie {
  declare exercises: Table<Exercise, string>
  declare workoutSessions: Table<WorkoutSession, string>
  declare setEntries: Table<SetEntry, string>
  declare workoutStates: Table<WorkoutState, string>
  declare workoutSettings: Table<WorkoutSettings, string>
  declare backupMetadata: Table<BackupMetadata, string>

  constructor(name = 'StreetTracker') {
    super(name)

    // Preserve the released skeleton schema so existing installations upgrade.
    this.version(1).stores({})

    this.version(2)
      .stores({
        exercises: 'id, name, category, trackingType',
        workoutSessions: 'id, date, startedAt',
        setEntries: 'id, sessionId, exerciseId, [sessionId+order]',
      })
      .upgrade(async (transaction) => {
        await transaction.table<Exercise, string>('exercises').bulkAdd(builtinExercises)
      })

    // Add workout drafts and preferences without rewriting existing history or seeds.
    this.version(3).stores({
      workoutStates: 'sessionId',
      workoutSettings: 'id',
    })

    // Backup bookkeeping is local data too; preserve every released schema above.
    this.version(4).stores({ backupMetadata: 'id' })

    // Add only the new catalogue once, preserving user edits and older deletions.
    this.version(5).stores({}).upgrade(async (transaction) => {
      const exercises = transaction.table<Exercise, string>('exercises')
      const existing = await exercises.bulkGet(gymExercises.map((exercise) => exercise.id))
      await exercises.bulkAdd(gymExercises.filter((_, index) => existing[index] === undefined))
    })

    // New databases start directly at the latest version; upgrade() is skipped.
    this.on('populate', async (transaction) => {
      await transaction.table<Exercise, string>('exercises').bulkAdd([...builtinExercises, ...gymExercises])
    })
  }
}

export const db: StreetTrackerDB = new StreetTrackerDB()

export async function initializeDatabase(database = db): Promise<void> {
  await database.open()
}
