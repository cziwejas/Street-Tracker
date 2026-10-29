import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { db } from './db/db'

describe('Street Tracker skeleton', () => {
  it.each([
    ['/', 'Trening'],
    ['/cwiczenia', 'Ćwiczenia'],
    ['/progres', 'Progres'],
    ['/ustawienia', 'Ustawienia'],
  ])('renders the %s placeholder and navigation', (path, title) => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    )

    expect(html).toMatch(new RegExp(`<h1[^>]*>${title}</h1>`))
    expect(html).toContain('aria-label="Nawigacja główna"')
    expect(html).toContain(`aria-current="page" class="`)
    expect(html).toContain(`href="${path}"`)
  })

  it('reserves database version 1 with no tables', () => {
    expect(db.name).toBe('StreetTracker')
    expect(db.verno).toBe(1)
    expect(db.tables).toHaveLength(0)
  })
})
