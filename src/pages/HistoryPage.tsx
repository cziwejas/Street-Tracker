import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { describeVolume, findPersonalRecords, summarizeVolume, type PersonalRecord } from '../features/progress/progressHelpers'
import { PrBadge } from '../features/progress/PrBadge'
import { DeleteWorkoutButton } from '../features/workouts/DeleteWorkoutButton'
import { HistoryStatus } from '../features/workouts/HistoryStatus'
import { useHistoryData } from '../features/workouts/useHistoryData'
import { formatWorkoutCount } from '../features/workouts/workoutHelpers'
import { formatDate, isInDateRange, type DateRange } from '../lib/dates'

export function HistoryPage() {
  const { snapshot, retry } = useHistoryData()
  const [params] = useSearchParams()
  const [range, setRange] = useState<DateRange>(params.get('zakres') === 'wszystkie' ? 'all' : '4weeks')
  const records = useMemo(() => snapshot.status === 'ready' ? findPersonalRecords(snapshot.data) : new Map<string, PersonalRecord>(), [snapshot])
  const sessions = snapshot.status === 'ready' ? snapshot.data.sessions.filter(({ session }) => isInDateRange(session.date, range)) : []

  return (
    <div>
      <Link to="/" className="workout-button mb-4 -ml-3 text-sm text-muted">← Trening</Link>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Historia</h1>
      <p className="mb-6 text-sm leading-relaxed text-muted">Twoje zakończone treningi. Każda seria ma znaczenie.</p>
      <DateRangeFilter value={range} onChange={setRange} />
      {snapshot.status !== 'ready' ? <HistoryStatus status={snapshot.status} retry={retry} /> : <>
        <p className="mb-4 text-xs text-muted">Liczba treningów: <span className="font-semibold text-white">{sessions.length}</span></p>
        {sessions.length === 0 && <div className="workout-card py-8 text-center"><h2 className="mb-2 font-semibold">{snapshot.data.sessions.length ? 'Brak treningów w tym okresie' : 'Tutaj zacznie się Twoja historia'}</h2>
          <p className="text-sm leading-relaxed text-muted">{snapshot.data.sessions.length ? 'Wybierz dłuższy zakres dat, aby zobaczyć starsze sesje.' : 'Zakończ pierwszy trening, a zobaczysz jego ćwiczenia, serie i rekordy.'}</p>
          <Link to="/" className="workout-button workout-secondary mt-5">Przejdź do treningu</Link></div>}
        <ol className="space-y-3">
          {sessions.map((entry) => {
            const exerciseIds = [...new Set(entry.sets.map((set) => set.exerciseId))]
            const names = exerciseIds.map((id) => snapshot.data.exercises.find((exercise) => exercise.id === id)?.name ?? 'Nieznane ćwiczenie')
            const prCount = entry.sets.filter((set) => records.has(set.id)).length
            return <li key={entry.session.id}><Link to={`/historia/${entry.session.id}`} className="history-link workout-card block transition-colors hover:border-accent/30">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold"><time dateTime={entry.session.date}>{formatDate(entry.session.date)}</time></h2><span aria-hidden="true" className="text-muted">↗</span></div>
              <p className="break-words text-sm leading-relaxed text-muted">{names.join(' · ') || 'Bez ćwiczeń'}</p>
              <p className="mt-3 text-xs leading-relaxed"><span className="text-muted">Objętość łącznie: </span>{describeVolume(summarizeVolume(entry, snapshot.data.exercises))}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted"><span>{formatWorkoutCount(exerciseIds.length, 'exercises')} · {formatWorkoutCount(entry.sets.length, 'series')}</span>{prCount > 0 && <><PrBadge /><span>Rekordy: {prCount}</span></>}</div>
            </Link><div className="mt-1 flex justify-end"><DeleteWorkoutButton session={entry.session} /></div></li>
          })}
        </ol>
        <p className="mt-6 text-xs leading-relaxed text-muted">PR oznacza poprawę liczby powtórzeń lub czasu dla tego samego wariantu i dodatkowego ciężaru. Pierwszy wynik ustanawia rekord. Oznaczenia odnoszą się do dnia treningu.</p>
      </>}
    </div>
  )
}
