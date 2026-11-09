import { useId, useState } from 'react'
import type { Exercise, ExerciseCatalogue } from '../../db/types'
import { exercisesForCatalogue } from '../exercises/exerciseCatalogue'
import { ExerciseCatalogueSelector } from '../exercises/ExerciseCatalogueSelector'
import { categoryLabels, filterExercises, trackingLabels } from './inputHelpers'
import { WorkoutDialog } from './WorkoutDialog'

interface ExercisePickerProps {
  exercises: Exercise[]
  selectedIds: string[]
  busy: boolean
  catalogue: ExerciseCatalogue
  onCatalogueChange: (catalogue: ExerciseCatalogue) => void
  error?: string | null
  onSelect: (exerciseId: string) => void
  onClose: () => void
}

export function ExercisePicker({ exercises, selectedIds, busy, catalogue, onCatalogueChange, error, onSelect, onClose }: ExercisePickerProps) {
  const [query, setQuery] = useState('')
  const searchId = useId()
  const results = filterExercises(exercisesForCatalogue(exercises, catalogue), query)

  return (
    <WorkoutDialog title="Dodaj ćwiczenie" description="Wybierz ćwiczenie, aby zacząć zapisywać serie." onClose={onClose} busy={busy} error={error}>
      <ExerciseCatalogueSelector catalogue={catalogue} disabled={busy} onChange={onCatalogueChange} />
      <label htmlFor={searchId} className="sr-only">Szukaj ćwiczenia</label>
      <input id={searchId} type="search" autoFocus autoComplete="off" placeholder="Szukaj ćwiczenia…" value={query} onChange={(event) => setQuery(event.currentTarget.value)} className="mb-4 min-h-12 w-full rounded-xl border border-white/15 bg-background px-4 text-base placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
      <p role="status" className="mb-2 text-xs text-muted">Znaleziono: {results.length}</p>
      <ul className="m-0 grid list-none gap-1 p-0">
        {results.map((exercise) => (
          <li key={exercise.id}>
            <button type="button" disabled={busy} onClick={() => onSelect(exercise.id)} className="flex min-h-18 w-full touch-manipulation items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40">
              <span className="min-w-0">
                <span className="block text-base font-medium">{exercise.name}</span>
                <span className="mt-1 block text-xs text-muted">{categoryLabels[exercise.category]} · {trackingLabels[exercise.trackingType]}</span>
              </span>
              {selectedIds.includes(exercise.id) ? <span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">W treningu</span> : <span aria-hidden="true" className="text-2xl text-accent">+</span>}
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="py-8 text-center text-sm text-muted">Brak pasujących ćwiczeń. Spróbuj innej nazwy.</p>}
    </WorkoutDialog>
  )
}
