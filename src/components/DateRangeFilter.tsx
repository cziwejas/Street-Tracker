import type { DateRange } from '../lib/dates'

const ranges: { value: DateRange; label: string }[] = [
  { value: '4weeks', label: '4 tygodnie' },
  { value: '3months', label: '3 miesiące' },
  { value: 'all', label: 'Cały okres' },
]

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  return (
    <div role="group" aria-label="Zakres dat" className="mb-6 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-surface p-1">
      {ranges.map((range) => <button key={range.value} type="button" aria-pressed={value === range.value}
        onClick={() => onChange(range.value)}
        className={`workout-button px-1 text-xs sm:text-sm ${value === range.value ? 'bg-accent/10 text-accent' : 'text-muted'}`}>
        {range.label}
      </button>)}
    </div>
  )
}
