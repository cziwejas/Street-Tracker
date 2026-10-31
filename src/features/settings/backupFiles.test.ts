import { describe, expect, it } from 'vitest'
import type { BackupData } from '../../db/types'
import { isBackupOverdue, serializeSetsCsv } from './backupFiles'

const data: BackupData = {
  exercises: [{ id: 'exercise', name: 'Żółw, "trudny"', category: 'pull', trackingType: 'reps_weight', supportsAddedWeight: true, variants: [], isCustom: true }],
  workoutSessions: [{ id: 'session', date: '2026-10-31', startedAt: '2026-10-31T10:00:00Z', endedAt: null, bodyweight: 78.5, notes: 'Dwie\nlinie' }],
  setEntries: [
    { id: 'second', sessionId: 'session', exerciseId: 'exercise', order: 1, durationSec: 15, note: '\t=1+1' },
    { id: 'first', sessionId: 'session', exerciseId: 'exercise', order: 0, reps: 8, addedWeightKg: 0, repsInReserve: 0, note: 'Zażółć, "gęślą"' },
  ],
  workoutStates: [], workoutSettings: [], backupMetadata: [],
}

describe('CSV export', () => {
  it('exports every set in order, with Polish UTF-8 text, quoted commas, quotes, newlines and optional metrics', () => {
    const csv = serializeSetsCsv(data)
    expect(csv.startsWith('\uFEFF"ID serii"')).toBe(true)
    expect(csv).toContain('"Żółw, ""trudny"""')
    expect(csv).toContain('"Dwie\nlinie"')
    expect(csv).toContain('"78.5"')
    expect(csv).toContain('"0","8","","0","0","Zażółć, ""gęślą"""\r\n')
    expect(csv.indexOf('"first"')).toBeLessThan(csv.indexOf('"second"'))
    expect(csv).toContain('"1","","15","","",')
    expect(data.setEntries[0]?.id).toBe('second')
  })

  it('neutralizes spreadsheet formulas in user text', () => {
    expect(serializeSetsCsv(data)).toContain('"\'\t=1+1"')
    for (const note of ['=SUM(A1)', '+1', '-1', '@SUM(A1)', '  =1']) {
      const csv = serializeSetsCsv({ ...data, setEntries: [{ id: 's', sessionId: 'session', exerciseId: 'exercise', order: 0, note }] })
      expect(csv).toContain(`"'${note}"`)
    }
  })

  it('exports a header for an empty dataset', () => {
    const csv = serializeSetsCsv({ ...data, setEntries: [] })
    expect(csv.split('\r\n')).toHaveLength(2)
    expect(csv).toContain('"Zapas powtórzeń (RIR)"')
  })
})

describe('backup reminder', () => {
  const now = new Date('2026-10-31T12:00:00Z').getTime()
  it('reminds before the first backup and strictly after 14 days', () => {
    expect(isBackupOverdue(undefined, now)).toBe(true)
    expect(isBackupOverdue('2026-10-17T11:59:59.999Z', now)).toBe(true)
    expect(isBackupOverdue('2026-10-17T12:00:00Z', now)).toBe(false)
    expect(isBackupOverdue('2026-10-31T11:00:00Z', now)).toBe(false)
  })
})
