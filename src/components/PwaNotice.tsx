interface PwaNoticeProps {
  updateReady: boolean
  offlineReady: boolean
  updating: boolean
  error: string | null
  onUpdate: () => void
  onDismiss: () => void
}

export function PwaNotice({ updateReady, offlineReady, updating, error, onUpdate, onDismiss }: PwaNoticeProps) {
  if (!updateReady && !offlineReady && !error) return null

  return <aside className="pwa-notice" aria-label="Stan aplikacji">
    <div role="status" aria-live="polite" aria-atomic="true">
      <p className="font-semibold text-white">{updateReady ? 'Dostępna jest nowa wersja' : error ? 'Tryb offline jest niedostępny' : 'Aplikacja gotowa do pracy offline'}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{updateReady
        ? 'Aktualizacja przeładuje aplikację. Poczekaj na zakończenie zapisu i zamknij otwarte formularze. Zapisane treningi pozostaną na urządzeniu.'
        : error ?? 'Możesz teraz korzystać z aplikacji bez internetu na tym urządzeniu.'}</p>
      {updateReady && error && <p className="mt-2 text-sm text-red-200">{error}</p>}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {updateReady && <button type="button" className="workout-button workout-primary flex-1" disabled={updating} onClick={onUpdate}>{updating ? 'Aktualizowanie…' : 'Aktualizuj'}</button>}
      <button type="button" className="workout-button workout-secondary flex-1" disabled={updating} onClick={onDismiss}>{updateReady ? 'Później' : 'Zamknij'}</button>
    </div>
  </aside>
}
