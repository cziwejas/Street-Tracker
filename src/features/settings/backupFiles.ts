import { requireObject, validateBackupData } from '../../db/backupValidation'
import type { BackupData } from '../../db/types'
import { normalizeTimestamp, RepositoryError } from '../../db/validation'

export interface BackupFile {
  format: 'street-tracker'
  version: 1
  exportedAt: string
  data: BackupData
}

export function serializeBackup(data: BackupData, exportedAt = new Date().toISOString()): string {
  const backup: BackupFile = { format: 'street-tracker', version: 1, exportedAt: normalizeTimestamp(exportedAt), data }
  return JSON.stringify(backup, null, 2)
}

export function parseBackupJson(json: string): BackupFile {
  let value: unknown
  try {
    value = JSON.parse(json.replace(/^\uFEFF/, ''))
  } catch {
    throw new RepositoryError('VALIDATION', 'Nie udało się odczytać JSON. Wybierz poprawny plik kopii Street Tracker.')
  }
  const backup = requireObject(value)
  if (backup.format !== 'street-tracker' || backup.version !== 1) {
    throw new RepositoryError('VALIDATION', 'Nieobsługiwany format lub wersja kopii Street Tracker.')
  }
  if (typeof backup.exportedAt !== 'string') throw new RepositoryError('VALIDATION', 'Brak daty utworzenia kopii.')
  return { format: 'street-tracker', version: 1, exportedAt: normalizeTimestamp(backup.exportedAt), data: validateBackupData(backup.data) }
}

function csvCell(value: string | number | null | undefined): string {
  let cell = value === null || value === undefined ? '' : String(value)
  // Spreadsheet applications must not execute imported exercise names or notes as formulas.
  if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/.test(cell)) cell = `'${cell}`
  return `"${cell.replaceAll('"', '""')}"`
}

/** One row per set, including unfinished sessions; UTF-8 BOM preserves Polish text in spreadsheets. */
export function serializeSetsCsv(data: BackupData): string {
  const exercises = new Map(data.exercises.map((row) => [row.id, row]))
  const sessions = new Map(data.workoutSessions.map((row) => [row.id, row]))
  const rows: (string | number | null | undefined)[][] = [[
    'ID serii', 'ID treningu', 'Data treningu', 'Rozpoczęcie', 'Zakończenie', 'Masa ciała (kg)', 'Notatki treningu',
    'ID ćwiczenia', 'Ćwiczenie', 'Kategoria', 'Sposób pomiaru', 'Wariant', 'Kolejność (od 0)',
    'Powtórzenia', 'Czas (s)', 'Dodatkowy ciężar (kg)', 'Zapas powtórzeń (RIR)', 'Notatka serii',
  ]]
  const categories = { push: 'Pchanie', pull: 'Przyciąganie', legs: 'Nogi', core: 'Korpus', skills: 'Umiejętności' }
  const trackingTypes = { reps: 'Powtórzenia', time: 'Czas', reps_weight: 'Powtórzenia z ciężarem' }
  const sets = [...data.setEntries].sort((a, b) => {
    const first = sessions.get(a.sessionId)
    const second = sessions.get(b.sessionId)
    return (first?.date ?? '').localeCompare(second?.date ?? '')
      || (first?.startedAt ?? '').localeCompare(second?.startedAt ?? '')
      || a.sessionId.localeCompare(b.sessionId) || a.order - b.order || a.id.localeCompare(b.id)
  })
  for (const set of sets) {
    const session = sessions.get(set.sessionId)
    const exercise = exercises.get(set.exerciseId)
    rows.push([
      set.id, set.sessionId, session?.date, session?.startedAt, session?.endedAt, session?.bodyweight, session?.notes,
      set.exerciseId, exercise?.name, exercise ? categories[exercise.category] : '', exercise ? trackingTypes[exercise.trackingType] : '',
      set.variant, set.order, set.reps, set.durationSec, set.addedWeightKg, set.repsInReserve, set.note,
    ])
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export function isBackupOverdue(lastExportedAt: string | undefined, now = Date.now()): boolean {
  return lastExportedAt === undefined || now - new Date(lastExportedAt).getTime() > 14 * 24 * 60 * 60 * 1000
}

export function downloadFile(contents: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    // Give Safari time to consume the object URL before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}
