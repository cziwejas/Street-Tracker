export type PersistenceStatus = 'checking' | 'persistent' | 'temporary' | 'denied' | 'unsupported' | 'error'

type PersistentStorage = Pick<StorageManager, 'persisted' | 'persist'>

function browserStorage(): PersistentStorage | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

export async function readPersistenceStatus(storage = browserStorage()): Promise<PersistenceStatus> {
  if (typeof storage?.persisted !== 'function') return 'unsupported'
  try {
    return await storage.persisted() ? 'persistent' : 'temporary'
  } catch {
    return 'error'
  }
}

export async function requestPersistence(storage = browserStorage()): Promise<PersistenceStatus> {
  if (typeof storage?.persist !== 'function') return 'unsupported'
  try {
    return await storage.persist() ? 'persistent' : 'denied'
  } catch {
    return 'error'
  }
}
