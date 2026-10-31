export type DateRange = '4weeks' | '3months' | 'all'

export function localWorkoutDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function rangeStart(range: DateRange, today: Date): string | undefined {
  if (range === 'all') return undefined
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  if (range === '4weeks') {
    start.setDate(start.getDate() - 27)
  } else {
    const day = start.getDate()
    start.setDate(1)
    start.setMonth(start.getMonth() - 3)
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    start.setDate(Math.min(day, lastDay))
  }
  return localWorkoutDate(start)
}

export function isInDateRange(date: string, range: DateRange, today = new Date()): boolean {
  const start = rangeStart(range, today)
  return start === undefined || (date >= start && date <= localWorkoutDate(today))
}

export function formatDate(date: string, short = false): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric', month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }),
  }).format(new Date(`${date}T12:00:00`))
}
