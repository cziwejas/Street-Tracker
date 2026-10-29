# Street Tracker

A mobile-first PWA skeleton for a single user's street workout and calisthenics progress. The interface is in Polish, uses a dark theme, and is designed primarily for an iPhone.

The current app contains four placeholder pages: **Trening**, **Ćwiczenia**, **Progres**, and **Ustawienia**. Workout tracking, exercise management, charts, and settings are intentionally not implemented yet.

## Stack

- Vite, React, and TypeScript with strict checking
- React Router for navigation
- Tailwind CSS via `@tailwindcss/vite`
- Dexie.js for IndexedDB
- `vite-plugin-pwa` for the manifest, generated service worker, and offline app shell
- Recharts, installed for future progress charts
- Vitest and ESLint

## Run locally

Install Node.js 22.13+ (22.x) or Node.js 24+ and npm (Node.js 24 LTS was used for development), then run:

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

`build` checks TypeScript and generates the production app in `dist/`. `test` runs the Vitest smoke test once. To serve the production build locally:

```sh
npm run preview -- --host 0.0.0.0
```

Vite preview is a local testing server. Use the port printed in its output.

## Test the PWA on an iPhone

1. Run `npm run build`, then `npm run preview -- --host 0.0.0.0`. Test the production build because the service worker is disabled during development.
2. Serve the preview URL through HTTPS, using either a local HTTPS reverse proxy with a certificate trusted by the iPhone or an HTTPS tunnel. Configure that tool separately; `vite preview` does not enable HTTPS by itself. Keep a stable URL when testing stored data and updates.
3. Open the HTTPS URL in Safari on the iPhone while online. HTTP over a LAN IP is sufficient to inspect the UI, but service workers require a secure context. The `localhost` exception refers to the device running the browser, so your computer's LAN IP does not receive that exception. See [MDN's service worker requirements](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).
4. In Safari, use **Share → Add to Home Screen**. Leave **Open as Web App** enabled if that option is shown, then tap **Add**. The exact placement of Share depends on the Safari layout. See [Apple's Home Screen web app instructions](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).
5. Launch **Street Tracker** from the Home Screen while online and let it finish loading so the service worker can install and cache the app shell. Navigate through all four tabs, checking the notch and home indicator areas.
6. Enable Airplane Mode with Wi-Fi also off, close and reopen the Home Screen app, and verify that the shell and four placeholder pages still load. Go online again to receive service worker updates. Updates are configured with `autoUpdate`.

## Project layout

```text
public/                 Placeholder PWA and Apple touch icons
src/
  components/           Shared UI, including the app shell and tab bar
  db/                   Typed Dexie instance and versioned schema
  features/
    workouts/           Future workout feature
    exercises/          Future exercise feature
    progress/           Future progress feature
    settings/           Future settings feature
  lib/                  Shared utilities
  pages/                Route-level placeholder pages
```

## Local data

There is no backend, account system, or sync. `src/db/db.ts` defines a typed Dexie database with an empty version 1 schema; tables and the full data model will be designed later.

Future user data will live in IndexedDB on the current device and browser, scoped to the app's origin (scheme, hostname, and port). A different origin has separate storage. Clearing website data or browser storage can remove local data, and storage may be evicted by the browser. Local storage is not a backup; export and recovery are not part of this skeleton.
