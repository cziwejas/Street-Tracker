import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AddedWeightToggle } from '../../components/AddedWeightToggle'
import type { Exercise, WorkoutHistory } from '../../db/types'
import { formatDate, isInDateRange, type DateRange } from '../../lib/dates'
import { MetricChart } from './MetricChart'
import { PrBadge } from './PrBadge'
import { buildExerciseSeries, formatNumber, type PersonalRecord } from './progressHelpers'

export function ExerciseProgress({ exercise, history, range, records }: {
  exercise: Exercise
  history: WorkoutHistory
  range: DateRange
  records: ReadonlyMap<string, PersonalRecord>
}) {
  const exerciseSets = history.sessions.flatMap((entry) => entry.sets.filter((set) => set.exerciseId === exercise.id))
  const variants = [...new Set(exerciseSets.map((set) => set.variant ?? ''))]
  const [selectedVariant, setVariant] = useState(variants[0] ?? '')
  const variant = variants.includes(selectedVariant) ? selectedVariant : variants[0] ?? ''
  const availableWeights = [...new Set(exerciseSets.filter((set) => (set.variant ?? '') === variant).map((set) => set.addedWeightKg ?? 0))].sort((a, b) => a - b)
  const [weightedChoice, setWeighted] = useState<boolean | null>(null)
  const weighted = weightedChoice ?? (availableWeights.length > 0 && !availableWeights.includes(0))
  const weights = availableWeights.filter((weight) => weighted ? weight > 0 : weight === 0)
  const [selectedWeight, setWeight] = useState<number | null>(null)
  const addedWeightKg = selectedWeight !== null && weights.includes(selectedWeight) ? selectedWeight : weights[0]
  const series = addedWeightKg === undefined ? [] : buildExerciseSeries(history, exercise, { variant, addedWeightKg }, records)
  const visibleSeries = series.filter((point) => isInDateRange(point.date, range))
  const scopedRecords = [...records.values()].filter((record) => record.exerciseId === exercise.id && record.variant === variant && record.addedWeightKg === addedWeightKg)
  const currentRecord = scopedRecords.at(-1)
  const timed = exercise.trackingType === 'time'
  const missingWeights = !timed && visibleSeries.some((point) => point.volume === null)

  return <section aria-labelledby="exercise-progress-title" className="min-w-0">
    <h2 id="exercise-progress-title" className="sr-only">Postępy: {exercise.name}</h2>
    {exerciseSets.length > 0 && <div className="mb-5 space-y-3">
      <div><label htmlFor="progress-variant" className="mb-2 block text-xs font-medium text-muted">Wariant</label>
        <select id="progress-variant" className="workout-input w-full" value={variant} onChange={(event) => { setVariant(event.target.value); setWeight(null); setWeighted(null) }}>
          {variants.map((value) => <option key={value} value={value}>{value || 'Bez wariantu'}</option>)}
        </select></div>
      {exercise.supportsAddedWeight && <AddedWeightToggle id="progress-weighted" checked={weighted}
        onChange={(checked) => { setWeighted(checked); setWeight(null) }} />}
      {exercise.supportsAddedWeight && weighted && <div><label htmlFor="progress-load" className="mb-2 block text-xs font-medium text-muted">Dodatkowy ciężar</label>
        <select id="progress-load" className="workout-input w-full" value={addedWeightKg ?? ''} disabled={weights.length === 0} onChange={(event) => setWeight(Number(event.target.value))}>
          {weights.length === 0 && <option value="">Brak wyników z obciążeniem</option>}
          {weights.map((value) => <option key={value} value={value}>+{formatNumber(value)} kg</option>)}
        </select></div>}
    </div>}
    {currentRecord && <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
      <div className="mb-2 flex items-center gap-2"><PrBadge /><p className="text-xs text-amber-200">Rekord osobisty · cały okres</p></div>
      <p className="text-2xl font-semibold tabular-nums">{formatNumber(currentRecord.value)} <span className="text-sm font-normal text-muted">{currentRecord.unit}</span></p>
      <Link to={`/historia/${currentRecord.sessionId}`} className="workout-button -mb-2 -ml-3 text-xs text-muted">{formatDate(currentRecord.date)} · zobacz trening →</Link>
    </div>}
    {visibleSeries.length === 0 ? <div className="workout-card py-8 text-center"><h3 className="mb-2 font-semibold">{series.length ? 'Brak wyników w tym okresie' : exerciseSets.length ? 'Brak wyników dla tego wariantu' : 'Jeszcze bez wyników'}</h3>
      <p className="text-sm leading-relaxed text-muted">{series.length ? 'Wybierz dłuższy zakres dat lub inny wariant i ciężar.' : 'Zapisz serię w wybranym wariancie i zakończ trening. Tutaj zobaczysz swoje postępy.'}</p></div>
      : <div className="space-y-5">
        <MetricChart title={timed ? 'Najlepszy czas utrzymania' : 'Najlepsza seria'} unit={timed ? 's' : 'powt.'}
          description={timed ? 'Najdłuższe utrzymanie w każdej sesji, dla wybranego wariantu i ciężaru.' : 'Najwięcej powtórzeń w jednej serii każdej sesji, dla wybranego wariantu i ciężaru.'}
          data={visibleSeries.map((point) => ({ ...point, value: point.best }))} emptyText="Brak zapisanych wyników w tym okresie." />
        <MetricChart title={timed ? 'Łączny czas w sesji' : 'Szacowana objętość w sesji'} unit={timed ? 's' : 'kg·powt.'} color="#85baff"
          description={timed ? 'Suma czasu wszystkich serii wybranego wariantu i ciężaru.' : 'Suma (masa ciała + dodatkowy ciężar) × powtórzenia dla wybranego wariantu i ciężaru. To przybliżenie, bez korekty na mechanikę ćwiczenia.'}
          data={visibleSeries.map((point) => ({ sessionId: point.sessionId, date: point.date, value: point.volume }))}
          emptyText="Uzupełnij masę ciała w szczegółach treningów, aby zobaczyć szacowaną objętość." />
        {missingWeights && <div><p className="text-xs leading-relaxed text-muted">Część sesji nie ma masy ciała. Uzupełnij ją w historii, aby obliczyć objętość. Brak pomiaru pozostaje luką na wykresie.</p><Link className="workout-button mt-1 -ml-3 text-xs text-accent" to="/historia">Uzupełnij masę ciała →</Link></div>}
      </div>}
    <p className="mt-5 text-xs leading-relaxed text-muted">PR to ściśle lepszy wynik dla tego samego wariantu i dodatkowego ciężaru. Pierwszy dodatni wynik ustanawia rekord; wyrównanie go nie pobija. Rekordy uwzględniają całą historię, także poza wybranym okresem.</p>
  </section>
}
