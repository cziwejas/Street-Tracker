type UpdateRegistration = Pick<ServiceWorkerRegistration, 'waiting' | 'installing'> & { update(): Promise<unknown> }

/** Workbox's isUpdate flag stays false for the entire first-load session. */
export function reloadOnPwaControllerChange(): () => void {
  if (!('serviceWorker' in navigator)) return () => {}
  let previous = navigator.serviceWorker.controller
  function changed() {
    const current = navigator.serviceWorker.controller
    if (previous && current && current !== previous) window.location.reload()
    previous = current
  }
  navigator.serviceWorker.addEventListener('controllerchange', changed)
  return () => navigator.serviceWorker.removeEventListener('controllerchange', changed)
}

/** iOS can suspend timers; also check when the app returns to the foreground. */
export function watchForPwaUpdates(registration: UpdateRegistration, onWaiting: () => void): () => void {
  let checking = false

  async function check() {
    if (document.visibilityState !== 'visible') return
    if (registration.waiting) onWaiting()
    if (!navigator.onLine || registration.installing || checking) return
    checking = true
    try {
      await registration.update()
    } catch {
      // Connectivity can fail even when onLine is true; keep the offline app usable.
    } finally {
      checking = false
    }
  }

  function checkInBackground() { void check() }

  if (registration.waiting) onWaiting()
  window.addEventListener('online', checkInBackground)
  window.addEventListener('focus', checkInBackground)
  document.addEventListener('visibilitychange', checkInBackground)
  const interval = window.setInterval(checkInBackground, 60 * 60 * 1000)

  return () => {
    window.clearInterval(interval)
    window.removeEventListener('online', checkInBackground)
    window.removeEventListener('focus', checkInBackground)
    document.removeEventListener('visibilitychange', checkInBackground)
  }
}
