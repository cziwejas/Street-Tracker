import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { ExerciseProgress } from '../features/progress/ExerciseProgress'
import { MetricChart } from '../features/progress/MetricChart'
import { findPersonalRecords, type PersonalRecord } from '../features/progress/progressHelpers'
import { HistoryStatus } from '../features/workouts/HistoryStatus'
import { useHistoryData } from '../features/workouts/useHistoryData'
import { isInDateRange, type DateRange } from '../lib/dates'

export function ProgressPage() {
  const { snapshot, retry } = useHistoryData()
  const [range, setRange] = useState<DateRange>('4weeks')
  const [searchParams, setSearchParams] = useSearchParams()
  const records = useMemo(() => snapshot.status === 'ready' ? findPersonalRecords(snapshot.data) : new Map<string, PersonalRecord>(), [snapshot])
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const performedIds = new Set(data?.sessions.flatMap((entry) => entry.sets.map((set) => set.exerciseId)))
  const requestedId = searchParams.get('cwiczenie')
  const exercise = data?.exercises.find((item) => item.id === requestedId)
    ?? data?.exercises.find((item) => performedIds.has(item.id)) ?? data?.exercises[0]
  const bodyweightPoints = data ? [...data.sessions].reverse().flatMap(({ session }) =>
    session.bodyweight !== undefined && isInDateRange(session.date, range)
      ? [{ sessionId: session.id, date: session.date, value: session.bodyweight }] : []) : []

  return <div className="min-w-0 space-y-6">
    <div><div className="flex items-center justify-between gap-3"><h1 className="text-3xl font-bold tracking-tight">Progres</h1><Link to="/historia" className="workout-button text-xs text-accent">Historia →</Link></div>
      <p className="mt-2 text-sm leading-relaxed text-muted">Zobacz, jak rośnie Twoja forma.</p></div>
    <DateRangeFilter value={range} onChange={setRange} />
    {snapshot.status !== 'ready' ? <HistoryStatus status={snapshot.status} retry={retry} /> : <>
      <div><label htmlFor="progress-exercise" className="mb-2 block text-sm font-semibold">Wybierz ćwiczenie</label>
        <select id="progress-exercise" className="workout-input w-full" value={exercise?.id ?? ''} disabled={!data?.exercises.length}
          onChange={(event) => setSearchParams({ cwiczenie: event.target.value }, { replace: true })}>
          {!data?.exercises.length && <option value="">Brak ćwiczeń</option>}
          {data?.exercises.map((item) => <option key={item.id} value={item.id}>{item.name}{performedIds.has(item.id) ? '' : ' · brak wyników'}</option>)}
        </select></div>
      {exercise && data ? <ExerciseProgress key={exercise.id} exercise={exercise} history={data} range={range} records={records} />
        : <p className="workout-card text-sm leading-relaxed text-muted">Brak ćwiczeń do wyświetlenia. Po zapisaniu treningu pojawią się tutaj Twoje wyniki.</p>}
      <div className="border-t border-white/10 pt-6"><h2 className="mb-4 text-lg font-semibold">Masa ciała</h2>
        <MetricChart title="Zmiana masy ciała" description="Pomiary z zakończonych treningów w wybranym okresie. Kilka sesji tego samego dnia to osobne punkty." unit="kg" color="#b6a1ff"
          data={bodyweightPoints} emptyText="Brak pomiarów masy ciała w tym okresie. Dodaj pomiar w szczegółach treningu lub wybierz dłuższy zakres dat." />
        <Link to="/historia" className="workout-button mt-3 text-xs text-accent">Dodaj lub popraw pomiar w historii →</Link>
      </div>
    </>}
  </div>
}
