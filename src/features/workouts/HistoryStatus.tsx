export function HistoryStatus({ status, retry }: { status: 'loading' | 'error'; retry: () => void }) {
  return status === 'loading'
    ? <p role="status" className="text-sm text-muted">Wczytywanie historii…</p>
    : <div role="alert" className="workout-card"><p className="mb-4 text-sm text-muted">Nie udało się odczytać historii z pamięci urządzenia.</p><button type="button" className="workout-button workout-secondary" onClick={retry}>Spróbuj ponownie</button></div>
}
