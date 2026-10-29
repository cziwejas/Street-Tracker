import { db, type StreetTrackerDB } from './db'
import type {
  Exercise,
  ExerciseChanges,
  ExerciseHistoryEntry,
  NewExercise,
  NewSetEntry,
  NewWorkoutSession,
  SetEntry,
  SetEntryChanges,
  WorkoutSession,
  WorkoutSessionChanges,
} from './types'
import {
  normalizeExercise,
  normalizeSession,
  RepositoryError,
  validateDate,
  validateSetEntry,
} from './validation'

function requireRecord<T>(record: T | undefined, label: string): T {
  if (record === undefined) {
    throw new RepositoryError('NOT_FOUND', `${label}: nie znaleziono rekordu.`)
  }
  return record
}

function compareSessions(a: WorkoutSession, b: WorkoutSession): number {
  return a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id)
}

/** Inject a database for isolated tests; application code can use repositories. */
export function createRepositories(database: StreetTrackerDB = db) {
  async function createExercise(input: NewExercise): Promise<Exercise> {
    const exercise = normalizeExercise({
      ...input,
      id: crypto.randomUUID(),
      isCustom: true,
      variants: input.variants ?? [],
    })
    await database.exercises.add(exercise)
    return exercise
  }

  async function getExercise(id: string): Promise<Exercise | undefined> {
    return database.exercises.get(id)
  }

  async function listExercises(): Promise<Exercise[]> {
    const exercises = await database.exercises.toArray()
    return exercises.sort((a, b) => a.name.localeCompare(b.name, 'pl') || a.id.localeCompare(b.id))
  }

  async function updateExercise(id: string, changes: ExerciseChanges): Promise<Exercise> {
    return database.transaction('rw', database.exercises, async () => {
      const current = requireRecord(await database.exercises.get(id), 'Ćwiczenie')
      const updated = normalizeExercise({ ...current, ...changes, id, isCustom: current.isCustom })
      await database.exercises.put(updated)
      return updated
    })
  }

  async function deleteExercise(id: string): Promise<boolean> {
    return database.transaction('rw', database.exercises, database.setEntries, async () => {
      if (!(await database.exercises.get(id))) return false
      if (await database.setEntries.where('exerciseId').equals(id).count()) {
        throw new RepositoryError('IN_USE', 'Ćwiczenie jest używane w historii treningów.')
      }
      await database.exercises.delete(id)
      return true
    })
  }

  async function createWorkoutSession(input: NewWorkoutSession): Promise<WorkoutSession> {
    const session = normalizeSession({
      ...input,
      id: crypto.randomUUID(),
      endedAt: input.endedAt ?? null,
      notes: input.notes ?? '',
    })
    await database.workoutSessions.add(session)
    return session
  }

  async function getWorkoutSession(id: string): Promise<WorkoutSession | undefined> {
    return database.workoutSessions.get(id)
  }

  async function listWorkoutSessions(): Promise<WorkoutSession[]> {
    return (await database.workoutSessions.toArray()).sort(compareSessions)
  }

  async function updateWorkoutSession(id: string, changes: WorkoutSessionChanges): Promise<WorkoutSession> {
    return database.transaction('rw', database.workoutSessions, async () => {
      const current = requireRecord(await database.workoutSessions.get(id), 'Trening')
      const updated = normalizeSession({ ...current, ...changes, id })
      await database.workoutSessions.put(updated)
      return updated
    })
  }

  async function deleteWorkoutSession(id: string): Promise<boolean> {
    return database.transaction('rw', database.workoutSessions, database.setEntries, async () => {
      if (!(await database.workoutSessions.get(id))) return false
      await database.setEntries.where('sessionId').equals(id).delete()
      await database.workoutSessions.delete(id)
      return true
    })
  }

  async function requireSetParents(entry: SetEntry): Promise<Exercise> {
    requireRecord(await database.workoutSessions.get(entry.sessionId), 'Trening')
    return requireRecord(await database.exercises.get(entry.exerciseId), 'Ćwiczenie')
  }

  async function createSetEntry(input: NewSetEntry): Promise<SetEntry> {
    const entry: SetEntry = { ...input, id: crypto.randomUUID(), note: input.note ?? '' }
    return database.transaction('rw', database.setEntries, database.workoutSessions, database.exercises, async () => {
      const exercise = await requireSetParents(entry)
      validateSetEntry(entry, exercise)
      await database.setEntries.add(entry)
      return entry
    })
  }

  async function getSetEntry(id: string): Promise<SetEntry | undefined> {
    return database.setEntries.get(id)
  }

  async function getSetEntriesForSession(sessionId: string): Promise<SetEntry[]> {
    return database.setEntries
      .where('[sessionId+order]')
      .between([sessionId, 0], [sessionId, Infinity], true, true)
      .toArray()
  }

  async function updateSetEntry(id: string, changes: SetEntryChanges): Promise<SetEntry> {
    return database.transaction('rw', database.setEntries, database.workoutSessions, database.exercises, async () => {
      const current = requireRecord(await database.setEntries.get(id), 'Seria')
      const updated: SetEntry = { ...current, ...changes, id }
      const exercise = await requireSetParents(updated)
      validateSetEntry(updated, exercise)
      await database.setEntries.put(updated)
      return updated
    })
  }

  async function deleteSetEntry(id: string): Promise<boolean> {
    return database.transaction('rw', database.setEntries, async () => {
      if (!(await database.setEntries.get(id))) return false
      await database.setEntries.delete(id)
      return true
    })
  }

  /** Inclusive calendar dates, ascending by date and start time. */
  async function getSessionsByDateRange(fromDate: string, toDate: string): Promise<WorkoutSession[]> {
    validateDate(fromDate)
    validateDate(toDate)
    if (fromDate > toDate) {
      throw new RepositoryError('VALIDATION', 'Początek zakresu dat nie może być późniejszy niż koniec.')
    }
    const sessions = await database.workoutSessions.where('date').between(fromDate, toDate, true, true).toArray()
    return sessions.sort(compareSessions)
  }

  /** Newest sessions first, with sets in their session order. */
  async function getHistoryForExercise(exerciseId: string): Promise<ExerciseHistoryEntry[]> {
    return database.transaction('r', database.setEntries, database.workoutSessions, async () => {
      const sets = await database.setEntries.where('exerciseId').equals(exerciseId).toArray()
      const sessionIds = [...new Set(sets.map((entry) => entry.sessionId))]
      const sessions = await database.workoutSessions.bulkGet(sessionIds)
      const sessionsById = new Map(
        sessions.filter((session): session is WorkoutSession => session !== undefined).map((session) => [session.id, session]),
      )
      const history = sets.map((set) => ({
        set,
        session: requireRecord(sessionsById.get(set.sessionId), 'Trening'),
      }))
      return history.sort((a, b) =>
        b.session.date.localeCompare(a.session.date)
        || b.session.startedAt.localeCompare(a.session.startedAt)
        || a.session.id.localeCompare(b.session.id)
        || a.set.order - b.set.order
        || a.set.id.localeCompare(b.set.id),
      )
    })
  }

  return {
    createExercise,
    getExercise,
    listExercises,
    updateExercise,
    deleteExercise,
    createWorkoutSession,
    getWorkoutSession,
    listWorkoutSessions,
    updateWorkoutSession,
    deleteWorkoutSession,
    createSetEntry,
    getSetEntry,
    getSetEntriesForSession,
    updateSetEntry,
    deleteSetEntry,
    getHistoryForExercise,
    getSessionsByDateRange,
  }
}

export const repositories = createRepositories()

export { RepositoryError } from './validation'
