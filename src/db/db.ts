import Dexie, { type Table } from 'dexie'
import { builtinExercises } from './seed'
import type { Exercise, SetEntry, WorkoutSession } from './types'

export class StreetTrackerDB extends Dexie {
  declare exercises: Table<Exercise, string>
  declare workoutSessions: Table<WorkoutSession, string>
  declare setEntries: Table<SetEntry, string>

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

    // New databases start directly at the latest version; upgrade() is skipped.
    this.on('populate', async (transaction) => {
      await transaction.table<Exercise, string>('exercises').bulkAdd(builtinExercises)
    })
  }
}

export const db: StreetTrackerDB = new StreetTrackerDB()

export async function initializeDatabase(database = db): Promise<void> {
  await database.open()
}
