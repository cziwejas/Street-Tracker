import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from './SettingsPanel'
import { useSettingsStatus } from './useSettingsStatus'

vi.mock('./useSettingsStatus', () => ({ useSettingsStatus: vi.fn() }))

const status: ReturnType<typeof useSettingsStatus> = {
  backup: { status: 'ready', lastExportedAt: '2026-10-01T12:00:00.000Z' },
  persistence: 'temporary', now: new Date('2026-10-31T12:00:00Z').getTime(),
  enablePersistence: vi.fn(), retryBackup: vi.fn(),
}

beforeEach(() => { vi.mocked(useSettingsStatus).mockReturnValue(status) })

describe('settings screen', () => {
  it('shows an overdue reminder with all backup actions and an accessible file field', () => {
    const html = renderToStaticMarkup(<SettingsPanel />)
    expect(html).toContain('ponad 14 dni')
    expect(html).toContain('Eksportuj wszystkie dane do JSON')
    expect(html).toContain('Eksportuj serie do CSV')
    expect(html).toContain('for="backup-file"')
    expect(html).toContain('aria-describedby="import-help"')
    expect(html).toContain('Włącz trwałe przechowywanie')
  })

  it('hides the overdue reminder at exactly 14 days and shows granted persistence', () => {
    vi.mocked(useSettingsStatus).mockReturnValue({ ...status, backup: { status: 'ready', lastExportedAt: '2026-10-17T12:00:00Z' }, persistence: 'persistent' })
    const html = renderToStaticMarkup(<SettingsPanel />)
    expect(html).not.toContain('ponad 14 dni')
    expect(html).toContain('Trwałe przechowywanie jest włączone.')
    expect(html).not.toContain('Włącz trwałe przechowywanie')
  })

  it('prompts for a first backup and handles unavailable persistent storage', () => {
    vi.mocked(useSettingsStatus).mockReturnValue({ ...status, backup: { status: 'ready' }, persistence: 'unsupported' })
    const html = renderToStaticMarkup(<SettingsPanel />)
    expect(html).toContain('Wykonaj pierwszą kopię JSON')
    expect(html).toContain('Ta przeglądarka nie udostępnia tej funkcji')
    expect(html).not.toContain('Włącz trwałe przechowywanie')
  })

  it('offers a retry for metadata read failures and explains a persistence denial', () => {
    vi.mocked(useSettingsStatus).mockReturnValue({ ...status, backup: { status: 'error' }, persistence: 'denied' })
    const html = renderToStaticMarkup(<SettingsPanel />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Spróbuj ponownie')
    expect(html).toContain('nie przyznała trwałego przechowywania')
    expect(html).toContain('Włącz trwałe przechowywanie')
  })
})
