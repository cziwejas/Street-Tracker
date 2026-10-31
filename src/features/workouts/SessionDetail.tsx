import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { repositories } from '../../db/repositories'
import type { HistorySession, WorkoutHistory, WorkoutSession } from '../../db/types'
import { formatDate } from '../../lib/dates'
import { PrBadge } from '../progress/PrBadge'
import { describeVolume, formatNumber, summarizeVolume, type PersonalRecord } from '../progress/progressHelpers'
import { parseStepperInput } from './inputHelpers'
import { useWorkoutActions } from './useWorkoutActions'
import { describeSet, formatClock } from './workoutHelpers'

function BodyweightForm({ session }: { session: WorkoutSession }) {
  const [value, setValue] = useState(session.bodyweight?.toLocaleString('pl-PL', { useGrouping: false, maximumFractionDigits: 10 }) ?? '')
  const [validation, setValidation] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const actions = useWorkoutActions()

  function submit(event: FormEvent) {
    event.preventDefault()
    const bodyweight = value.trim() ? parseStepperInput(value) : undefined
    if (value.trim() && (bodyweight === undefined || bodyweight <= 0)) {
      setValidation('Wpisz masę ciała większą od zera, np. 78,5 kg.')
      return
    }
    setValidation(null)
    setSaved(false)
    void actions.perform(async () => {
      await repositories.updateWorkoutSession(session.id, { bodyweight })
      setSaved(true)
    })
  }

  return <form className="workout-card mt-6" noValidate onSubmit={submit}>
    <label htmlFor="session-bodyweight" className="mb-2 block text-sm font-semibold">Masa ciała w dniu treningu (kg)</label>
    <p id="bodyweight-help" className="mb-4 text-xs leading-relaxed text-muted">Pomiar trafi na wykres masy ciała i uzupełni szacowaną objętość tej sesji. Puste pole usuwa pomiar.</p>
    <div className="flex flex-wrap gap-2">
      <input id="session-bodyweight" className="workout-input min-w-0 flex-1 basis-32" type="text" inputMode="decimal" value={value}
        placeholder="np. 78,5" disabled={actions.busy} aria-describedby={`bodyweight-help${validation ? ' bodyweight-error' : ''}`} aria-invalid={validation ? true : undefined}
        onChange={(event) => { setValue(event.target.value); setSaved(false); setValidation(null) }} />
      <button type="submit" className="workout-button workout-primary" disabled={actions.busy}>{actions.busy ? 'Zapisywanie…' : 'Zapisz pomiar'}</button>
    </div>
    {validation && <p id="bodyweight-error" role="alert" className="mt-3 text-sm text-red-200">{validation}</p>}
    {actions.error && <p role="alert" className="workout-error mt-3">{actions.error}</p>}
    {saved && <p role="status" className="mt-3 text-xs text-accent">{value.trim() ? 'Pomiar zapisany na urządzeniu.' : 'Pomiar usunięty.'}</p>}
  </form>
}

export function SessionDetail({ entry, exercises, records }: {
  entry: HistorySession
  exercises: WorkoutHistory['exercises']
  records: ReadonlyMap<string, PersonalRecord>
}) {
  const { session, sets } = entry
  const exerciseIds = [...new Set(sets.map((set) => set.exerciseId))]
  const duration = session.endedAt === null ? 0 : Math.max(0, (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000)
  const startTime = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' }).format(new Date(session.startedAt))

  return <>
    <h1 className="mb-2 text-3xl font-bold tracking-tight">Szczegóły treningu</h1>
    <p className="mb-6 text-sm text-muted"><time dateTime={session.date}>{formatDate(session.date)}</time> · {startTime}</p>
    <section aria-label="Podsumowanie treningu" className="workout-card mb-6">
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div><dt className="mb-1 text-xs text-muted">Czas</dt><dd className="font-semibold tabular-nums">{formatClock(duration)}</dd></div>
        <div><dt className="mb-1 text-xs text-muted">Ćwiczenia</dt><dd className="font-semibold">{exerciseIds.length}</dd></div>
        <div><dt className="mb-1 text-xs text-muted">Serie</dt><dd className="font-semibold">{sets.length}</dd></div>
      </dl>
      <div className="mt-5 border-t border-white/5 pt-4"><p className="mb-1 text-xs text-muted">Objętość łącznie</p><p className="text-sm font-medium leading-relaxed">{describeVolume(summarizeVolume(entry, exercises))}</p></div>
      <p className="mt-3 text-xs leading-relaxed text-muted">Szacunek: (masa ciała + dodatkowy ciężar) × powtórzenia. Bez masy ciała pokazujemy liczbę powtórzeń. Czas sumujemy osobno w sekundach.</p>
      {session.bodyweight !== undefined && <p className="mt-3 text-xs text-muted">Masa ciała: <span className="text-white">{formatNumber(session.bodyweight)} kg</span></p>}
    </section>
    {sets.length === 0 && <p className="workout-card text-sm text-muted">Ten trening nie zawiera zapisanych serii.</p>}
    <div className="space-y-4">
      {exerciseIds.map((exerciseId) => {
        const exercise = exercises.find((item) => item.id === exerciseId)
        const exerciseSets = sets.filter((set) => set.exerciseId === exerciseId)
        return <section className="overflow-hidden rounded-2xl border border-white/10 bg-surface" key={exerciseId}>
          <h2 className="border-b border-white/5 px-4 py-4 text-base font-semibold">{exercise?.name ?? 'Nieznane ćwiczenie'}</h2>
          <ol className="divide-y divide-white/5">
            {exerciseSets.map((set, index) => {
              const pr = records.get(set.id)
              return <li className="px-4 py-4" key={set.id}>
                <div className="flex items-start gap-3"><span className="mt-0.5 w-5 shrink-0 text-xs text-muted">{index + 1}.</span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium tabular-nums">{exercise ? describeSet(set, exercise) : 'Brak danych ćwiczenia'}</p>
                    {set.variant && <p className="mt-1 break-words text-xs text-muted">{set.variant}</p>}
                    {set.repsInReserve !== undefined && <p className="mt-1 text-xs text-muted">Zapas: {set.repsInReserve} powt.</p>}
                  </div>{pr && <PrBadge first={pr.previousValue === undefined} />}
                </div>
                {pr && <p className="mt-2 pl-8 text-xs leading-relaxed text-amber-200/80">{pr.previousValue === undefined ? 'Pierwszy wynik w tym wariancie i obciążeniu.' : `Poprzedni rekord: ${formatNumber(pr.previousValue)} ${pr.unit}`}</p>}
                {set.note && <p className="mt-2 whitespace-pre-wrap break-words pl-8 text-xs text-muted">{set.note}</p>}
              </li>
            })}
          </ol>
          {exercise && <Link className="workout-button m-2 text-xs text-accent" to={`/progres?cwiczenie=${encodeURIComponent(exercise.id)}`}>Zobacz progres →</Link>}
        </section>
      })}
    </div>
    {session.notes && <section className="workout-card mt-6"><h2 className="mb-2 text-sm font-semibold">Notatki</h2><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">{session.notes}</p></section>}
    <BodyweightForm key={session.id} session={session} />
    <p className="mt-5 text-xs leading-relaxed text-muted">PR porównuje powtórzenia lub czas w tym samym wariancie i z tym samym dodatkowym ciężarem. Rekord pozostaje oznaczony także po późniejszym pobiciu.</p>
  </>
}
