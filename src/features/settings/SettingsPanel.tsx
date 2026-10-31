import { useRef, useState, type ChangeEvent } from 'react'
import { repositories, RepositoryError } from '../../db/repositories'
import type { BackupData, ImportMode } from '../../db/types'
import { downloadFile, isBackupOverdue, parseBackupJson, serializeBackup, serializeSetsCsv, type BackupFile } from './backupFiles'
import { useSettingsStatus } from './useSettingsStatus'

const persistenceLabels = {
  checking: 'Sprawdzanie…',
  persistent: 'Trwałe przechowywanie jest włączone.',
  temporary: 'Trwałe przechowywanie nie jest włączone.',
  denied: 'Przeglądarka nie przyznała trwałego przechowywania.',
  unsupported: 'Ta przeglądarka nie udostępnia tej funkcji. Może być wymagane połączenie HTTPS.',
  error: 'Nie udało się sprawdzić lub włączyć trwałego przechowywania.',
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' })
}

export function SettingsPanel() {
  const { backup, persistence, now, enablePersistence, retryBackup } = useSettingsStatus()
  const [pending, setPending] = useState<{ filename: string; backup: BackupFile } | null>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof RepositoryError ? cause.message : 'Operacja nie powiodła się. Sprawdź dostęp do pliku i pamięci urządzenia, a następnie spróbuj ponownie.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function exportJson() {
    void run(async () => {
      const data = await repositories.exportData()
      const exportedAt = new Date().toISOString()
      const snapshot: BackupData = { ...data, backupMetadata: [{ id: 'backup', lastExportedAt: exportedAt }] }
      downloadFile(serializeBackup(snapshot, exportedAt), `street-tracker-kopia-${exportedAt.replaceAll(':', '-')}.json`, 'application/json;charset=utf-8')
      try {
        await repositories.recordBackupExport(exportedAt)
        setMessage('Rozpoczęto pobieranie kopii JSON. Zachowaj plik w bezpiecznym miejscu i upewnij się, że został zapisany.')
      } catch {
        setError('Rozpoczęto pobieranie JSON, ale nie udało się zapisać daty eksportu. Upewnij się, że plik został zapisany; przypomnienie pozostaje aktywne.')
      }
    })
  }

  function exportCsv() {
    void run(async () => {
      const data = await repositories.exportData()
      downloadFile(serializeSetsCsv(data), `street-tracker-serie-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
      setMessage('Rozpoczęto pobieranie CSV ze wszystkimi seriami, również z trwających treningów.')
    })
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPending(null)
    setConfirmed(false)
    void run(async () => {
      const parsed = parseBackupJson(await file.text())
      setPending({ filename: file.name, backup: parsed })
      setMode('merge')
      setMessage('Plik został sprawdzony. Wybierz sposób importu poniżej, aby zapisać dane.')
    })
  }

  function importJson() {
    if (!pending || (mode === 'replace' && !confirmed)) return
    void run(async () => {
      const result = await repositories.importData(pending.backup.data, mode)
      setPending(null)
      setConfirmed(false)
      setMessage(`Import zakończony. Zapisano rekordów: ${result.importedRecords}. Pominięto istniejących rekordów: ${result.skippedRecords}.`)
    })
  }

  return (
    <div className="space-y-5" aria-busy={busy}>
      {error && <p role="alert" className="workout-error">{error}</p>}
      <div role="status" aria-live="polite">{busy ? <p className="text-sm text-muted">Przetwarzanie danych…</p> : message && <p className="rounded-xl border border-accent/20 bg-accent/5 p-4 text-sm leading-relaxed text-accent">{message}</p>}</div>

      <section className="workout-card" aria-labelledby="backup-heading">
        <h2 id="backup-heading" className="text-lg font-semibold">Kopia zapasowa JSON</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Pełna kopia ćwiczeń, treningów, serii, szkiców aktywnego treningu, ustawień przerw i daty ostatniego eksportu. Wszystko pozostaje na Twoim urządzeniu.</p>
        {backup.status === 'loading' && <p className="mt-4 text-sm text-muted">Odczytywanie daty ostatniego eksportu…</p>}
        {backup.status === 'error' && <div className="mt-4"><p role="alert" className="text-sm text-red-200">Nie udało się odczytać daty ostatniego eksportu.</p><button type="button" className="workout-button workout-secondary mt-2" onClick={retryBackup}>Spróbuj ponownie</button></div>}
        {backup.status === 'ready' && <>
          <p className="mt-4 text-sm text-muted">Ostatni eksport JSON: {backup.lastExportedAt ? <time className="text-white" dateTime={backup.lastExportedAt}>{formatTimestamp(backup.lastExportedAt)}</time> : <span className="text-white">jeszcze nie wykonano</span>}</p>
          {isBackupOverdue(backup.lastExportedAt, now) && <p role="status" className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-sm leading-relaxed text-amber-200">{backup.lastExportedAt ? 'Od ostatniej kopii minęło ponad 14 dni. Wykonaj nową kopię JSON.' : 'Wykonaj pierwszą kopię JSON, aby móc odzyskać swoje dane.'}</p>}
        </>}
        <button type="button" disabled={busy} className="workout-button workout-primary mt-5 w-full" onClick={exportJson}>Eksportuj wszystkie dane do JSON</button>
        <p className="mt-3 text-xs leading-relaxed text-muted">Data oznacza rozpoczęcie pobierania. Sprawdź, czy plik został zapisany. Import i eksport CSV nie odświeżają przypomnienia.</p>
      </section>

      <section className="workout-card" aria-labelledby="import-heading">
        <h2 id="import-heading" className="text-lg font-semibold">Import z JSON</h2>
        <p id="import-help" className="mt-2 text-sm leading-relaxed text-muted">Wybierz kopię Street Tracker. Przed zapisem sprawdzimy format, wartości i powiązania danych. Błąd importu pozostawi dotychczasowe dane.</p>
        <label htmlFor="backup-file" className="mt-4 block text-sm font-medium">Plik kopii JSON</label>
        <input id="backup-file" type="file" accept=".json,application/json" aria-describedby="import-help" disabled={busy} onChange={chooseFile} className="workout-input mt-2 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:text-white disabled:opacity-45" />
        {pending && <div className="mt-5 space-y-4">
          <div className="rounded-xl bg-white/5 p-3 text-sm leading-relaxed">
            <p className="break-all font-semibold">{pending.filename}</p>
            <p className="mt-1 text-muted">Kopia z {formatTimestamp(pending.backup.exportedAt)}</p>
            <p className="mt-2">Ćwiczenia: {pending.backup.data.exercises.length} · Treningi: {pending.backup.data.workoutSessions.length} · Serie: {pending.backup.data.setEntries.length}</p>
          </div>
          <fieldset disabled={busy}>
            <legend className="mb-2 text-sm font-semibold">Sposób importu</legend>
            {([
              { value: 'merge', label: 'Scal z danymi na urządzeniu', detail: 'Dodaj brakujące rekordy. Przy takim samym ID zachowaj lokalny rekord, także szkice i ustawienia.' },
              { value: 'replace', label: 'Zastąp wszystkie dane', detail: 'Usuń lokalne dane i odtwórz dokładnie zawartość pliku, również aktywny trening i ustawienia.' },
            ] satisfies { value: ImportMode; label: string; detail: string }[]).map((option) => <label key={option.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl py-3">
              <input type="radio" name="import-mode" value={option.value} checked={mode === option.value} onChange={() => { setMode(option.value); setConfirmed(false) }} className="mt-1 size-5 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" />
              <span><span className="block text-sm font-medium">{option.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted">{option.detail}</span></span>
            </label>)}
          </fieldset>
          {mode === 'replace' && <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-sm leading-relaxed text-red-200">
            <input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-5 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" />
            <span>Rozumiem, że wszystkie obecne dane zostaną zastąpione. Mam potrzebną kopię zapasową.</span>
          </label>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || (mode === 'replace' && !confirmed)} className="workout-button workout-primary grow" onClick={importJson}>{mode === 'merge' ? 'Scal dane z kopii' : 'Zastąp dane kopią'}</button>
            <button type="button" disabled={busy} className="workout-button workout-secondary" onClick={() => { setPending(null); setConfirmed(false) }}>Anuluj</button>
          </div>
        </div>}
      </section>

      <section className="workout-card" aria-labelledby="csv-heading">
        <h2 id="csv-heading" className="text-lg font-semibold">Serie w CSV</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Jeden wiersz na serię, z ćwiczeniem, datą treningu, pomiarami i notatkami. Plik do analizy w arkuszu kalkulacyjnym. Do przywracania danych użyj kopii JSON.</p>
        <button type="button" disabled={busy} className="workout-button workout-secondary mt-4 w-full" onClick={exportCsv}>Eksportuj serie do CSV</button>
      </section>

      <section className="workout-card" aria-labelledby="storage-heading">
        <h2 id="storage-heading" className="text-lg font-semibold">Trwałe przechowywanie</h2>
        <p role="status" className={`mt-3 text-sm leading-relaxed ${persistence === 'persistent' ? 'text-accent' : 'text-muted'}`}>{persistenceLabels[persistence]}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">Przeglądarka decyduje o przyznaniu ochrony przed automatycznym usuwaniem danych przy braku miejsca. Nadal możesz utracić dane po wyczyszczeniu pamięci strony — zachowuj kopie JSON.</p>
        {persistence !== 'persistent' && persistence !== 'unsupported' && <button type="button" disabled={persistence === 'checking'} className="workout-button workout-secondary mt-4 w-full" onClick={() => { void enablePersistence() }}>Włącz trwałe przechowywanie</button>}
      </section>
    </div>
  )
}
