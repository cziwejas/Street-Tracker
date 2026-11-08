import { Link } from 'react-router-dom'
import { localWorkoutDate } from '../../lib/dates'
import { HistoryStatus } from './HistoryStatus'
import { useHistoryData } from './useHistoryData'
import { formatClock, formatWorkoutCount } from './workoutHelpers'

const shortDate = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })
const relativeDate = new Intl.RelativeTimeFormat('pl-PL', { numeric: 'auto' })

export function WorkoutHome({ gymMode, busy, onGymModeChange }: {
  gymMode: boolean; busy: boolean; onGymModeChange: (gymMode: boolean) => void
}) {
  const { snapshot, retry } = useHistoryData()
  const sessions = snapshot.status === 'ready' ? snapshot.data.sessions : []
  const today = new Date()
  const todayDate = localWorkoutDate(today)
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (today.getDay() + 6) % 7)
  const weekStart = localWorkoutDate(monday)
  const thisWeek = sessions.filter(({ session }) => session.date >= weekStart && session.date <= todayDate).length
  const last = sessions[0]?.session.date
  const daysSinceLast = last ? (Date.parse(todayDate) - Date.parse(last)) / 86_400_000 : 0

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Katalog ćwiczeń">
        <button type="button" className="workout-button catalogue-chip text-sm" aria-pressed={!gymMode}
          disabled={busy} onClick={() => onGymModeChange(false)}>Street workout</button>
        <button type="button" className="workout-button catalogue-chip text-sm" aria-pressed={gymMode}
          disabled={busy} onClick={() => onGymModeChange(true)}>Siłownia</button>
      </div>
      {last && <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5">
          <dt className="text-xs text-muted">W tym tygodniu</dt>
          <dd className="mt-1 font-semibold text-accent">{formatWorkoutCount(thisWeek, 'workouts')}</dd>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5">
          <dt className="text-xs text-muted">Ostatni trening</dt>
          <dd className="mt-1 font-semibold">{relativeDate.format(-daysSinceLast, 'day')}</dd>
        </div>
      </dl>}
      <section aria-labelledby="recent-workouts">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2">
          <h2 id="recent-workouts" className="text-lg font-semibold tracking-tight">Ostatnie treningi</h2>
          {sessions.length > 0 && <Link className="workout-button -mr-2 px-2 text-sm text-accent" to="/historia?zakres=wszystkie">Zobacz wszystko <span aria-hidden="true" className="ml-1">→</span></Link>}
        </div>
        {snapshot.status !== 'ready' ? <HistoryStatus status={snapshot.status} retry={retry} />
          : sessions.length === 0 ? <p className="mt-2 text-sm text-muted">Tutaj pojawi się Twój pierwszy trening.</p>
          : <ol className="space-y-2">
            {sessions.slice(0, 4).map(({ session, sets }) => {
              const name = snapshot.data.exercises.find((exercise) => exercise.id === sets[0]?.exerciseId)?.name ?? 'Trening'
              const exerciseCount = new Set(sets.map((set) => set.exerciseId)).size
              const duration = session.endedAt ? (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000 : 0
              return <li key={session.id}>
                <Link to={`/historia/${session.id}`} className="history-link flex min-h-16 items-center justify-between gap-2 rounded-xl border border-white/10 bg-surface px-3 py-2.5 hover:border-accent/30">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatWorkoutCount(exerciseCount, 'exercises')} · {formatWorkoutCount(sets.length, 'series')}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <time className="block text-muted first-letter:uppercase" dateTime={session.date}>{shortDate.format(new Date(`${session.date}T12:00:00`))}</time>
                    <span className="mt-0.5 block tabular-nums" aria-label={`Czas treningu ${formatClock(duration)}`}>{formatClock(duration)}</span>
                  </div>
                </Link>
              </li>
            })}
          </ol>}
      </section>
    </>
  )
}
