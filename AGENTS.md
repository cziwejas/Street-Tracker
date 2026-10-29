# Street Tracker contributor guide

## Project

Street Tracker is a personal, single-user, mobile-first PWA for street workout and calisthenics progress. The primary target is an iPhone. There is no backend: user data belongs in local IndexedDB storage.

The current scope is a skeleton with four Polish placeholder pages: Trening (`/`), Ćwiczenia (`/cwiczenia`), Progres (`/progres`), and Ustawienia (`/ustawienia`). Do not add tracking features or design the full data model unless the task requests them.

## Stack

- Vite, React, TypeScript in strict mode, and React Router
- Tailwind CSS with the Vite plugin
- Dexie.js for IndexedDB; the initial version 1 schema is empty
- `vite-plugin-pwa`, with service worker `autoUpdate`
- Recharts, reserved for future charts
- Vitest for unit tests and ESLint for linting

## Conventions

- Preserve TypeScript strict checking. Prefer explicit types at boundaries and avoid `any` or type assertions that hide errors.
- Keep feature-specific code in `src/features/workouts`, `src/features/exercises`, `src/features/progress`, or `src/features/settings`.
- Put shared UI in `src/components`, general utilities in `src/lib`, database setup in `src/db`, and route-level pages in `src/pages`.
- Write all user-facing text in Polish. Use clear English identifiers for code.
- Keep the UI mobile-first and dark by default. Interactive targets must be at least 44 by 44 CSS pixels, with visible keyboard focus and accessible labels.
- Preserve `viewport-fit=cover` and respect `env(safe-area-inset-*)`, including the bottom tab bar and page content.
- Keep data local. Do not introduce a backend, authentication, analytics, or remote persistence without an explicit requirement.
- Change database versions deliberately when a future task introduces or migrates tables; do not invent a data model during skeleton work.
- Keep dependencies and changes focused on the requested scope. Use small, focused commits when committing is requested; do not commit automatically.
- Add or update meaningful unit tests when behavior warrants them.

## Verification

Before finishing any task, run:

```sh
npm run build
npm test
```

Also run `npm run lint` when code or configuration changes. Report the results and any remaining limitations. For PWA changes, check a production build: service workers are disabled in development, and an iPhone requires a trusted HTTPS origin for service worker testing. Follow the iPhone test steps in `README.md` when device access is available.
