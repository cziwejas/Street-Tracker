import type { Exercise, SetEntry, WorkoutDraft, WorkoutSettings } from '../../db/types'
import { useState } from 'react'
import { AddedWeightToggle } from '../../components/AddedWeightToggle'
import { changeAddedWeightMode, isWeightedDraft } from './inputHelpers'
import { NumberStepper } from './NumberStepper'

export function SetFields({ exercise, draft, onChange, disabled, prefix }: {
  exercise: Exercise; draft: WorkoutDraft; onChange: (draft: WorkoutDraft) => void; disabled: boolean; prefix: string
}) {
  const variants = [...new Set([...exercise.variants, ...(draft.variant ? [draft.variant] : [])])]
  const weighted = exercise.supportsAddedWeight && isWeightedDraft(draft)
  return (
    <div className="space-y-4">
      {variants.length > 0 && (
        <label className="block text-sm text-muted" htmlFor={`${prefix}-variant`}>
          Wariant
          <select id={`${prefix}-variant`} className="workout-input mt-2 w-full" disabled={disabled}
            value={draft.variant ?? ''} onChange={(event) => onChange({ ...draft, variant: event.target.value || undefined })}>
            <option value="">Bez wariantu</option>
            {variants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
          </select>
        </label>
      )}
      {exercise.trackingType === 'time' ? (
        <NumberStepper id={`${prefix}-time`} label="Czas" unit="s" value={draft.durationSec} min={1} step={5}
          disabled={disabled} onChange={(durationSec) => onChange({ ...draft, durationSec })} />
      ) : (
        <NumberStepper id={`${prefix}-reps`} label="Powtórzenia" value={draft.reps} min={1} integer
          disabled={disabled} onChange={(reps) => onChange({ ...draft, reps })} />
      )}
      {exercise.supportsAddedWeight && <AddedWeightToggle id={`${prefix}-weighted`} checked={weighted} disabled={disabled}
        onChange={(checked) => onChange(changeAddedWeightMode(draft, checked))} />}
      {weighted && (
        <NumberStepper id={`${prefix}-weight`} label="Dodatkowy ciężar" unit="kg" value={draft.addedWeightKg} step={0.5}
          disabled={disabled} onChange={(addedWeightKg) => onChange({ ...draft, addedWeightKg })} />
      )}
    </div>
  )
}

export function RestSettings({ settings, busy, onSave }: {
  settings: WorkoutSettings; busy: boolean; onSave: (seconds: number) => void
}) {
  const [seconds, setSeconds] = useState(settings.restDurationSec)
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSave(seconds) }} className="space-y-5">
      <NumberStepper id="rest-duration" label="Domyślna przerwa" unit="s" min={0} max={3600} step={15} integer
        value={seconds} onChange={setSeconds} disabled={busy} />
      <p className="text-sm leading-relaxed text-muted">Timer startuje po dodaniu lub powtórzeniu serii. Ustaw 0, aby go wyłączyć. Zmiana obowiązuje od następnej serii.</p>
      <button className="workout-button workout-primary w-full" disabled={busy} type="submit">Zapisz przerwę</button>
    </form>
  )
}

export function EditSet({ set, exercise, busy, onSave }: {
  set: SetEntry; exercise: Exercise; busy: boolean; onSave: (draft: WorkoutDraft) => void
}) {
  const [draft, setDraft] = useState<WorkoutDraft>({
    reps: set.reps ?? 8, durationSec: set.durationSec ?? 30,
    addedWeightKg: set.addedWeightKg ?? 0, variant: set.variant,
  })
  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(draft) }}>
      <p className="text-sm text-muted">{exercise.name}</p>
      <SetFields exercise={exercise} draft={draft} onChange={setDraft} disabled={busy} prefix="edit" />
      <button type="submit" className="workout-button workout-primary w-full" disabled={busy}>Zapisz serię</button>
    </form>
  )
}
