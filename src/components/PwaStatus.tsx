import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { reloadOnPwaControllerChange, watchForPwaUpdates } from '../lib/pwaUpdates'
import { PwaNotice } from './PwaNotice'

export function PwaStatus() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [updateReady, setUpdateReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    // Native controllerchange below also covers updates during the first visit.
    onNeedReload() {},
    onRegisteredSW(_url, registered) { setRegistration(registered) },
    onRegisterError() {
      setError('Nie udało się przygotować aplikacji do pracy offline. Połącz się z internetem i otwórz ją ponownie.')
    },
  })

  useEffect(reloadOnPwaControllerChange, [])

  useEffect(() => {
    if (registration) return watchForPwaUpdates(registration, () => setUpdateReady(true))
  }, [registration, setUpdateReady])

  useEffect(() => {
    if (!updating) return
    const timeout = window.setTimeout(() => {
      setUpdating(false)
      setError('Aktualizacja trwa zbyt długo. Spróbuj ponownie lub otwórz aplikację ponownie.')
    }, 15_000)
    return () => window.clearTimeout(timeout)
  }, [updating])

  async function update() {
    setUpdating(true)
    setError(null)
    try {
      await updateServiceWorker()
    } catch {
      setError('Nie udało się zastosować aktualizacji. Spróbuj ponownie.')
      setUpdating(false)
    }
  }

  return <PwaNotice updateReady={updateReady} offlineReady={offlineReady} updating={updating} error={error}
    onUpdate={() => { void update() }}
    onDismiss={() => { setOfflineReady(false); setUpdateReady(false); setError(null) }} />
}
