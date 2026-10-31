import { describe, expect, it, vi } from 'vitest'
import { readPersistenceStatus, requestPersistence } from './storagePersistence'

describe('persistent storage', () => {
  it('reads the existing status and calls persist on request', async () => {
    const storage = { persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(true) }
    expect(await readPersistenceStatus(storage)).toBe('temporary')
    expect(storage.persist).not.toHaveBeenCalled()
    expect(await requestPersistence(storage)).toBe('persistent')
    expect(storage.persist).toHaveBeenCalledOnce()
    storage.persisted.mockResolvedValue(true)
    expect(await readPersistenceStatus(storage)).toBe('persistent')
  })

  it('reports denial and API errors without rejecting', async () => {
    const storage = { persisted: vi.fn().mockRejectedValue(new Error('Blocked')), persist: vi.fn().mockResolvedValue(false) }
    expect(await readPersistenceStatus(storage)).toBe('error')
    expect(await requestPersistence(storage)).toBe('denied')
    storage.persist.mockRejectedValue(new Error('Blocked'))
    expect(await requestPersistence(storage)).toBe('error')
  })

  it('handles a browser without the storage API', async () => {
    expect(await readPersistenceStatus()).toBe('unsupported')
    expect(await requestPersistence()).toBe('unsupported')
  })
})
