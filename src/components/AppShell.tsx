import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export interface WorkoutLayout {
  dock: HTMLDivElement | null
  openSessionId: string | null
  setOpenSessionId: (id: string | null) => void
}

export function AppShell() {
  const { pathname } = useLocation()
  const isWorkoutHome = pathname === '/'
  const shell = useRef<HTMLDivElement>(null)
  const main = useRef<HTMLElement>(null)
  const footer = useRef<HTMLElement>(null)
  const [dock, setDock] = useState<HTMLDivElement | null>(null)
  const [openSessionId, setOpenSessionId] = useState<string | null>(null)
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => { main.current?.scrollTo(0, 0) }, [pathname, openSessionId])

  useEffect(() => {
    const container = shell.current
    const content = main.current
    const bars = footer.current
    if (!isWorkoutHome || !container || !content || !bars) return

    const measureFooter = () => {
      container.style.setProperty('--workout-footer-height', `${bars.getBoundingClientRect().height}px`)
    }
    measureFooter()
    const observer = new ResizeObserver(measureFooter)
    observer.observe(bars)

    const viewport = window.visualViewport
    let frame = 0
    const fitViewport = () => {
      if (!viewport) return
      // Keep pinch zoom browser-controlled. At normal scale follow the keyboard and Safari's viewport pan.
      const isUnzoomed = Math.abs(viewport.scale - 1) < 0.01
      if (isUnzoomed) {
        container.style.setProperty('--workout-viewport-height', `${viewport.height}px`)
        container.style.setProperty('--workout-viewport-top', `${viewport.offsetTop}px`)
      } else {
        container.style.removeProperty('--workout-viewport-height')
        container.style.removeProperty('--workout-viewport-top')
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const focused = document.activeElement
        if (isUnzoomed && focused?.matches('input, select, textarea') && container.contains(focused)) {
          focused.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }
      })
    }
    fitViewport()
    viewport?.addEventListener('resize', fitViewport)
    viewport?.addEventListener('scroll', fitViewport)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      viewport?.removeEventListener('resize', fitViewport)
      viewport?.removeEventListener('scroll', fitViewport)
      container.style.removeProperty('--workout-footer-height')
      container.style.removeProperty('--workout-viewport-height')
      container.style.removeProperty('--workout-viewport-top')
    }
  }, [isWorkoutHome])

  const workoutLayout: WorkoutLayout = { dock, openSessionId, setOpenSessionId }
  return (
    <div ref={shell} className={`app-shell mx-auto flex max-w-3xl flex-col sm:border-x sm:border-white/5${isWorkoutHome ? ' app-shell-workout' : ''}`}>
      <a
        className="sr-only z-50 min-h-11 rounded-xl bg-accent px-4 py-3 font-semibold text-background focus:not-sr-only focus:fixed focus:left-[max(1.25rem,env(safe-area-inset-left,0px))] focus:top-[calc(1.25rem+env(safe-area-inset-top,0px))]"
        href="#main-content"
      >
        Przejdź do treści
      </a>
      <header className="app-header safe-inline safe-top flex items-center gap-3 border-b border-white/5 pb-5">
        <img src="/favicon.svg" alt="" width="44" height="44" className="rounded-xl" />
        <div>
          <p className="text-base font-bold tracking-tight text-white">Street Tracker</p>
          <p className="mt-0.5 text-xs tracking-wide text-muted">Street workout & kalistenika</p>
        </div>
      </header>
      <main ref={main} id="main-content" tabIndex={-1} className="main-content flex-1 outline-none">
        <Outlet context={workoutLayout} />
      </main>
      {isWorkoutHome ? <footer ref={footer} className="workout-footer">
        <div ref={setDock} />
        <BottomNav compact />
      </footer> : <BottomNav />}
    </div>
  )
}
