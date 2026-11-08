import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exercise, WorkoutHistory } from '../db/types'
import { useHistoryData } from '../features/workouts/useHistoryData'
import { HistoryPage } from './HistoryPage'
import { ProgressPage } from './ProgressPage'
import { SessionDetailPage } from './SessionDetailPage'

vi.mock('../features/workouts/useHistoryData', () => ({ useHistoryData: vi.fn() }))

const exercise: Exercise = { id: 'pull', name: 'Podciąganie', category: 'pull', trackingType: 'reps_weight', supportsAddedWeight: true, variants: [], isCustom: false }
const history: WorkoutHistory = {
  exercises: [exercise],
  sessions: [
    {
      session: { id: 'recent', date: '2026-10-31', startedAt: '2026-10-31T10:00:00Z', endedAt: '2026-10-31T11:00:00Z', notes: '', bodyweight: 70 },
      sets: [{ id: 'lower', sessionId: 'recent', exerciseId: exercise.id, reps: 10, order: 0, note: '' }],
    },
    {
      session: { id: 'old', date: '2026-01-01', startedAt: '2026-01-01T10:00:00Z', endedAt: '2026-01-01T11:00:00Z', notes: '' },
      sets: [{ id: 'record', sessionId: 'old', exerciseId: exercise.id, reps: 20, order: 0, note: '' }],
    },
  ],
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 31, 12))
  vi.mocked(useHistoryData).mockReturnValue({ snapshot: { status: 'ready', data: history }, retry: vi.fn() })
})

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('history and progress pages', () => {
  it('lists dates, exercises and estimated total volume, excluding old sessions without resetting PRs', () => {
    const html = renderToStaticMarkup(<MemoryRouter><HistoryPage /></MemoryRouter>)
    expect(html).toContain('href="/historia/recent"')
    expect(html).not.toContain('href="/historia/old"')
    expect(html).toMatch(/<time datetime="2026-10-31"/i)
    expect(html).toContain('Podciąganie')
    expect(html).toContain('700 kg·powt.')
    expect(html).not.toContain('Rekordy:')
    expect(html).toContain('aria-label="Usuń trening z 31 października 2026"')
    for (const [link] of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)) {
      expect(link).not.toContain('<button')
    }
  })

  it('renders bodyweight independently of whether the selected exercise has results', () => {
    const other: Exercise = { ...exercise, id: 'other', name: 'Inne ćwiczenie' }
    vi.mocked(useHistoryData).mockReturnValue({ snapshot: { status: 'ready', data: { ...history, exercises: [...history.exercises, other] } }, retry: vi.fn() })
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/progres?cwiczenie=other']}><ProgressPage /></MemoryRouter>)
    expect(html).toContain('Jeszcze bez wyników')
    expect(html).toContain('Zmiana masy ciała')
    expect(html).toContain('Wynik (kg)')
    expect(html).toContain('href="/historia/recent"')
    expect(html).not.toContain('href="/historia/old"')
  })

  it('shows a Polish empty history and missing bodyweight state', () => {
    vi.mocked(useHistoryData).mockReturnValue({ snapshot: { status: 'ready', data: { exercises: [exercise], sessions: [] } }, retry: vi.fn() })
    const historyHtml = renderToStaticMarkup(<MemoryRouter><HistoryPage /></MemoryRouter>)
    expect(historyHtml).toContain('Tutaj zacznie się Twoja historia')
    expect(historyHtml).toContain('Zakończ pierwszy trening')
    const progressHtml = renderToStaticMarkup(<MemoryRouter><ProgressPage /></MemoryRouter>)
    expect(progressHtml).toContain('Brak pomiarów masy ciała w tym okresie')
    expect(progressHtml).toContain('Jeszcze bez wyników')
  })

  it('renders a retriable Polish storage error', () => {
    vi.mocked(useHistoryData).mockReturnValue({ snapshot: { status: 'error' }, retry: vi.fn() })
    const html = renderToStaticMarkup(<MemoryRouter><ProgressPage /></MemoryRouter>)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Nie udało się odczytać historii z pamięci urządzenia.')
    expect(html).toContain('Spróbuj ponownie')
  })

  it('handles a nonexistent session URL without an empty or broken page', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/historia/missing']}><Routes><Route path="/historia/:sessionId" element={<SessionDetailPage />} /></Routes></MemoryRouter>)
    expect(html).toContain('Nie znaleziono treningu')
    expect(html).toContain('href="/historia"')
    expect(html).not.toContain('Usuń trening')
  })

  it('offers deletion for an existing completed session in its details', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/historia/recent']}><Routes><Route path="/historia/:sessionId" element={<SessionDetailPage />} /></Routes></MemoryRouter>)
    expect(html).toContain('aria-label="Usuń trening z 31 października 2026"')
    expect(html).not.toContain('<dialog')
  })
})
