# Local database

All application data stays in IndexedDB. There is no backend or synchronization.

## Model and schema

`types.ts` defines three domain entities, two workout persistence records and backup metadata:

| Entity / table | Fields | Indexed queries |
| --- | --- | --- |
| `Exercise` / `exercises` | `id`, `name`, `category`, `trackingType`, `supportsAddedWeight`, ordered `variants`, `isCustom` | ID, name, category, tracking type |
| `WorkoutSession` / `workoutSessions` | `id`, `date`, `startedAt`, `endedAt`, optional `bodyweight`, `notes` | ID, local date, start time |
| `SetEntry` / `setEntries` | `id`, `sessionId`, `exerciseId`, optional `variant`, `order`, optional `reps`, `durationSec`, `addedWeightKg`, `repsInReserve`, `note` | ID, session ID, exercise ID, compound session ID + order |
| `WorkoutState` / `workoutStates` | `sessionId`, ordered `exerciseIds`, `activeExerciseId`, per-exercise `drafts`, `restEndsAt` | Session ID |
| `WorkoutSettings` / `workoutSettings` | `id: 'workouts'`, `restDurationSec`, optional `gymMode` | ID |
| `BackupMetadata` / `backupMetadata` | `id: 'backup'`, `lastExportedAt` | ID |

- `date` is an explicit local calendar day (`YYYY-MM-DD`). The caller supplies it; the database does not derive it from UTC timestamps.
- `startedAt` and `endedAt` use ISO 8601 timestamps with a timezone on input and normalize to UTC on write. `endedAt: null` means the session is still open.
- Bodyweight and added weight use kilograms; duration uses seconds. Effort uses **reps in reserve (RIR)**, a nonnegative integer.
- Set `order` is zero-based across the whole session. Equal positions are allowed and resolve by set ID. Variants are label snapshots so edits to exercise progressions do not rewrite history.
- Metrics are optional, allowing draft sets. Names and progression labels must be nonempty; variants must have unique labels. Numeric metrics must be finite and nonnegative; repetitions, order, and RIR must be integers. Bodyweight, when supplied, must be positive.
- `trackingType` is `reps`, `time`, or `reps_weight`. Positive added weight requires `supportsAddedWeight`; the `reps_weight` mode also requires that capability. Timing and repetition fields remain optional without imposing a completed-set workflow.

Version 1 remains the released empty schema. Version 2 creates the three domain stores and their indexes. Version 3 adds workout state and preferences without rewriting existing records or reseeding. Version 4 adds backup metadata with no reseeding or record rewrites. Version 5 adds the 10 gym exercises from `gymSeed.ts` once, preserving existing IDs, edits, history and deleted original exercises. New databases seed both catalogues directly through Dexie's `populate` event; existing version 1 databases seed the original catalogue inside the version 2 upgrade transaction and the gym catalogue in version 5. The 30 original built-ins in `seed.ts` and 10 gym exercises have stable `builtin:*` IDs. Reopening does not reinsert deleted exercises or overwrite modifications. New records created through the repositories receive UUIDs; newly created exercises have `isCustom: true`.

## Repository API

Import `repositories` from `./repositories` for the app, or `createRepositories(database)` for an isolated database. Reads and writes are asynchronous.

| Entity | Operations |
| --- | --- |
| Exercise | `createExercise`, `getExercise`, `listExercises`, `updateExercise`, `deleteExercise` |
| Workout session | `createWorkoutSession`, `getWorkoutSession`, `listWorkoutSessions`, `updateWorkoutSession`, `deleteWorkoutSession` |
| Set entry | `createSetEntry`, `getSetEntry`, `getSetEntriesForSession`, `updateSetEntry`, `deleteSetEntry` |
| Queries | `getHistoryForExercise(exerciseId)`, `getSessionsByDateRange(fromDate, toDate)`, `getWorkoutHistory()` |
| Workout workflow | `getActiveWorkout`, `startWorkout`, `addWorkoutExercise`, `selectWorkoutExercise`, `updateWorkoutDraft`, `logWorkoutSet`, `repeatWorkoutSet`, `finishWorkout` |
| Workout state and rest | `getWorkoutState`, `getWorkoutSettings`, `updateWorkoutSettings`, `stopWorkoutRest` |
| Backup | `exportData`, `importData`, `getBackupMetadata`, `recordBackupExport` |

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

`getWorkoutHistory()` returns `{ exercises, sessions: [{ session, sets }] }` in one read transaction. It includes only completed sessions (`endedAt !== null`), sorted by calendar date, start time, and ID descending; empty completed sessions are retained. Sets sort by `order`, then ID ascending. The exercise catalogue uses the usual Polish name order. History and progress subscribe with Dexie's `liveQuery`, so finishing a workout and editing its bodyweight update the views. Bodyweight remains the existing optional session field and is written with `updateWorkoutSession`; no schema migration is needed.

PRs and chart metrics are derived in `src/features/progress/progressHelpers.ts`, never persisted. Records compare positive repetitions or duration within the same exercise, variant label, and additional load (missing load equals zero), in session/set order across the complete finished history. First results count as PRs; ties do not. Date filters are applied after PR derivation. Repetition volume requires that session's bodyweight and estimates `(bodyweight + addedWeightKg) × reps`; missing bodyweight produces a null chart value rather than zero or a borrowed measurement. Timed volume is the sum of seconds, independent of bodyweight. Mixed session totals retain separate units.

## Active workout contract

- `startWorkout(startedAt, date)` returns `{ session, state, sets }`, resuming the latest open session if one exists. Concurrent calls cannot create duplicate active sessions through this workflow. `getActiveWorkout()` returns the same shape or `undefined`. Reads never write: open sessions from version 2 derive their initial selections and drafts from their sets until the next mutation persists state.
- `addWorkoutExercise(sessionId, exerciseId)` adds and selects an exercise. Its draft uses the last set of that exercise in the current session, otherwise the last set of its newest historical session. Re-selecting an exercise preserves its draft. Without history, defaults are 8 repetitions, 30 seconds, and 0 kg. Historical variant labels are preserved.
- `selectWorkoutExercise(sessionId, exerciseId)` selects an already added exercise. `updateWorkoutDraft(sessionId, exerciseId, draft)` saves next-set values without creating a set. A draft contains numeric `reps`, `durationSec`, `addedWeightKg`, optional `variant`, and optional `withAddedWeight`. The latter persists an explicitly selected weighted mode even before kilograms are entered. Older drafts infer the selection from positive added weight. The UI clears the load when deselecting the weighted mode; repositories reject an explicitly disabled mode paired with a positive load. This optional nested field needs no schema migration and does not change historical variant labels.
- `logWorkoutSet(sessionId, exerciseId, draft, now = Date.now())` returns a new set. It atomically chooses the next session-wide order, validates and saves the set, updates its draft, and starts rest. Only the exercise's relevant repetition or duration metric is logged; completed sets require a positive value. `repeatWorkoutSet(sessionId, exerciseId, now?)` logs the latest set for that exercise, falling back to history, and rejects when no previous set exists. Editing and deleting logged sets use `updateSetEntry` and `deleteSetEntry` and do not restart rest.
- `getWorkoutSettings()` returns the stored preference or the default `{ id: 'workouts', restDurationSec: 90 }`. `updateWorkoutSettings({ restDurationSec?, gymMode? })` updates only supplied fields in a transaction. Rest accepts integer seconds from 0 to 3600; 0 disables automatic rest. A rest change applies to the next logged set. Optional `gymMode` defaults to false in the UI and survives JSON backups. It filters only the exercise picker: false uses the original catalogue plus custom exercises; true uses gym exercises, shared squats/Bulgarian split squats/lunges/calf raises and custom leg exercises. Selected exercises, sets, history and progress remain available regardless of mode. The mode checkbox is available before and during a workout, including in the picker.
- `restEndsAt` is an absolute Unix timestamp in milliseconds, or `null` when inactive. The UI computes the remaining time from the device clock after suspension or reopening. `stopWorkoutRest(sessionId)` clears it. `finishWorkout(sessionId, endedAt)` preserves history, sets the end timestamp, and clears rest atomically. Workflow mutations reject closed sessions.
- State mutations return `WorkoutState`; finishing returns `WorkoutSession`. `getWorkoutState(sessionId)` returns derived or stored state, or `undefined` for a missing session. The generic CRUD APIs retain their existing contracts for history maintenance.

## Backup contract

- `exportData()` reads all six stores in one read transaction, including unfinished sessions, next-set drafts and explicitly stored preferences. It does not change the last-export date. Default preferences are derived when no record exists and are not materialized by export.
- `serializeBackup` / `parseBackupJson` in `features/settings/backupFiles.ts` use `{ format: 'street-tracker', version: 1, exportedAt, data }`. The independent file-format version is not the Dexie schema version. Every store is a required array; IDs are preserved and must be unique within a store. Unknown format versions reject. The parser checks runtime types, domain constraints, dates, singleton setting IDs, draft selections and foreign keys. A finished workout may retain a draft for an unused exercise subsequently deleted through the repository; active workout selections require existing exercises.
- `importData(data, 'merge' | 'replace')` validates again at the write boundary. Merge adds missing IDs and keeps the complete local record on collisions, including preferences, drafts and backup metadata. The resulting merged graph is also validated against retained local parents. Replace clears all six stores and restores only file records, including an empty catalogue. Both modes commit in one transaction; validation, quota or other storage failures leave the original data intact. The result reports imported and skipped record counts. Repeating a merge is idempotent.
- The JSON download contains its own export timestamp in `backupMetadata`. After initiating the download, the UI calls `recordBackupExport(exportedAt)` to record that same timestamp locally. The browser cannot confirm that the file was retained. Import restores/preserves the recorded timestamp rather than setting it to the import time. CSV export does not update it. The reminder triggers when no JSON export is recorded or strictly more than 14 × 24 hours have elapsed, and refreshes after resuming the app.
- CSV contains one row per set, including unfinished workouts, joined session/exercise fields and every set metric. It uses comma separators, CRLF rows, quoted cells, escaped quotes and a UTF-8 BOM. Missing metrics are blank; zero is retained. User text starting with spreadsheet formula characters is prefixed with an apostrophe. CSV is not an import format.

## Tests

`npm test` runs against `fake-indexeddb`, with a separate named database per test and cleanup afterward. Tests cover CRUD, optional metrics, references, indexed ordering and date boundaries, timestamp normalization, transaction rollback, first-run seed, reopening, migrations from versions 1–4, gym catalogue filtering and persistent mode selection, workout resume, draft/history prefill, concurrent logging, repeat, rest preferences, finishing, full JSON round trips, merge collisions/idempotence, empty replacement, invalid imports, storage-failure rollback, CSV escaping and reminder boundaries. Persistence API tests cover grant, denial, unsupported browsers and errors. They run in Node without altering the browser's database. `tests/pwa/exercise-modes.spec.ts` checks mobile picker switching, search, weighted set logging, reload persistence and preservation of mixed-mode workout data against the production build.
