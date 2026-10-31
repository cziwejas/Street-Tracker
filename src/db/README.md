# Local database

All application data stays in IndexedDB. There is no backend or synchronization.

## Model and schema

`types.ts` defines three domain entities and two workout persistence records:

| Entity / table | Fields | Indexed queries |
| --- | --- | --- |
| `Exercise` / `exercises` | `id`, `name`, `category`, `trackingType`, `supportsAddedWeight`, ordered `variants`, `isCustom` | ID, name, category, tracking type |
| `WorkoutSession` / `workoutSessions` | `id`, `date`, `startedAt`, `endedAt`, optional `bodyweight`, `notes` | ID, local date, start time |
| `SetEntry` / `setEntries` | `id`, `sessionId`, `exerciseId`, optional `variant`, `order`, optional `reps`, `durationSec`, `addedWeightKg`, `repsInReserve`, `note` | ID, session ID, exercise ID, compound session ID + order |
| `WorkoutState` / `workoutStates` | `sessionId`, ordered `exerciseIds`, `activeExerciseId`, per-exercise `drafts`, `restEndsAt` | Session ID |
| `WorkoutSettings` / `workoutSettings` | `id: 'workouts'`, `restDurationSec` | ID |

- `date` is an explicit local calendar day (`YYYY-MM-DD`). The caller supplies it; the database does not derive it from UTC timestamps.
- `startedAt` and `endedAt` use ISO 8601 timestamps with a timezone on input and normalize to UTC on write. `endedAt: null` means the session is still open.
- Bodyweight and added weight use kilograms; duration uses seconds. Effort uses **reps in reserve (RIR)**, a nonnegative integer.
- Set `order` is zero-based across the whole session. Equal positions are allowed and resolve by set ID. Variants are label snapshots so edits to exercise progressions do not rewrite history.
- Metrics are optional, allowing draft sets. Names and progression labels must be nonempty; variants must have unique labels. Numeric metrics must be finite and nonnegative; repetitions, order, and RIR must be integers. Bodyweight, when supplied, must be positive.
- `trackingType` is `reps`, `time`, or `reps_weight`. Positive added weight requires `supportsAddedWeight`; the `reps_weight` mode also requires that capability. Timing and repetition fields remain optional without imposing a completed-set workflow.

Version 1 remains the released empty schema. Version 2 creates the three domain stores and their indexes. Version 3 adds workout state and preferences without rewriting existing records or reseeding. New databases seed directly through Dexie's `populate` event; existing version 1 databases seed inside the version 2 upgrade transaction. The 30 built-ins in `seed.ts` have stable `builtin:*` IDs. Reopening does not reinsert deleted exercises or overwrite modifications. New records created through the repositories receive UUIDs; newly created exercises have `isCustom: true`.

## Repository API

Import `repositories` from `./repositories` for the app, or `createRepositories(database)` for an isolated database. Reads and writes are asynchronous.

| Entity | Operations |
| --- | --- |
| Exercise | `createExercise`, `getExercise`, `listExercises`, `updateExercise`, `deleteExercise` |
| Workout session | `createWorkoutSession`, `getWorkoutSession`, `listWorkoutSessions`, `updateWorkoutSession`, `deleteWorkoutSession` |
| Set entry | `createSetEntry`, `getSetEntry`, `getSetEntriesForSession`, `updateSetEntry`, `deleteSetEntry` |
| Queries | `getHistoryForExercise(exerciseId)`, `getSessionsByDateRange(fromDate, toDate)` |
| Workout workflow | `getActiveWorkout`, `startWorkout`, `addWorkoutExercise`, `selectWorkoutExercise`, `updateWorkoutDraft`, `logWorkoutSet`, `repeatWorkoutSet`, `finishWorkout` |
| Workout state and rest | `getWorkoutState`, `getWorkoutSettings`, `updateWorkoutSettings`, `stopWorkoutRest` |

```ts
import { repositories } from './repositories'

const session = await repositories.createWorkoutSession({
  date: '2026-10-29', // Caller supplies the local workout day.
  startedAt: '2026-10-29T18:00:00+01:00',
  bodyweight: 78.5,
})

await repositories.createSetEntry({
  sessionId: session.id,
  exerciseId: 'builtin:pull-up',
  order: 0,
  reps: 8,
  addedWeightKg: 5,
  repsInReserve: 2,
})

const history = await repositories.getHistoryForExercise('builtin:pull-up')
const sessions = await repositories.getSessionsByDateRange('2026-10-01', '2026-10-31')
```

Create methods return the saved entity; omit its ID. Notes default to an empty string, exercise variants to an empty list, and session end time to `null`. Get methods return the entity or `undefined`. Updates return the saved entity and preserve its ID (and an exercise's `isCustom` flag). Optional fields can be cleared with `undefined`; required fields cannot. Delete methods return `true` if removed, `false` if missing.

`listExercises` uses Polish alphabetical order. Session lists and inclusive date ranges sort by calendar date, start time, then ID ascending. Invalid dates or reversed ranges reject. `getSetEntriesForSession` uses the compound index and returns ascending set order. Exercise history uses the exercise ID index, bulk-loads the related sessions in one read transaction, and returns `{ set, session }[]`. Sessions sort newest first by calendar date and start time; ties use session ID, followed by ascending set order and set ID. Joined dates, bodyweight, and notes reflect the current session.

Application writes must use the repositories: IndexedDB has no native foreign keys. Creating or updating a set requires an existing session and exercise, checked in the same transaction as the write. Deleting a session atomically deletes all its sets and workout state. Deleting an exercise referenced by sets or selected in an open workout rejects. Validation and reference errors reject without partial writes. `RepositoryError` exposes `VALIDATION`, `NOT_FOUND`, or `IN_USE` codes with Polish messages. Storage errors from Dexie/IndexedDB propagate unchanged.

## Active workout contract

- `startWorkout(startedAt, date)` returns `{ session, state, sets }`, resuming the latest open session if one exists. Concurrent calls cannot create duplicate active sessions through this workflow. `getActiveWorkout()` returns the same shape or `undefined`. Reads never write: open sessions from version 2 derive their initial selections and drafts from their sets until the next mutation persists state.
- `addWorkoutExercise(sessionId, exerciseId)` adds and selects an exercise. Its draft uses the last set of that exercise in the current session, otherwise the last set of its newest historical session. Re-selecting an exercise preserves its draft. Without history, defaults are 8 repetitions, 30 seconds, and 0 kg. Historical variant labels are preserved.
- `selectWorkoutExercise(sessionId, exerciseId)` selects an already added exercise. `updateWorkoutDraft(sessionId, exerciseId, draft)` saves next-set values without creating a set. A draft contains numeric `reps`, `durationSec`, `addedWeightKg`, and optional `variant`.
- `logWorkoutSet(sessionId, exerciseId, draft, now = Date.now())` returns a new set. It atomically chooses the next session-wide order, validates and saves the set, updates its draft, and starts rest. Only the exercise's relevant repetition or duration metric is logged; completed sets require a positive value. `repeatWorkoutSet(sessionId, exerciseId, now?)` logs the latest set for that exercise, falling back to history, and rejects when no previous set exists. Editing and deleting logged sets use `updateSetEntry` and `deleteSetEntry` and do not restart rest.
- `getWorkoutSettings()` returns the stored preference or the default `{ id: 'workouts', restDurationSec: 90 }`. `updateWorkoutSettings({ restDurationSec })` accepts integer seconds from 0 to 3600; 0 disables automatic rest. A preference change applies to the next logged set.
- `restEndsAt` is an absolute Unix timestamp in milliseconds, or `null` when inactive. The UI computes the remaining time from the device clock after suspension or reopening. `stopWorkoutRest(sessionId)` clears it. `finishWorkout(sessionId, endedAt)` preserves history, sets the end timestamp, and clears rest atomically. Workflow mutations reject closed sessions.
- State mutations return `WorkoutState`; finishing returns `WorkoutSession`. `getWorkoutState(sessionId)` returns derived or stored state, or `undefined` for a missing session. The generic CRUD APIs retain their existing contracts for history maintenance.

## Tests

`npm test` runs against `fake-indexeddb`, with a separate named database per test and cleanup afterward. Tests cover CRUD, optional metrics, references, indexed ordering and date boundaries, timestamp normalization, transaction rollback, first-run seed, reopening, migrations from versions 1 and 2, workout resume, draft/history prefill, concurrent logging, repeat, rest preferences, and finishing. They run in Node without altering the browser's database.
