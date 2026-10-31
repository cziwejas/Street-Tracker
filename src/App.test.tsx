import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('Street Tracker routes', () => {
  it.each([
    ['/', 'Trening'],
    ['/cwiczenia', 'Ćwiczenia'],
    ['/progres', 'Progres'],
    ['/historia', 'Historia'],
    ['/historia/test-session', 'Szczegóły treningu'],
    ['/ustawienia', 'Ustawienia'],
  ])('renders the %s page and navigation', (path, title) => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    )

    expect(html).toMatch(new RegExp(`<h1[^>]*>${title}</h1>`))
    expect(html).toContain('aria-label="Nawigacja główna"')
    expect(html).toContain(`aria-current="page" class="`)
    expect(html).toContain(`href="${path.startsWith('/historia') ? '/' : path}"`)
  })
})
