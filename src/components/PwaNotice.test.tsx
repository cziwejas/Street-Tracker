import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PwaNotice } from './PwaNotice'

const base = { updateReady: false, offlineReady: false, updating: false, error: null, onUpdate() {}, onDismiss() {} }

describe('PWA notices', () => {
  it('stays hidden until offline caching or an update is ready', () => {
    expect(renderToStaticMarkup(<PwaNotice {...base} />)).toBe('')
  })

  it('announces completed offline caching without offering an update', () => {
    const html = renderToStaticMarkup(<PwaNotice {...base} offlineReady />)
    expect(html).toContain('role="status"')
    expect(html).toContain('Aplikacja gotowa do pracy offline')
    expect(html).not.toContain('>Aktualizuj<')
  })

  it('prioritizes an update over offline readiness and explains the reload', () => {
    const html = renderToStaticMarkup(<PwaNotice {...base} offlineReady updateReady />)
    expect(html).toContain('Dostępna jest nowa wersja')
    expect(html).toContain('Poczekaj na zakończenie zapisu')
    expect(html).toContain('>Aktualizuj<')
    expect(html).toContain('>Później<')
    expect(html).not.toContain('Aplikacja gotowa do pracy offline')
  })

  it('disables actions while activating and exposes failures in Polish', () => {
    const html = renderToStaticMarkup(<PwaNotice {...base} updateReady updating />)
    expect(html.match(/disabled=""/g)).toHaveLength(2)
    expect(html).toContain('Aktualizowanie…')
    const failed = renderToStaticMarkup(<PwaNotice {...base} error="Nie udało się przygotować aplikacji." />)
    expect(failed).toContain('Tryb offline jest niedostępny')
    expect(failed).toContain('Nie udało się przygotować aplikacji.')
  })
})
