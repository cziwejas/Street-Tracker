import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { repositories } from '../../db/repositories'
import type { ActiveWorkout, Exercise, ExerciseHistoryEntry, SetEntry, WorkoutDraft, WorkoutSettings } from '../../db/types'
import { ExercisePicker } from './ExercisePicker'
import { WorkoutDialog } from './WorkoutDialog'
import { EditSet, RestSettings, SetFields } from './SetFields'
import { useWorkoutActions } from './useWorkoutActions'
import { useWorkoutClock } from './useWorkoutClock'
import { describeSet, draftFromSet, formatClock, previousExerciseSet, remainingRestSeconds } from './workoutHelpers'

type Dialog = 'picker' | 'rest' | 'finish' | { kind: 'edit' | 'delete'; set: SetEntry } | null

export function ActiveSession({ active, exercises, history, settings, actions, onFinished }: {
  active: ActiveWorkout; exercises: Exercise[]; history: Record<string, ExerciseHistoryEntry[]>;
  settings: WorkoutSettings; actions: ReturnType<typeof useWorkoutActions>; onFinished: () => void
}) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [drafts, setDrafts] = useState<Record<string, WorkoutDraft>>({})
  const { session, state, sets } = active
  const now = useWorkoutClock(state.restEndsAt)
  const { busy, perform, save } = actions
  const selected = exercises.find((exercise) => exercise.id === state.activeExerciseId)
  const draft = selected ? drafts[selected.id] ?? state.drafts[selected.id] : undefined
  const previous = selected ? previousExerciseSet(history[selected.id] ?? []) : undefined
  const remaining = remainingRestSeconds(state.restEndsAt, now)
  const elapsed = Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000))
  const sessionExercises = state.exerciseIds.flatMap((id) => {
    const exercise = exercises.find((item) => item.id === id)
    return exercise ? [exercise] : []
  })
  const dialogExercise = typeof dialog === 'object' && dialog !== null
    ? exercises.find((exercise) => exercise.id === dialog.set.exerciseId) : undefined

  function changeDraft(next: WorkoutDraft) {
    if (!selected) return
    setDrafts((current) => ({ ...current, [selected.id]: next }))
    save(() => repositories.updateWorkoutDraft(session.id, selected.id, next))
  }

  function logSet(event: FormEvent) {
    event.preventDefault()
    if (!selected || !draft) return
    void perform(async () => { await repositories.logWorkoutSet(session.id, selected.id, draft) })
  }

  return (
    <>
      <section className="mb-6 flex items-center justify-between gap-3" aria-label="Bieżący trening">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent"><span className="h-2 w-2 rounded-full bg-accent" />Trening trwa</p>
          <p className="text-sm text-muted"><span className="tabular-nums text-white">{formatClock(elapsed)}</span> <span aria-hidden="true">·</span> {sets.length} serii <span aria-hidden="true">·</span> {sessionExercises.length} ćw.</p>
        </div>
        <button type="button" className="workout-button workout-secondary shrink-0" disabled={busy} onClick={() => setDialog('finish')}>Zakończ</button>
      </section>
      {sessionExercises.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2" aria-label="Ćwiczenia w treningu">
          {sessionExercises.map((exercise) => (
            <button type="button" key={exercise.id} disabled={busy} aria-pressed={selected?.id === exercise.id}
              className={`workout-button max-w-60 shrink-0 truncate border text-sm ${selected?.id === exercise.id ? 'border-accent/40 bg-accent/10 text-accent' : 'border-white/10 bg-surface text-muted'}`}
              onClick={() => { void perform(async () => { await repositories.selectWorkoutExercise(session.id, exercise.id) }) }}>{exercise.name}</button>
          ))}
        </div>
      )}
      <section className="workout-card mb-7" aria-label="Dodawanie serii">
        <div className="mb-5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted">{selected ? 'Następna seria' : 'Twój trening'}</p>
            <h2 className="text-xl font-semibold leading-snug">{selected?.name ?? 'Zacznij od ćwiczenia'}</h2>
          </div>
          <button type="button" className="workout-button workout-secondary shrink-0 text-sm" disabled={busy}
            onClick={() => setDialog('picker')} aria-label="Dodaj lub wybierz ćwiczenie">+ Ćwiczenie</button>
        </div>
        {selected && draft ? (
          <form id="workout-log-form" key={selected.id} onSubmit={logSet}>
            {previous && (
              <p className="mb-5 rounded-xl bg-white/5 px-3 py-2 text-xs leading-relaxed text-muted">
                {previous.session.id === session.id ? 'Ostatnia seria' : `Ostatnio · ${new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(new Date(`${previous.session.date}T12:00:00`))}`}
                <span className="ml-2 font-medium text-white">{describeSet(previous.set, selected)}</span>
                {previous.set.variant && <span> · {previous.set.variant}</span>}
              </p>
            )}
            <SetFields exercise={selected} draft={draft} onChange={changeDraft} disabled={busy} prefix="new" />
          </form>
        ) : <p className="text-sm leading-relaxed text-muted">Wybierz ćwiczenie z listy. Wartości z poprzedniego treningu uzupełnią się automatycznie.</p>}
      </section>
      <section aria-labelledby="session-sets-title">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="session-sets-title" className="text-base font-semibold">Serie w tym treningu</h2>
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted">{sets.length}</span>
        </div>
        {sets.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 px-5 py-7 text-center text-sm leading-relaxed text-muted">Jeszcze bez serii. Pierwsza to dobry początek.</p>}
        <div className="space-y-4">
          {sessionExercises.map((exercise) => {
            const exerciseSets = sets.filter((set) => set.exerciseId === exercise.id)
            if (!exerciseSets.length) return null
            return (
              <article className="overflow-hidden rounded-2xl border border-white/10 bg-surface" key={exercise.id}>
                <h3 className="border-b border-white/5 px-4 py-4 text-sm font-semibold">{exercise.name}</h3>
                <ol className="divide-y divide-white/5">
                  {exerciseSets.map((set, index) => (
                    <li key={set.id} className="flex items-center gap-2 py-2 pl-4 pr-2">
                      <span className="w-6 shrink-0 text-xs tabular-nums text-muted">{index + 1}.</span>
                      <div className="min-w-0 flex-1 py-1"><p className="text-sm font-medium tabular-nums">{describeSet(set, exercise)}</p>{set.variant && <p className="mt-0.5 break-words text-xs text-muted">{set.variant}</p>}</div>
                      <button type="button" className="workout-icon-button text-muted" disabled={busy} aria-label={`Edytuj serię ${index + 1}: ${exercise.name}`} onClick={() => setDialog({ kind: 'edit', set })}><Icon name="edit" width={19} height={19} /></button>
                      <button type="button" className="workout-icon-button text-muted hover:text-red-300" disabled={busy} aria-label={`Usuń serię ${index + 1}: ${exercise.name}`} onClick={() => setDialog({ kind: 'delete', set })}><Icon name="trash" width={19} height={19} /></button>
                    </li>
                  ))}
                </ol>
              </article>
            )
          })}
        </div>
      </section>
      <div className="workout-dock safe-inline">
        <div className={`mb-3 flex min-h-12 items-center justify-between gap-2 rounded-xl px-3 ${state.restEndsAt !== null ? 'bg-accent/10' : 'bg-white/5'}`}>
          <div className="flex items-center gap-2">
            <Icon name="timer" width={19} height={19} className="shrink-0 text-accent" />
            <div><p className="text-xs text-muted">{state.restEndsAt === null ? 'Domyślna przerwa' : remaining > 0 ? 'Przerwa' : 'Przerwa zakończona'}</p>
              <p className="text-lg font-semibold tabular-nums leading-tight text-accent" role="timer" aria-label="Czas przerwy">{formatClock(state.restEndsAt === null ? settings.restDurationSec : remaining)}</p>
            </div>
          </div>
          <div className="flex items-center">
            {state.restEndsAt !== null && <button type="button" className="workout-button text-xs text-muted" disabled={busy} onClick={() => { void perform(async () => { await repositories.stopWorkoutRest(session.id) }) }}>{remaining > 0 ? 'Pomiń' : 'Gotowe'}</button>}
            <button type="button" className="workout-icon-button text-muted" aria-label="Ustaw domyślną przerwę" disabled={busy} onClick={() => setDialog('rest')}><Icon name="settings" width={21} height={21} /></button>
          </div>
        </div>
        <p className="sr-only" role="status">{state.restEndsAt !== null && remaining === 0 ? 'Przerwa zakończona. Możesz rozpocząć kolejną serię.' : ''}</p>
        {selected && draft ? <>
          <button type="submit" form="workout-log-form" className="workout-button workout-primary w-full text-base" disabled={busy}>+ Dodaj serię</button>
          <button type="button" className="workout-button mt-1 w-full text-sm text-muted" disabled={busy || !previous} onClick={() => { void perform(async () => {
            const set = await repositories.repeatWorkoutSet(session.id, selected.id)
            setDrafts((current) => ({ ...current, [selected.id]: draftFromSet(set, selected) }))
          }) }}>Powtórz poprzednią serię</button>
        </> : <button type="button" className="workout-button workout-primary w-full" disabled={busy} onClick={() => setDialog('picker')}>+ Dodaj ćwiczenie</button>}
      </div>
      {dialog === 'picker' && <ExercisePicker exercises={exercises} selectedIds={state.exerciseIds} busy={busy} error={actions.error}
        gymMode={settings.gymMode ?? false} onGymModeChange={(gymMode) => { void perform(async () => { await repositories.updateWorkoutSettings({ gymMode }) }) }}
        onClose={() => setDialog(null)} onSelect={(id) => { void perform(async () => { await repositories.addWorkoutExercise(session.id, id); setDialog(null) }) }} />}
      {dialog === 'rest' && <WorkoutDialog title="Przerwa między seriami" busy={busy} error={actions.error} onClose={() => setDialog(null)}><RestSettings settings={settings} busy={busy} onSave={(restDurationSec) => { void perform(async () => { await repositories.updateWorkoutSettings({ restDurationSec }); setDialog(null) }) }} /></WorkoutDialog>}
      {dialog === 'finish' && <WorkoutDialog title="Zakończyć trening?" busy={busy} error={actions.error} onClose={() => setDialog(null)}>
        <p className="mb-5 text-sm leading-relaxed text-muted">Zapisano {sets.length} serii. Trening pozostanie w historii na tym urządzeniu.</p>
        <button type="button" disabled={busy} className="workout-button workout-primary w-full" onClick={() => { void perform(async () => { await repositories.finishWorkout(session.id, new Date().toISOString()); onFinished() }) }}>Zakończ trening</button>
        <button type="button" disabled={busy} className="workout-button mt-2 w-full text-muted" onClick={() => setDialog(null)}>Ćwicz dalej</button>
      </WorkoutDialog>}
      {typeof dialog === 'object' && dialog !== null && dialogExercise && <WorkoutDialog title={dialog.kind === 'edit' ? 'Edytuj serię' : 'Usunąć serię?'} busy={busy} error={actions.error} onClose={() => setDialog(null)}>
        {dialog.kind === 'edit' ? <EditSet key={dialog.set.id} set={dialog.set} exercise={dialogExercise} busy={busy} onSave={(next) => { void perform(async () => {
          await repositories.updateSetEntry(dialog.set.id, {
            reps: dialogExercise.trackingType === 'time' ? undefined : next.reps,
            durationSec: dialogExercise.trackingType === 'time' ? next.durationSec : undefined,
            addedWeightKg: dialogExercise.supportsAddedWeight ? next.addedWeightKg : undefined, variant: next.variant,
          })
          setDialog(null)
        }) }} /> : <>
          <p className="mb-5 text-sm leading-relaxed text-muted">{dialogExercise.name} · {describeSet(dialog.set, dialogExercise)}</p>
          <button type="button" className="workout-button w-full bg-red-400/15 text-red-200" disabled={busy} onClick={() => { void perform(async () => { await repositories.deleteSetEntry(dialog.set.id); setDialog(null) }) }}>Usuń serię</button>
        </>}
      </WorkoutDialog>}
    </>
  )
}
