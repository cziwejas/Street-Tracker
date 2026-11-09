import type { ExerciseCatalogue } from '../../db/types'

const catalogues: { id: ExerciseCatalogue; label: string }[] = [
  { id: 'calisthenics', label: 'Kalistenika' },
  { id: 'gym-women', label: 'Siłownia woman' },
  { id: 'gym', label: 'Siłownia' },
]

export function ExerciseCatalogueSelector({ catalogue, disabled, onChange }: {
  catalogue: ExerciseCatalogue; disabled: boolean; onChange: (catalogue: ExerciseCatalogue) => void
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Zestaw ćwiczeń">
      {catalogues.map(({ id, label }) => (
        <button key={id} type="button" className="workout-button catalogue-chip px-2.5 text-sm"
          aria-pressed={id === catalogue} disabled={disabled}
          onClick={() => { if (id !== catalogue) onChange(id) }}>
          {label}
        </button>
      ))}
    </div>
  )
}
