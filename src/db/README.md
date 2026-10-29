# Local database

All application data stays in IndexedDB. There is no backend or synchronization.

## Model and schema

`types.ts` defines three entities with string IDs:

| Entity / table | Fields | Indexed queries |
| --- | --- | --- |
| `Exercise` / `exercises` | `id`, `name`, `category`, `trackingType`, `supportsAddedWeight`, ordered `variants`, `isCustom` | ID, name, category, tracking type |
| `WorkoutSession` / `workoutSessions` | `id`, `date`, `startedAt`, `endedAt`, optional `bodyweight`, `notes` | ID, local date, start time |
| `SetEntry` / `setEntries` | `id`, `sessionId`, `exerciseId`, optional `variant`, `order`, optional `reps`, `durationSec`, `addedWeightKg`, `repsInReserve`, `note` | ID, session ID, exercise ID, compound session ID + order |

- `date` is an explicit local calendar day (`YYYY-MM-DD`). The caller supplies it; the database does not derive it from UTC timestamps.
- `startedAt` and `endedAt` use ISO 8601 timestamps with a timezone on input and normalize to UTC on write. `endedAt: null` means the session is still open.
- Bodyweight and added weight use kilograms; duration uses seconds. Effort uses **reps in reserve (RIR)**, a nonnegative integer.
- Set `order` is zero-based across the whole session. Equal positions are allowed and resolve by set ID. Variants are label snapshots so edits to exercise progressions do not rewrite history.
- Metrics are optional, allowing draft sets. Names and progression labels must be nonempty; variants must have unique labels. Numeric metrics must be finite and nonnegative; repetitions, order, and RIR must be integers. Bodyweight, when supplied, must be positive.
- `trackingType` is `reps`, `time`, or `reps_weight`. Positive added weight requires `supportsAddedWeight`; the `reps_weight` mode also requires that capability. Timing and repetition fields remain optional without imposing a completed-set workflow.

Version 1 remains the released empty schema. Version 2 creates the three stores and their indexes. New databases seed directly through Dexie's `populate` event; existing version 1 databases seed inside the version 2 upgrade transaction. The 30 built-ins in `seed.ts` have stable `builtin:*` IDs. Reopening version 2 does not reinsert deleted exercises or overwrite modifications. New records created through the repositories receive UUIDs; newly created exercises have `isCustom: true`.

## Repository API

Import `repositories` from `./repositories` for the app, or `createRepositories(database)` for an isolated database. Reads and writes are asynchronous.

| Entity | Operations |
| --- | --- |
| Exercise | `createExercise`, `getExercise`, `listExercises`, `updateExercise`, `deleteExercise` |
| Workout session | `createWorkoutSession`, `getWorkoutSession`, `listWorkoutSessions`, `updateWorkoutSession`, `deleteWorkoutSession` |
| Set entry | `createSetEntry`, `getSetEntry`, `getSetEntriesForSession`, `updateSetEntry`, `deleteSetEntry` |
| Queries | `getHistoryForExercise(exerciseId)`, `getSessionsByDateRange(fromDate, toDate)` |

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

Application writes must use the repositories: IndexedDB has no native foreign keys. Creating or updating a set requires an existing session and exercise, checked in the same transaction as the write. Deleting a session atomically deletes all its sets. Deleting a referenced exercise rejects to preserve history; delete its sets first if removal is intended. Validation and reference errors reject without partial writes. `RepositoryError` exposes `VALIDATION`, `NOT_FOUND`, or `IN_USE` codes with Polish messages. Storage errors from Dexie/IndexedDB propagate unchanged.

## Tests

`npm test` runs against `fake-indexeddb`, with a separate named database per test and cleanup afterward. Tests cover CRUD, optional metrics, references, indexed ordering and date boundaries, timestamp normalization, transaction rollback, first-run seed, reopening, and the version 1 to 2 migration. They run in Node without altering the browser's database.
