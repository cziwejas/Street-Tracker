import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reloadOnPwaControllerChange, watchForPwaUpdates } from './pwaUpdates'

let windowEvents: EventTarget
let documentEvents: EventTarget & { visibilityState: string }
let network: { onLine: boolean }

beforeEach(() => {
  vi.useFakeTimers()
  windowEvents = new EventTarget()
  documentEvents = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  network = { onLine: true }
  vi.stubGlobal('window', Object.assign(windowEvents, { setInterval, clearInterval }))
  vi.stubGlobal('document', documentEvents)
  vi.stubGlobal('navigator', network)
})

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

function makeRegistration() {
  const registration = { waiting: null, installing: null, update: vi.fn().mockResolvedValue(undefined) }
  return registration
}

describe('foreground service worker update checks', () => {
  it('checks on focus, reconnect, foreground and hourly, then cleans up', async () => {
    const registration = makeRegistration()
    const stop = watchForPwaUpdates(registration, vi.fn())
    windowEvents.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
    windowEvents.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    documentEvents.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledTimes(4)
    stop()
    windowEvents.dispatchEvent(new Event('focus'))
    windowEvents.dispatchEvent(new Event('online'))
    documentEvents.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledTimes(4)
  })

  it('skips hidden/offline checks and catches network failures', async () => {
    const registration = makeRegistration()
    const stop = watchForPwaUpdates(registration, vi.fn())
    network.onLine = false
    windowEvents.dispatchEvent(new Event('focus'))
    network.onLine = true
    documentEvents.visibilityState = 'hidden'
    windowEvents.dispatchEvent(new Event('online'))
    expect(registration.update).not.toHaveBeenCalled()
    documentEvents.visibilityState = 'visible'
    registration.update.mockRejectedValueOnce(new Error('offline'))
    windowEvents.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
    windowEvents.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
    expect(registration.update).toHaveBeenCalledTimes(2)
    stop()
  })

  it('offers an already waiting update again on return, even offline', () => {
    const worker: ServiceWorker = Object.assign(new EventTarget(), {
      state: 'installed' as const, scriptURL: '/sw.js', onstatechange: null, onerror: null, postMessage: vi.fn(),
    })
    const registration = { ...makeRegistration(), waiting: worker }
    const waiting = vi.fn()
    const stop = watchForPwaUpdates(registration, waiting)
    expect(waiting).toHaveBeenCalledOnce()
    network.onLine = false
    windowEvents.dispatchEvent(new Event('focus'))
    expect(waiting).toHaveBeenCalledTimes(2)
    expect(registration.update).not.toHaveBeenCalled()
    stop()
  })

  it('does not overlap update requests', async () => {
    const registration = makeRegistration()
    const stop = watchForPwaUpdates(registration, vi.fn())
    windowEvents.dispatchEvent(new Event('focus'))
    windowEvents.dispatchEvent(new Event('focus'))
    expect(registration.update).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(0)
    stop()
  })
})

describe('service worker activation', () => {
  it('ignores initial control and reloads on a replacement controller, then cleans up', () => {
    const workers = Object.assign(new EventTarget(), { controller: null as object | null })
    const reload = vi.fn()
    vi.stubGlobal('navigator', { serviceWorker: workers })
    vi.stubGlobal('window', { location: { reload } })
    const stop = reloadOnPwaControllerChange()
    workers.controller = {}
    workers.dispatchEvent(new Event('controllerchange'))
    expect(reload).not.toHaveBeenCalled()
    workers.dispatchEvent(new Event('controllerchange'))
    expect(reload).not.toHaveBeenCalled()
    workers.controller = {}
    workers.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledOnce()
    stop()
    workers.controller = {}
    workers.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('leaves browsers without service worker support usable', () => {
    expect(() => reloadOnPwaControllerChange()()).not.toThrow()
  })
})
