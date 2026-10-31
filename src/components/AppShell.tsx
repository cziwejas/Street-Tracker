import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppShell() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="app-shell mx-auto flex min-h-dvh max-w-3xl flex-col sm:border-x sm:border-white/5">
      <a
        className="sr-only z-50 min-h-11 rounded-xl bg-accent px-4 py-3 font-semibold text-background focus:not-sr-only focus:fixed focus:left-5 focus:top-5"
        href="#main-content"
      >
        Przejdź do treści
      </a>
      <header className="safe-inline safe-top flex items-center gap-3 border-b border-white/5 pb-5">
        <img src="/favicon.svg" alt="" width="44" height="44" className="rounded-xl" />
        <div>
          <p className="text-base font-bold tracking-tight text-white">Street Tracker</p>
          <p className="mt-0.5 text-xs tracking-wide text-muted">Street workout & kalistenika</p>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="safe-inline main-content flex-1 pt-10 outline-none sm:pt-14">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
