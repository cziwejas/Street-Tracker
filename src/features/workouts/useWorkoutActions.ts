import { useCallback, useRef, useState } from 'react'
import { RepositoryError } from '../../db/repositories'

/** Keep fast draft writes in order, including a set logged immediately afterward. */
export function useWorkoutActions() {
  const queue = useRef<Promise<void>>(Promise.resolve())
  const blocking = useRef(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    setPending((count) => count + 1)
    const result = queue.current.then(operation)
    queue.current = result.then(() => undefined, () => undefined)
    return result.finally(() => setPending((count) => count - 1))
  }, [])

  const reportError = useCallback((cause: unknown) => {
    setError(cause instanceof RepositoryError ? cause.message : 'Nie udało się zapisać zmian. Sprawdź wolne miejsce i spróbuj ponownie.')
  }, [])

  const save = useCallback((operation: () => Promise<unknown>) => {
    setError(null)
    void enqueue(operation).catch(reportError)
  }, [enqueue, reportError])

  const perform = useCallback(async (operation: () => Promise<void>) => {
    if (blocking.current) return
    blocking.current = true
    setBusy(true)
    setError(null)
    try {
      await enqueue(operation)
    } catch (cause: unknown) {
      reportError(cause)
    } finally {
      blocking.current = false
      setBusy(false)
    }
  }, [enqueue, reportError])

  return { busy, pending, error, save, perform }
}
