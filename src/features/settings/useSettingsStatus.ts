import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { repositories } from '../../db/repositories'
import { readPersistenceStatus, requestPersistence, type PersistenceStatus } from './storagePersistence'

type BackupStatus = { status: 'loading' } | { status: 'error' } | { status: 'ready'; lastExportedAt?: string }

export function useSettingsStatus() {
  const [backup, setBackup] = useState<BackupStatus>({ status: 'loading' })
  const [persistence, setPersistence] = useState<PersistenceStatus>('checking')
  const [now, setNow] = useState(() => Date.now())
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const subscription = liveQuery(() => repositories.getBackupMetadata()).subscribe({
      next: (metadata) => setBackup({ status: 'ready', lastExportedAt: metadata?.lastExportedAt }),
      error: () => setBackup({ status: 'error' }),
    })
    return () => subscription.unsubscribe()
  }, [attempt])

  useEffect(() => {
    let active = true
    async function refresh() {
      const status = await readPersistenceStatus()
      if (active) { setPersistence(status); setNow(Date.now()) }
    }
    void refresh()
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  async function enablePersistence() {
    setPersistence('checking')
    setPersistence(await requestPersistence())
  }

  return { backup, persistence, now, enablePersistence, retryBackup: () => setAttempt((value) => value + 1) }
}
