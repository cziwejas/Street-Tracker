# Street Tracker

A mobile-first PWA with a local data layer for a single user's street workout and calisthenics progress. The interface is in Polish, uses a dark theme, and is designed primarily for an iPhone.

**Trening** supports starting and resuming a workout, searching for exercises, logging sets, and finishing the session. Large number steppers handle repetitions, time, and added weight; the last performed set supplies initial values, and **Powtórz poprzednią serię** logs it again. Current sets are grouped by exercise and can be edited or deleted. A rest timer starts after every added or repeated set, with a configurable default of 90 seconds (0 disables it).

The active session, selected exercises, next-set drafts, rest deadline, and rest preference are stored locally in Dexie. Returning to the app restores the workout; the rest countdown accounts for time spent outside the app. **Historia treningów**, accessible from Trening and Progres, lists completed sessions with dates, exercises, volume and historical PR badges. Each session opens a detail view with all sets, variants, notes and a bodyweight measurement form.

**Progres** uses Recharts for the best set (repetitions or longest hold), per-session volume, and bodyweight. Choose an exercise, variant and added load; the date filter applies to all charts and offers 4 weeks, 3 calendar months, or all history. Charts include expandable tables linking to the source sessions. **Ćwiczenia** remains a placeholder page.

**Ustawienia** exports a complete JSON backup, validates and imports backups with merge or replace, exports all sets to CSV, and requests persistent browser storage. A reminder appears before the first JSON backup and when the last export is more than 14 days old.

## Stack

- Vite, React, and TypeScript with strict checking
- React Router for navigation
- Tailwind CSS via `@tailwindcss/vite`
- Dexie.js for IndexedDB
- `vite-plugin-pwa` for the manifest, generated service worker, and offline app shell
- Recharts, loaded separately when a progress chart has data
- Vitest with fake-indexeddb, and ESLint

## Run locally

Install Node.js 22.19+ (22.x) or Node.js 24+ and npm (the Lighthouse tool requires at least 22.19), then run:

```sh
npm install
npm run dev
```

Open the URL printed by Vite. To make the development server reachable on your local network:

```sh
npm run dev -- --host 0.0.0.0
```

Use your computer's LAN IP address and the port printed by Vite on your phone, for example `http://192.168.1.100:5173`. The phone and computer must be on the same network, and the computer's firewall must allow access to the server.

## Build and checks

```sh
npm run build
npm test
npm run lint
```

`build` checks TypeScript and generates the production app in `dist/`. `test` runs UI smoke tests, workout input/timer/history helper tests, backup round trips and validation, CSV/persistence tests, and isolated IndexedDB workflow/repository/migration tests once. To serve the production build locally:

```sh
npm run preview -- --host 0.0.0.0
```

Vite preview is a local testing server. Use the port printed in its output.

## Test the PWA on an iPhone

1. Run `npm run build`, then `npm run preview -- --host 0.0.0.0`. Test the production build because the service worker is disabled during development.
2. Serve the preview URL through HTTPS, using either a local HTTPS reverse proxy with a certificate trusted by the iPhone or an HTTPS tunnel. Configure that tool separately; `vite preview` does not enable HTTPS by itself. Keep a stable URL when testing stored data and updates.
3. Open the HTTPS URL in Safari on the iPhone while online. HTTP over a LAN IP is sufficient to inspect the UI, but service workers require a secure context. The `localhost` exception refers to the device running the browser, so your computer's LAN IP does not receive that exception. See [MDN's service worker requirements](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).
4. In Safari, use **Share → Add to Home Screen**. Leave **Open as Web App** enabled if that option is shown, then tap **Add**. The exact placement of Share depends on the Safari layout. See [Apple's Home Screen web app instructions](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).
5. Launch **Street Tracker** from the Home Screen while online and wait for **Aplikacja gotowa do pracy offline**. This confirms the initial precache finished, including the chart module; merely seeing the first screen is not enough. Check the notch, status bar and home indicator in portrait and landscape. Text inputs, search, selects and file selection use at least 16px text; focusing them should not zoom the page, while pinch zoom remains available. Check dialogs and the fixed workout actions with the keyboard open.
6. Enable Airplane Mode with Wi-Fi also off, close and reopen the Home Screen app, and verify that all tabs, history, session details, and progress charts still load, including pages not previously visited. Repeat the workout and history checks below while offline.
7. Go online, deploy a new production build to the same HTTPS origin, and return to the app. **Dostępna jest nowa wersja** must offer **Aktualizuj** and **Później**, without reloading automatically. Defer it, confirm that the workout is usable, then leave and return to see the prompt again. Wait for **Zapisano na urządzeniu**, close any open forms and accept. Check that the updated app resumes the saved workout. Also try accepting after disconnecting, once the new version has finished downloading.

## Offline, updates and assets

The production service worker precaches HTML, CSS, all JavaScript chunks (including lazy charts), the manifest, icons and launch images. Navigation falls back to the cached app shell so direct history/progress URLs work offline. Workout data stays in IndexedDB; service worker cache cleanup never deletes that database. Registration failures show a Polish message; offline readiness is only announced after the initial worker installs. Offline use requires one completed online installation in the browser or Home Screen app being used.

Updates use `registerType: 'prompt'`. The browser checks during registration; the app also checks on focus, foreground visibility, reconnection and hourly while visible. An installed update waits for consent. **Później** keeps the current page, and the prompt returns on the next foreground check. **Aktualizuj** activates the downloaded worker and reloads controlled windows, including other open tabs. Saved data survives; an unfinished form or in-flight write should be completed before accepting. Updates during the very first visit also reload correctly: native `controllerchange` handles the case where Workbox still considers the session an initial install. Browsers can also activate a waiting worker naturally after all old windows close. When upgrading from the earlier `autoUpdate` build, close all old app windows once to allow the first prompt-enabled version to take control; that old bundle has no prompt UI.

`public/favicon.svg` is the source for opaque 192/512px app icons, separate maskable 192/512px icons with the mark inside the central safe circle, the 180px Apple touch icon and a 32px PNG favicon. iPhone launch PNGs cover 13 viewport/pixel-ratio combinations in both orientations (26 images), selected by exact media queries in `index.html`. Regenerate the PNGs and startup links after changing the mark:

```sh
npm run pwa:assets
```

The launch images use only the vector mark, so their appearance does not depend on system fonts. The header, navigation, dialogs, update notice and keyboard skip link respect safe-area insets. In viewports up to 500px high, workout actions scroll with the content so the fixed panel cannot obscure the form; portrait phone views keep the fixed action panel.

## Automated PWA audit

Install the Playwright Chromium browser once, then run the production browser checks:

```sh
npx playwright install chromium
npm run test:pwa
```

The command builds the app and starts a loopback-only production fixture on port 4174. Its simulated second release changes HTML and the corresponding service worker precache revision without editing source files. Tests use disposable storage and verify cold offline startup after visiting only `/`, previously unvisited routes/charts, workout writes/resume, history deep links, deferring/accepting an update offline, saved-data survival, Chrome installability in a regular profile, icon dimensions/opacity/maskable safe zones, launch images, 16px controls, touch targets and portrait/landscape layout. On Windows, an installed Chrome can be used instead of downloading Chromium: set `$env:PLAYWRIGHT_CHANNEL = 'chrome'` in PowerShell before the command. Screenshots and failure traces go to ignored `test-results/`.

For Lighthouse, serve a production build in one terminal and audit that URL in another (Chrome must be installed; `CHROME_PATH` can select its executable):

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4175 --strictPort
# In another terminal:
npm run audit:lighthouse -- http://127.0.0.1:4175
```

HTML and JSON reports are written to ignored `reports/lighthouse/mobile.html` and `mobile.json`. [Lighthouse removed its PWA category in version 12](https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0); current Lighthouse results cover performance, accessibility, best practices and SEO. Offline behavior, the manifest/service worker and update activation are checked separately by the browser tests above.

Audit on **2026-11-01**, Windows, Chrome 156, Lighthouse 13.6.0, production `/`, mobile emulation with Lighthouse's default simulated throttling:

| Check | Result |
| --- | --- |
| Lighthouse performance / accessibility / best practices / SEO | **99 / 100 / 100 / 100** |
| FCP / LCP / total blocking time / CLS | 0.8 s / 2.3 s / 0 ms / 0 |
| Production PWA browser scenarios | **3 passed** |
| Chrome installability errors in a regular profile | **None** |
| Physical iPhone / installed iOS app | **Not tested: no device available** |

Scores describe a local clean profile, not deployed-host performance or an iPhone certification. Remaining Lighthouse performance opportunities include unused JavaScript in the shared app bundle and the CSS render dependency; lazy charts are precached for offline use but only executed when needed.

## Remaining iOS limitations

- **Installation and first use:** use Safari's Share → Add to Home Screen flow; the app has no native install dialog on iOS. A trusted HTTPS origin and a complete first online cache installation are required. Check Safari and the Home Screen app independently; local data is not synchronized between installations, profiles, origins or devices.
- **Storage:** iOS can remove local website data under storage pressure, and clearing website data removes workouts and the offline cache. Persistent-storage permission is browser-controlled, with full Storage API support from Safari 17. Keep exported JSON backups. See [WebKit's storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).
- **Background execution:** iOS can suspend the app, timers and update checks. The rest timer catches up from its stored deadline on return, and update checks resume in the foreground; downloading updates or running timers continuously while the app is closed is not guaranteed.
- **Status bar, splash and icons:** `black-translucent` is paired with the dark background and safe-area padding, as described by [Apple's status bar documentation](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html). Status bar appearance and launch snapshots remain OS-controlled. Startup PNGs cover the listed iPhone dimensions, not every Display Zoom mode, future screen size or iPad; unmatched modes use iOS's own launch behavior. iOS may cache an old icon or snapshot after an update. See [Apple's launch-image documentation](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).
- **Device verification remains:** Chromium phone emulation cannot validate a real notch/home indicator, Safari keyboard resizing/focus zoom, Home Screen installation, status bar colors or actual splash selection. Run the iPhone checklist above on a trusted HTTPS deployment, including landscape, keyboard-open dialogs, offline relaunch and a second deployment. None of those physical-device checks is claimed as passed by this audit.

## Workout checks

Use the same browser and origin throughout these checks. Repeat them in Safari and the installed Home Screen app when an iPhone is available.

1. Open **Trening**, tap **Rozpocznij trening**, and add an exercise using the searchable list. Check a search without Polish accents, such as `podciaganie`.
2. Adjust repetitions with both the number field and +/− buttons. For an exercise supporting weight, check **Wariant z obciążeniem** to reveal the additional-weight field. Unchecking must hide the field and clear the weight; checking it at 0 kg must survive reloading the active workout. Older sets with positive weight should open with the option checked, including in the edit dialog. Add a set, then use **Powtórz poprzednią serię**. Add a timed exercise and log a duration. Check that sets are grouped under the correct exercises and that the rest timer restarts after each addition.
3. Change next-set values without adding a set, switch exercises, and return. Reload or close and reopen the app. Check that the session, selected exercise, saved sets, and next-set values remain available. Wait for **Zapisano na urządzeniu** before closing when checking a completed save.
4. Set a different default rest duration. Log a set, leave the app for part of the rest, and reopen it. Check that the countdown reflects elapsed real time, including when the rest expired in the background. Try **Pomiń** and a default of 0. A changed default applies to the next added set.
5. Edit a set and delete another. Reload to verify both changes. Check that the repeat shortcut uses the latest remaining set of the selected exercise.
6. Finish the session and start a new one. Add the same exercise and check that values come from its last set in the previous session. Finish the new session and check that reopening does not resume a finished workout.
7. On a phone, check the number keyboard, one-handed reach of the fixed add/repeat actions, scrolling through a longer session, modal search and editing, and clearance around the notch, home indicator, and tab bar. With a keyboard, check visible focus, modal focus containment, and Escape to close.

## History and progress checks

1. Finish several sessions containing repeated and timed exercises. Open **Historia treningów** from Trening and check newest-first ordering, exercise names, set counts, total volume, and PR badges. Open a session and verify all sets, variants, additional weight, RIR, and notes.
2. In session details, save a bodyweight such as `78,5`. Return to Progres and check its bodyweight point and estimated repetition volume. Edit the value, reload, and verify persistence. Clear the field and save to remove the measurement; repetition volume should become unavailable for that session, while hold duration remains available. A zero or invalid weight must show a Polish validation message.
3. Choose an exercise and variant in Progres. Without **Wariant z obciążeniem**, show bodyweight sets and hide the additional-load filter. Check that option to reveal positive loads and weighted results. Check best repetitions or hold duration, total volume/duration per session, gold PR points, and the all-time record link. Equal or lower values must not create new PRs. Different variants and additional loads have independent records; the first positive result establishes a PR.
4. Switch between **4 tygodnie**, **3 miesiące**, and **Cały okres** in history and Progres. All charts, including bodyweight, must follow the chosen period. A historical PR outside the visible period must still prevent a lower visible result from being marked as a new PR. Several sessions on one day must remain separate points.
5. Check an exercise with no results, an empty date range, a session without sets, and sessions without bodyweight. Check the expandable chart data tables, their links, keyboard focus, 44-pixel touch targets, long exercise/variant names, and safe-area clearance on an iPhone.

Repetition volume is an estimate: sum `(session bodyweight + set added weight) × repetitions`. It uses full bodyweight for every repetition exercise, without a biomechanical correction. Missing bodyweight is never filled from another session or treated as zero: history shows those repetitions separately and the volume chart leaves a gap. Timed sets use seconds, summed separately. PRs compare the primary metric (repetitions or seconds) for the same exercise, variant label, and additional load, across the full completed history. Bodyweight changes do not create PRs. PRs are derived, so editing historical data recalculates them.

## Backup and storage checks

Use a disposable browser profile or origin when checking replacement. Keep an independent JSON backup of any data you want to retain.

1. In **Ustawienia**, export JSON with finished and unfinished sessions, weighted and timed sets, custom exercises, variants, notes, next-set drafts and a nondefault rest duration. Verify the downloaded file is saved; a browser download request cannot prove that the user retained the file. Reload and check the last-export date.
2. Import that file on a fresh test origin, choose **Zastąp wszystkie dane**, read and check the confirmation, then import. Check history, progress, workout resume and rest preferences after reloading. An empty backup must clear all records, including the default catalogue, without reseeding on reopen.
3. Import with **Scal z danymi na urządzeniu**. Existing IDs keep their complete local record; missing IDs are added. Import twice and verify no duplicate sets or sessions. Local settings and drafts win collisions. A merge that would invalidate references or set metrics must fail with no changes.
4. Try a malformed JSON file, an unsupported version, a duplicate ID, a negative metric, and a set with a missing parent. Verify Polish errors and unchanged data. Cancel a valid file preview and verify no import occurred.
5. Export CSV and open it as UTF-8, comma-delimited text in a spreadsheet. Check one row per set, including active workouts, Polish text, commas, quotes, multiline notes, zero values, blank optional measurements, kilograms and seconds. CSV is for analysis; JSON is the restore format.
6. Check the reminder with no previous export, a last export exactly 14 days ago, and one older than 14 days. Only the older date is overdue. JSON export updates the timestamp; import restores the date in the backup, and CSV leaves it alone.
7. On a trusted HTTPS origin, check the initial persistence status, then **Włącz trwałe przechowywanie**. Verify granted, denied and unavailable/error states where the browser permits. Permission is browser-controlled; a denial must leave export and import usable. The API requires a secure context; see [MDN: StorageManager.persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).
8. On an iPhone, check JSON/CSV saving in Files, file selection, merge and replacement confirmation, long file names, keyboard focus, 44-pixel touch targets, and tab-bar/home-indicator clearance. Repeat while offline in the installed PWA.

## Project layout

```text
public/                 PWA/maskable/Apple touch icons and iPhone launch images
scripts/                Reproducible PWA assets and Lighthouse audit
tests/pwa/              Production offline/update/installability browser checks
src/
  components/           Shared UI, including the app shell and tab bar
  db/                   Types, Dexie schema, seed, repositories, and database tests
  features/
    workouts/           Workout logging, exercise picker, rest timer, and persistence hooks
    exercises/          Future exercise feature
    progress/           Progress calculations, PRs, Recharts, and chart data tables
    settings/           JSON backups/import, CSV export, storage status and reminder
  lib/                  Shared utilities
  pages/                Trening, history, session details, Progres, Ustawienia, and Ćwiczenia placeholder
```

## Local data

There is no backend, account system, or sync. `src/db/db.ts` defines schema version 4: exercises, workout sessions, and set entries from version 2, workout state and workout preferences from version 3, and backup metadata from version 4. All released schema declarations and migration paths are preserved. The app opens the database on startup and seeds 30 Polish exercises on first creation or upgrade from version 1. Later upgrades and reopening an existing database preserve user edits, deletions, and workout history.

Workout repository operations append a set and update its draft and rest deadline in one transaction. Starting a workout resumes an existing open session, and finishing it preserves its sets and clears its rest timer. Drafts also persist exercises that have been selected before their first set is logged.

Use `src/db/repositories.ts` for CRUD and indexed history/date queries. The model, API, sorting, validation, and deletion rules are documented in [src/db/README.md](src/db/README.md).

User data lives in IndexedDB on the current device and browser, scoped to the app's origin (scheme, hostname, and port). A different origin has separate storage. Clearing website data or browser storage can remove local data, and storage may be evicted by the browser. Persistent storage can protect against automatic eviction, but local storage is not a backup: retain the JSON files exported through Ustawienia separately. No data is uploaded during export or import.
