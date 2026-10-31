import { createId } from '../lib/createId'
import { db, type StreetTrackerDB } from './db'
import type {
  ActiveWorkout,
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
  WorkoutDraft,
  WorkoutSettings,
  WorkoutState,
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
      id: createId(),
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
    return database.transaction('rw', database.exercises, database.setEntries, database.workoutStates, database.workoutSessions, async () => {
      if (!(await database.exercises.get(id))) return false
      if (await database.setEntries.where('exerciseId').equals(id).count()) {
        throw new RepositoryError('IN_USE', 'Ćwiczenie jest używane w historii treningów.')
      }
      const selectedStates = await database.workoutStates.filter((state) => state.exerciseIds.includes(id)).toArray()
      const selectedSessions = await database.workoutSessions.bulkGet(selectedStates.map((state) => state.sessionId))
      if (selectedSessions.some((session) => session?.endedAt === null)) {
        throw new RepositoryError('IN_USE', 'Ćwiczenie jest wybrane w treningu.')
      }
      await database.exercises.delete(id)
      return true
    })
  }

  async function createWorkoutSession(input: NewWorkoutSession): Promise<WorkoutSession> {
    const session = normalizeSession({
      ...input,
      id: createId(),
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
    return database.transaction('rw', database.workoutSessions, database.setEntries, database.workoutStates, async () => {
      if (!(await database.workoutSessions.get(id))) return false
      await database.setEntries.where('sessionId').equals(id).delete()
      await database.workoutStates.delete(id)
      await database.workoutSessions.delete(id)
      return true
    })
  }

  async function requireSetParents(entry: SetEntry): Promise<Exercise> {
    requireRecord(await database.workoutSessions.get(entry.sessionId), 'Trening')
    return requireRecord(await database.exercises.get(entry.exerciseId), 'Ćwiczenie')
  }

  async function createSetEntry(input: NewSetEntry): Promise<SetEntry> {
    const entry: SetEntry = { ...input, id: createId(), note: input.note ?? '' }
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

  const workoutTables = [
    database.workoutSessions,
    database.setEntries,
    database.exercises,
    database.workoutStates,
    database.workoutSettings,
  ]

  function defaultDraft(exercise: Exercise, set?: SetEntry): WorkoutDraft {
    return {
      reps: set?.reps ?? 8,
      durationSec: set?.durationSec ?? 30,
      addedWeightKg: exercise.supportsAddedWeight ? set?.addedWeightKg ?? 0 : 0,
      ...(set?.variant === undefined ? {} : { variant: set.variant }),
    }
  }

  function validateDraft(draft: WorkoutDraft, exercise: Exercise, completed: boolean): void {
    if (!Number.isInteger(draft.reps) || draft.reps < 0
      || !Number.isFinite(draft.durationSec) || draft.durationSec < 0
      || !Number.isFinite(draft.addedWeightKg) || draft.addedWeightKg < 0) {
      throw new RepositoryError('VALIDATION', 'Wpisz poprawne, nieujemne wartości serii.')
    }
    if (draft.addedWeightKg > 0 && !exercise.supportsAddedWeight) {
      throw new RepositoryError('VALIDATION', 'To ćwiczenie nie obsługuje dodatkowego ciężaru.')
    }
    if (draft.variant !== undefined && !draft.variant.trim()) {
      throw new RepositoryError('VALIDATION', 'Wariant serii musi mieć niepustą nazwę.')
    }
    if (completed && (exercise.trackingType === 'time' ? draft.durationSec : draft.reps) <= 0) {
      throw new RepositoryError('VALIDATION', exercise.trackingType === 'time'
        ? 'Czas serii musi być większy od zera.'
        : 'Liczba powtórzeń musi być większa od zera.')
    }
  }

  async function requireOpenWorkout(sessionId: string): Promise<WorkoutSession> {
    const session = requireRecord(await database.workoutSessions.get(sessionId), 'Trening')
    if (session.endedAt !== null) {
      throw new RepositoryError('VALIDATION', 'Ten trening został już zakończony.')
    }
    return session
  }

  /** Recover selections from existing sets when resuming a pre-v3 session. */
  async function loadWorkoutState(sessionId: string): Promise<WorkoutState> {
    const existing = await database.workoutStates.get(sessionId)
    if (existing) return existing
    const sets = await getSetEntriesForSession(sessionId)
    const exerciseIds = [...new Set(sets.map((set) => set.exerciseId))]
    const exercises = await database.exercises.bulkGet(exerciseIds)
    const drafts: Record<string, WorkoutDraft> = {}
    for (const exercise of exercises) {
      if (!exercise) continue
      drafts[exercise.id] = defaultDraft(exercise, sets.filter((set) => set.exerciseId === exercise.id).at(-1))
    }
    return {
      sessionId,
      exerciseIds,
      activeExerciseId: sets.at(-1)?.exerciseId ?? null,
      drafts,
      restEndsAt: null,
    }
  }

  async function getWorkoutState(sessionId: string): Promise<WorkoutState | undefined> {
    return database.transaction('r', workoutTables, async () => {
      if (!(await database.workoutSessions.get(sessionId))) return undefined
      return loadWorkoutState(sessionId)
    })
  }

  async function getWorkoutSettings(): Promise<WorkoutSettings> {
    return await database.workoutSettings.get('workouts') ?? { id: 'workouts', restDurationSec: 90 }
  }

  async function updateWorkoutSettings(changes: Pick<WorkoutSettings, 'restDurationSec'>): Promise<WorkoutSettings> {
    if (!Number.isInteger(changes.restDurationSec) || changes.restDurationSec < 0 || changes.restDurationSec > 3600) {
      throw new RepositoryError('VALIDATION', 'Przerwa musi trwać od 0 do 3600 sekund.')
    }
    const settings: WorkoutSettings = { id: 'workouts', restDurationSec: changes.restDurationSec }
    await database.workoutSettings.put(settings)
    return settings
  }

  async function readActiveWorkout(): Promise<ActiveWorkout | undefined> {
    const sessions = await database.workoutSessions.filter((session) => session.endedAt === null).toArray()
    const session = sessions.sort(compareSessions).at(-1)
    if (!session) return undefined
    return { session, state: await loadWorkoutState(session.id), sets: await getSetEntriesForSession(session.id) }
  }

  async function getActiveWorkout(): Promise<ActiveWorkout | undefined> {
    return database.transaction('r', workoutTables, readActiveWorkout)
  }

  async function startWorkout(startedAt: string, date: string): Promise<ActiveWorkout> {
    return database.transaction('rw', workoutTables, async () => {
      const active = await readActiveWorkout()
      if (active) return active
      const session = await createWorkoutSession({ startedAt, date })
      const state = await loadWorkoutState(session.id)
      await database.workoutStates.add(state)
      return { session, state, sets: [] }
    })
  }

  async function latestSetForExercise(sessionId: string, exerciseId: string): Promise<SetEntry | undefined> {
    const current = (await getSetEntriesForSession(sessionId)).filter((set) => set.exerciseId === exerciseId).at(-1)
    if (current) return current
    const history = (await getHistoryForExercise(exerciseId)).filter((entry) => entry.session.id !== sessionId)
    const latestSessionId = history[0]?.session.id
    return history.filter((entry) => entry.session.id === latestSessionId).at(-1)?.set
  }

  async function addWorkoutExercise(sessionId: string, exerciseId: string): Promise<WorkoutState> {
    return database.transaction('rw', workoutTables, async () => {
      await requireOpenWorkout(sessionId)
      const exercise = requireRecord(await database.exercises.get(exerciseId), 'Ćwiczenie')
      const state = await loadWorkoutState(sessionId)
      const draft = state.drafts[exerciseId] ?? defaultDraft(exercise, await latestSetForExercise(sessionId, exerciseId))
      const updated: WorkoutState = {
        ...state,
        exerciseIds: state.exerciseIds.includes(exerciseId) ? state.exerciseIds : [...state.exerciseIds, exerciseId],
        activeExerciseId: exerciseId,
        drafts: { ...state.drafts, [exerciseId]: draft },
      }
      await database.workoutStates.put(updated)
      return updated
    })
  }

  async function selectWorkoutExercise(sessionId: string, exerciseId: string): Promise<WorkoutState> {
    return database.transaction('rw', workoutTables, async () => {
      await requireOpenWorkout(sessionId)
      const state = await loadWorkoutState(sessionId)
      if (!state.exerciseIds.includes(exerciseId)) {
        throw new RepositoryError('VALIDATION', 'Najpierw dodaj ćwiczenie do treningu.')
      }
      const updated = { ...state, activeExerciseId: exerciseId }
      await database.workoutStates.put(updated)
      return updated
    })
  }

  async function updateWorkoutDraft(sessionId: string, exerciseId: string, draft: WorkoutDraft): Promise<WorkoutState> {
    return database.transaction('rw', workoutTables, async () => {
      await requireOpenWorkout(sessionId)
      const exercise = requireRecord(await database.exercises.get(exerciseId), 'Ćwiczenie')
      validateDraft(draft, exercise, false)
      const state = await loadWorkoutState(sessionId)
      if (!state.exerciseIds.includes(exerciseId)) {
        throw new RepositoryError('VALIDATION', 'Najpierw dodaj ćwiczenie do treningu.')
      }
      const updated = { ...state, drafts: { ...state.drafts, [exerciseId]: { ...draft } } }
      await database.workoutStates.put(updated)
      return updated
    })
  }

  async function logWorkoutSet(sessionId: string, exerciseId: string, draft: WorkoutDraft, now = Date.now()): Promise<SetEntry> {
    return database.transaction('rw', workoutTables, async () => {
      await requireOpenWorkout(sessionId)
      const exercise = requireRecord(await database.exercises.get(exerciseId), 'Ćwiczenie')
      validateDraft(draft, exercise, true)
      if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) {
        throw new RepositoryError('VALIDATION', 'Nieprawidłowy czas rozpoczęcia przerwy.')
      }
      const state = await loadWorkoutState(sessionId)
      if (!state.exerciseIds.includes(exerciseId)) {
        throw new RepositoryError('VALIDATION', 'Najpierw dodaj ćwiczenie do treningu.')
      }
      const sets = await getSetEntriesForSession(sessionId)
      const settings = await getWorkoutSettings()
      const entry = await createSetEntry({
        sessionId,
        exerciseId,
        order: (sets.at(-1)?.order ?? -1) + 1,
        ...(exercise.trackingType === 'time' ? { durationSec: draft.durationSec } : { reps: draft.reps }),
        ...(exercise.supportsAddedWeight ? { addedWeightKg: draft.addedWeightKg } : {}),
        ...(draft.variant === undefined ? {} : { variant: draft.variant }),
      })
      await database.workoutStates.put({
        ...state,
        activeExerciseId: exerciseId,
        drafts: { ...state.drafts, [exerciseId]: { ...draft } },
        restEndsAt: settings.restDurationSec > 0 ? now + settings.restDurationSec * 1000 : null,
      })
      return entry
    })
  }

  async function repeatWorkoutSet(sessionId: string, exerciseId: string, now = Date.now()): Promise<SetEntry> {
    return database.transaction('rw', workoutTables, async () => {
      await requireOpenWorkout(sessionId)
      const exercise = requireRecord(await database.exercises.get(exerciseId), 'Ćwiczenie')
      const previous = await latestSetForExercise(sessionId, exerciseId)
      if (!previous) throw new RepositoryError('NOT_FOUND', 'Brak poprzedniej serii tego ćwiczenia.')
      return logWorkoutSet(sessionId, exerciseId, defaultDraft(exercise, previous), now)
    })
  }

  async function finishWorkout(sessionId: string, endedAt: string): Promise<WorkoutSession> {
    return database.transaction('rw', workoutTables, async () => {
      await requireOpenWorkout(sessionId)
      const session = await updateWorkoutSession(sessionId, { endedAt })
      const state = await loadWorkoutState(sessionId)
      await database.workoutStates.put({ ...state, restEndsAt: null })
      return session
    })
  }

  async function stopWorkoutRest(sessionId: string): Promise<WorkoutState> {
    return database.transaction('rw', workoutTables, async () => {
      await requireOpenWorkout(sessionId)
      const state = await loadWorkoutState(sessionId)
      const updated = { ...state, restEndsAt: null }
      await database.workoutStates.put(updated)
      return updated
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
    getWorkoutState,
    getWorkoutSettings,
    updateWorkoutSettings,
    getActiveWorkout,
    startWorkout,
    addWorkoutExercise,
    selectWorkoutExercise,
    updateWorkoutDraft,
    logWorkoutSet,
    repeatWorkoutSet,
    finishWorkout,
    stopWorkoutRest,
  }
}

export const repositories = createRepositories()

export { RepositoryError } from './validation'
