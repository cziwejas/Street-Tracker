import { describe, expect, it } from 'vitest'
import { isInDateRange, rangeStart } from './dates'

describe('local calendar date ranges', () => {
  const today = new Date(2026, 9, 31, 23, 59)

  it('includes exactly the last 28 calendar days and today, excluding future dates', () => {
    expect(rangeStart('4weeks', today)).toBe('2026-10-04')
    expect(isInDateRange('2026-10-03', '4weeks', today)).toBe(false)
    expect(isInDateRange('2026-10-04', '4weeks', today)).toBe(true)
    expect(isInDateRange('2026-10-31', '4weeks', today)).toBe(true)
    expect(isInDateRange('2026-11-01', '4weeks', today)).toBe(false)
  })

  it('subtracts three calendar months and clamps to the target month, including leap years', () => {
    expect(rangeStart('3months', today)).toBe('2026-07-31')
    expect(rangeStart('3months', new Date(2026, 4, 31))).toBe('2026-02-28')
    expect(rangeStart('3months', new Date(2024, 4, 31))).toBe('2024-02-29')
    expect(rangeStart('3months', new Date(2026, 0, 15))).toBe('2025-10-15')
    expect(isInDateRange('2026-07-30', '3months', today)).toBe(false)
    expect(isInDateRange('2026-07-31', '3months', today)).toBe(true)
  })

  it('keeps all dates for the all-time view', () => {
    expect(rangeStart('all', today)).toBeUndefined()
    expect(isInDateRange('2000-01-01', 'all', today)).toBe(true)
  })
})
