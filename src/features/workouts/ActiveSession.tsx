import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/Icon'
import { repositories } from '../../db/repositories'
import type { ActiveWorkout, Exercise, ExerciseHistoryEntry, SetEntry, WorkoutDraft, WorkoutSettings } from '../../db/types'
import { ExercisePicker } from './ExercisePicker'
import { WorkoutDialog } from './WorkoutDialog'
import { EditSet, SetFields } from './SetFields'
import type { useWorkoutActions } from './useWorkoutActions'
import { useWorkoutClock } from './useWorkoutClock'
import { describeSet, describeSetValue, draftFromSet, formatClock, formatWorkoutCount, previousExerciseSet, remainingRestSeconds } from './workoutHelpers'

type Dialog = 'picker' | 'finish' | 'discard' | { kind: 'edit' | 'delete'; set: SetEntry } | null

export function ActiveSession({ active, exercises, history, settings, actions, dock, onFinished }: {
  active: ActiveWorkout; exercises: Exercise[]; history: Record<string, ExerciseHistoryEntry[]>;
  settings: WorkoutSettings; actions: ReturnType<typeof useWorkoutActions>; dock: HTMLDivElement | null;
  onFinished: () => void
}) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [drafts, setDrafts] = useState<Record<string, WorkoutDraft>>({})
  const [showAllSets, setShowAllSets] = useState(false)
  const chipStrip = useRef<HTMLDivElement>(null)
  const selectedChip = useRef<HTMLButtonElement>(null)
  const { session, state, sets } = active
  const now = useWorkoutClock(state.restEndsAt)
  const { busy, perform, save } = actions
  const selected = exercises.find((exercise) => exercise.id === state.activeExerciseId)
  const draft = selected ? drafts[selected.id] ?? state.drafts[selected.id] : undefined
  const selectedSets = sets.filter((set) => set.exerciseId === selected?.id)
  const previous = selected ? selectedSets.at(-1) ?? previousExerciseSet(history[selected.id] ?? [])?.set : undefined
  const remaining = remainingRestSeconds(state.restEndsAt, now)
  const elapsed = Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000))
  const sessionExercises = state.exerciseIds.flatMap((id) => {
    const exercise = exercises.find((item) => item.id === id)
    return exercise ? [exercise] : []
  })
  const seriesCount = formatWorkoutCount(sets.length, 'series')
  const exerciseCount = formatWorkoutCount(sessionExercises.length, 'exercises')
  const visibleSetIds = new Set((showAllSets ? sets : sets.slice(-3)).map((set) => set.id))
  const dialogExercise = typeof dialog === 'object' && dialog !== null
    ? exercises.find((exercise) => exercise.id === dialog.set.exerciseId) : undefined

  useEffect(() => {
    const strip = chipStrip.current
    const chip = selectedChip.current
    if (!strip || !chip) return
    const bounds = strip.getBoundingClientRect()
    const selectedBounds = chip.getBoundingClientRect()
    if (selectedBounds.right > bounds.right - 20) strip.scrollLeft += selectedBounds.right - bounds.right + 24
    else if (selectedBounds.left < bounds.left) strip.scrollLeft -= bounds.left - selectedBounds.left + 4
  }, [state.activeExerciseId])

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

  const saveLabel = actions.error ? 'Zmiany nie zostały zapisane' : actions.pending > 0 ? 'Zapisywanie na urządzeniu' : 'Zapisano na urządzeniu'
  return (
    <div className="workout-active">
      <h1 className="sr-only">Aktywny trening</h1>
      <section className="workout-status safe-inline flex items-center justify-between gap-2 border-b border-white/10" aria-label="Bieżący trening">
        <div className="flex shrink-0 items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
          <span className="text-sm font-semibold tabular-nums" role="timer" aria-label="Czas treningu">{formatClock(elapsed)}</span>
        </div>
        <p className="flex min-w-0 items-center justify-center gap-1.5 text-xs whitespace-nowrap text-muted">
          <span aria-hidden="true">{sessionExercises.length} ćw. · {seriesCount}</span>
          <span className="sr-only">{exerciseCount} · {seriesCount}</span>
          <span role="status" title={saveLabel} className={actions.error ? 'text-red-200' : 'text-accent'}>
            <span aria-hidden="true">{actions.error ? '!' : actions.pending > 0 ? '…' : '✓'}</span>
            <span className="sr-only">{saveLabel}</span>
          </span>
        </p>
        <button type="button" className="workout-button workout-secondary shrink-0 px-3 text-sm" disabled={busy} onClick={() => setDialog('finish')}>Zakończ</button>
      </section>

      <div className="safe-inline space-y-3 pb-4 pt-2">
        <div ref={chipStrip} className="exercise-chips -mx-1 flex gap-2 overflow-x-auto py-1 pr-6 pl-1" role="group" aria-label="Ćwiczenia w treningu">
          {sessionExercises.map((exercise) => (
            <button type="button" key={exercise.id} ref={selected?.id === exercise.id ? selectedChip : undefined}
              disabled={busy} aria-pressed={selected?.id === exercise.id}
              className="workout-button catalogue-chip max-w-48 shrink-0 text-sm"
              onClick={() => { void perform(async () => { await repositories.selectWorkoutExercise(session.id, exercise.id) }) }}>
              <span className="truncate">{exercise.name}</span>
            </button>
          ))}
          <button type="button" className="workout-icon-button catalogue-chip shrink-0 text-xl leading-none"
            aria-label="Dodaj lub wybierz ćwiczenie" disabled={busy} onClick={() => setDialog('picker')}>+</button>
        </div>
        {actions.error && <p className="workout-error" role="alert">{actions.error}</p>}
        <section className="workout-card px-3 py-3.5" aria-label="Dodawanie serii">
          {selected && draft ? <>
            <div className="mb-3 flex items-baseline gap-1.5">
              <h2 className="min-w-0 flex-1 wrap-anywhere text-sm leading-snug font-semibold">{selected.name}</h2>
              <span className="shrink-0 text-xs font-semibold text-accent">Seria {selectedSets.length + 1}</span>
              {previous && <p className="max-w-[38%] shrink-0 truncate text-xs text-muted"
                title={`Poprzednio: ${describeSet(previous, selected)}`}>Poprzednio: {describeSetValue(previous, selected)}</p>}
            </div>
            <form id="workout-log-form" key={selected.id} onSubmit={logSet}>
              <SetFields exercise={selected} draft={draft} onChange={changeDraft} disabled={busy} prefix="new" />
            </form>
          </> : <h2 className="text-sm font-semibold">Wybierz pierwsze ćwiczenie</h2>}
        </section>
        <section aria-labelledby="session-sets-title">
          <div className="mb-1 flex min-h-11 flex-wrap items-center justify-between gap-x-2">
            <h2 id="session-sets-title" className="text-sm font-semibold">Wykonane serie</h2>
            {sets.length > 3 && <button type="button" className="workout-button -mr-2 px-2 text-xs text-accent"
              aria-controls="session-sets" aria-expanded={showAllSets} onClick={() => setShowAllSets(!showAllSets)}>
              {showAllSets ? 'Pokaż ostatnie 3' : 'Pokaż wszystkie'}
            </button>}
          </div>
          {sets.length === 0 && <p className="text-xs text-muted">Brak zapisanych serii.</p>}
          <div id="session-sets" className="space-y-2">
            {sessionExercises.map((exercise) => {
              const exerciseSets = sets.filter((set) => set.exerciseId === exercise.id)
              if (!exerciseSets.some((set) => visibleSetIds.has(set.id))) return null
              return (
                <article className="rounded-xl border border-white/10 bg-surface" key={exercise.id}>
                  <h3 className="truncate border-b border-white/10 px-3 py-2 text-xs font-semibold text-muted">{exercise.name}</h3>
                  <ol className="divide-y divide-white/10">
                    {exerciseSets.map((set, index) => visibleSetIds.has(set.id) && (
                      <li key={set.id} className="flex items-center gap-1 pl-3 pr-1">
                        <span className="w-6 shrink-0 text-xs tabular-nums text-muted">{index + 1}.</span>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium tabular-nums">
                          {describeSet(set, exercise)}{set.variant && <span className="text-xs text-muted"> · {set.variant}</span>}
                        </p>
                        <button type="button" className="workout-icon-button shrink-0 text-muted" disabled={busy} aria-label={`Edytuj serię ${index + 1}: ${exercise.name}`} onClick={() => setDialog({ kind: 'edit', set })}><Icon name="edit" width={18} height={18} /></button>
                        <button type="button" className="workout-icon-button shrink-0 text-muted hover:text-red-300" disabled={busy} aria-label={`Usuń serię ${index + 1}: ${exercise.name}`} onClick={() => setDialog({ kind: 'delete', set })}><Icon name="trash" width={18} height={18} /></button>
                      </li>
                    ))}
                  </ol>
                </article>
              )
            })}
          </div>
        </section>
      </div>

      <p className="sr-only" role="status">{state.restEndsAt !== null && remaining === 0 ? 'Przerwa zakończona.' : ''}</p>
      {dock && createPortal(
        <div className="workout-dock safe-inline space-y-2">
          {remaining > 0 && <div className="flex items-center justify-between rounded-full border border-accent/25 bg-accent/10 pl-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Icon name="timer" width={17} height={17} className="text-accent" />
              Przerwa <span role="timer" aria-label="Czas przerwy" className="tabular-nums text-accent">{formatClock(remaining)}</span>
            </p>
            <button type="button" className="workout-button rounded-full text-xs text-accent" disabled={busy}
              onClick={() => { void perform(async () => { await repositories.stopWorkoutRest(session.id) }) }}>Pomiń</button>
          </div>}
          {selected && draft ? <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)] gap-2">
            <button type="button" className="workout-button workout-secondary gap-1 px-2 text-sm" disabled={busy || !previous}
              aria-label="Powtórz poprzednią serię" onClick={() => { void perform(async () => {
                const set = await repositories.repeatWorkoutSet(session.id, selected.id)
                setDrafts((current) => ({ ...current, [selected.id]: draftFromSet(set, selected) }))
              }) }}><span aria-hidden="true" className="text-lg leading-none">↻</span> Powtórz</button>
            <button type="submit" form="workout-log-form" className="workout-button workout-primary px-2 text-sm" disabled={busy}>+ Dodaj serię</button>
          </div> : <button type="button" className="workout-button workout-primary w-full" disabled={busy} onClick={() => setDialog('picker')}>+ Dodaj ćwiczenie</button>}
        </div>, dock)}

      {dialog === 'picker' && <ExercisePicker exercises={exercises} selectedIds={state.exerciseIds} busy={busy} error={actions.error}
        gymMode={settings.gymMode ?? false} onGymModeChange={(gymMode) => { void perform(async () => { await repositories.updateWorkoutSettings({ gymMode }) }) }}
        onClose={() => setDialog(null)} onSelect={(id) => { void perform(async () => { await repositories.addWorkoutExercise(session.id, id); setDialog(null) }) }} />}
      {dialog === 'finish' && <WorkoutDialog title="Zakończyć trening?" busy={busy} error={actions.error} onClose={() => setDialog(null)}>
        <p className="mb-4 text-sm tabular-nums text-muted">{formatClock(elapsed)} · {exerciseCount} · {seriesCount}</p>
        <button type="button" disabled={busy} className="workout-button workout-primary w-full" onClick={() => {
          void perform(async () => {
            await repositories.finishWorkout(session.id, new Date().toISOString())
            onFinished()
          })
        }}>Zapisz i zakończ</button>
        <button type="button" disabled={busy} className="workout-button workout-secondary mt-2 w-full" onClick={() => setDialog(null)}>Wróć</button>
        <button type="button" disabled={busy} className="workout-button mt-3 w-full text-sm text-red-200" onClick={() => setDialog('discard')}>Odrzuć trening</button>
      </WorkoutDialog>}
      {dialog === 'discard' && <WorkoutDialog title="Odrzucić trening?" busy={busy} error={actions.error} onClose={() => setDialog('finish')}>
        <p className="mb-4 text-sm text-muted">Usuniesz ten trening wraz z jego seriami.</p>
        <button type="button" disabled={busy} className="workout-button workout-secondary w-full" onClick={() => setDialog('finish')}>Wróć</button>
        <button type="button" disabled={busy} className="workout-button mt-2 w-full bg-red-400/15 text-red-200" onClick={() => {
          void perform(async () => {
            await repositories.discardWorkout(session.id)
            onFinished()
          })
        }}>Usuń trening</button>
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
          <p className="mb-4 text-sm text-muted">{dialogExercise.name} · {describeSet(dialog.set, dialogExercise)}</p>
          <button type="button" className="workout-button w-full bg-red-400/15 text-red-200" disabled={busy} onClick={() => { void perform(async () => { await repositories.deleteSetEntry(dialog.set.id); setDialog(null) }) }}>Usuń serię</button>
        </>}
      </WorkoutDialog>}
    </div>
  )
}
