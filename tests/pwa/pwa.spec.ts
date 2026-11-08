import { expect, test, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import sharp from 'sharp'

async function firstLoad(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Aplikacja gotowa do pracy offline', { exact: true })).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.getByRole('button', { name: 'Zamknij', exact: true }).click()
}

async function startAndLogSet(page: Page) {
  await page.getByRole('button', { name: 'Rozpocznij trening', exact: true }).click()
  await page.getByRole('button', { name: 'Dodaj lub wybierz ćwiczenie' }).click()
  await page.getByRole('searchbox', { name: 'Szukaj ćwiczenia' }).fill('Podciąganie nachwytem')
  await page.getByRole('dialog').getByRole('button', { name: /Podciąganie nachwytem/ }).click()
  await page.getByRole('textbox', { name: 'Powtórzenia', exact: true }).fill('12')
  await page.getByRole('button', { name: '+ Dodaj serię', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edytuj serię 1: Podciąganie nachwytem' })).toBeVisible()
  await expect(page.getByText('Zapisano na urządzeniu', { exact: true })).toBeVisible()
}

test.beforeEach(async ({ request }) => {
  await request.post('/__pwa-test__/release', { headers: { 'x-pwa-release': 'A' } })
})

test('first-load cache supports cold offline routes, workout writes, history and unvisited lazy charts', async ({ page, context }) => {
  const errors: string[] = []
  await firstLoad(page)
  // No online visits to other tabs or to the lazy-loaded chart module.
  await context.setOffline(true)
  await page.close()
  const offline = await context.newPage()
  offline.on('pageerror', (error) => errors.push(error.message))
  await offline.goto('/cwiczenia')
  await expect(offline.getByRole('heading', { name: 'Ćwiczenia', exact: true, level: 1 })).toBeVisible()
  await offline.getByRole('link', { name: 'Trening', exact: true }).click()
  await startAndLogSet(offline)
  await offline.reload()
  await offline.getByRole('button', { name: 'Kontynuuj trening', exact: true }).click()
  await expect(offline.getByRole('button', { name: 'Edytuj serię 1: Podciąganie nachwytem' })).toBeVisible()
  await expect(offline.getByRole('textbox', { name: 'Powtórzenia', exact: true })).toHaveValue('12')
  await offline.getByRole('button', { name: 'Zakończ', exact: true }).click()
  await offline.getByRole('button', { name: 'Zapisz i zakończ', exact: true }).click()
  await offline.getByRole('link', { name: 'Zobacz wszystko', exact: true }).click()
  await expect(offline.getByText('Liczba treningów:')).toContainText('1')
  await offline.locator('a.history-link').click()
  const detailUrl = offline.url()
  await offline.getByRole('textbox', { name: 'Masa ciała w dniu treningu (kg)' }).fill('78,5')
  await offline.getByRole('button', { name: 'Zapisz pomiar' }).click()
  await expect(offline.getByText('Pomiar zapisany na urządzeniu.')).toBeVisible()
  // Deep-link navigation also uses the precached app shell.
  await offline.goto(detailUrl)
  await expect(offline.getByRole('textbox', { name: 'Masa ciała w dniu treningu (kg)' })).toHaveValue('78,5')
  const chart = offline.waitForResponse((response) => /\/assets\/ChartPlot-.*\.js$/.test(response.url()) && response.fromServiceWorker())
  await offline.getByRole('link', { name: 'Progres', exact: true }).click()
  await chart
  await expect(offline.locator('.recharts-responsive-container').first()).toBeVisible()
  await offline.getByRole('link', { name: 'Ustawienia', exact: true }).click()
  await expect(offline.getByRole('button', { name: 'Eksportuj wszystkie dane do JSON' })).toBeVisible()
  expect(errors).toEqual([])
})

test('a deployed update waits for consent, can be deferred, and activates offline preserving a workout', async ({ page, request, context }, testInfo) => {
  await firstLoad(page)
  await startAndLogSet(page)
  await request.post('/__pwa-test__/release', { headers: { 'x-pwa-release': 'B' } })
  // Exercise the foreground check rather than manually calling registration.update().
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('Dostępna jest nowa wersja', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('update-prompt.png') })
  await expect(page.locator('meta[name="pwa-test-release"]')).toHaveCount(0)
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true)
  await page.getByRole('button', { name: 'Później', exact: true }).click()
  await expect(page.getByText('Dostępna jest nowa wersja', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Powtórzenia', exact: true })).toHaveValue('12')
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('Dostępna jest nowa wersja', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Aktualizuj', exact: true }).click()
  await expect(page.locator('meta[name="pwa-test-release"]')).toHaveAttribute('content', 'B')
  await page.getByRole('button', { name: 'Kontynuuj trening', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edytuj serię 1: Podciąganie nachwytem' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Powtórzenia', exact: true })).toHaveValue('12')
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false)
})

test('manifest, opaque icons, splash assets, installability and mobile form sizing are valid', async ({ playwright, request }, testInfo) => {
  // Chrome disables installation in the isolated contexts used by other tests.
  // Keep the profile short: Chrome's Service Worker storage can fail on Windows
  // when nested beneath Playwright's long per-test output directory.
  const profile = await mkdtemp(join(tmpdir(), 'street-tracker-pwa-'))
  const context = await playwright.chromium.launchPersistentContext(profile, {
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    baseURL: 'http://127.0.0.1:4174', headless: true,
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  })
  try {
    const page = await context.newPage()
    await firstLoad(page)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Page.enable')
    const installability = await cdp.send('Page.getInstallabilityErrors')
    expect(installability.installabilityErrors).toEqual([])
    const manifestResponse = await request.get('/manifest.webmanifest')
    const manifest: { display: string; start_url: string; scope: string; icons: { src: string; sizes: string; purpose: string }[] } = await manifestResponse.json()
    expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', scope: '/' })
    expect(manifest.icons.filter((icon) => icon.purpose === 'maskable')).toHaveLength(2)
    for (const icon of [...manifest.icons, { src: '/apple-touch-icon.png', sizes: '180x180', purpose: 'apple' }]) {
      const response = await request.get(icon.src)
      expect(response.ok()).toBe(true)
      const pixels = await response.body()
      const metadata = await sharp(pixels).metadata()
      expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes)
      expect(metadata.hasAlpha).toBe(false)
      if (icon.purpose === 'maskable') {
        const { data, info } = await sharp(pixels).removeAlpha().raw().toBuffer({ resolveWithObject: true })
        let furthestPixel = 0
        for (let y = 0; y < info.height; y++) {
          for (let x = 0; x < info.width; x++) {
            const offset = (y * info.width + x) * info.channels
            if ((data[offset + 1] ?? 0) > 80) {
              furthestPixel = Math.max(furthestPixel, Math.hypot(x - info.width / 2, y - info.height / 2))
            }
          }
        }
        expect(furthestPixel).toBeGreaterThan(0)
        expect(furthestPixel).toBeLessThan(info.width * 0.4)
      }
    }
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black-translucent')
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('viewport-fit=cover')
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/)
    const splashLinks = await page.locator('link[rel="apple-touch-startup-image"]').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute('href') ?? '', media: link.getAttribute('media') ?? '' })))
    expect(splashLinks.length).toBeGreaterThanOrEqual(20)
    for (const link of splashLinks) {
      const response = await request.get(link.href)
      expect(response.ok()).toBe(true)
      const image = await sharp(await response.body()).metadata()
      expect(link.href).toContain(`${image.width}x${image.height}`)
      expect(link.media).toMatch(/orientation: (portrait|landscape)/)
    }
    await page.getByRole('link', { name: 'Ustawienia', exact: true }).click()
    const fileInput = page.getByLabel('Plik kopii JSON')
    expect(await fileInput.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16)
    await page.getByRole('link', { name: 'Trening', exact: true }).click()
    await startAndLogSet(page)
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const repetitions = page.getByRole('textbox', { name: 'Powtórzenia', exact: true })
      await repetitions.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await expect(repetitions).toBeInViewport({ ratio: 1 })
      expect(await repetitions.evaluate((element) => {
        const box = element.getBoundingClientRect()
        return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === element
      })).toBe(true)
      await page.getByRole('button', { name: '+ Dodaj serię', exact: true }).scrollIntoViewIfNeeded()
      const nav = await page.getByRole('navigation', { name: 'Nawigacja główna' }).boundingBox()
      const action = await page.getByRole('button', { name: '+ Dodaj serię', exact: true }).boundingBox()
      if (!nav || !action) throw new Error('Missing navigation or workout controls.')
      expect(action.y + action.height).toBeLessThanOrEqual(nav.y)
      await page.screenshot({ path: testInfo.outputPath(`workout-${size.width}x${size.height}.png`) })
    }
    const fields = await page.locator('input:not([type="checkbox"]), select, textarea').evaluateAll((inputs) => inputs.map((input) => parseFloat(getComputedStyle(input).fontSize)))
    expect(fields.every((size) => size >= 16)).toBe(true)
    const targets = await page.locator('.pwa-notice button, nav a, .workout-button, .workout-icon-button').evaluateAll((elements) => elements.filter((element) => element.getClientRects().length > 0).map((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
    expect(targets.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true)
  } finally {
    await context.close()
    if (dirname(profile) === resolve(tmpdir()) && basename(profile).startsWith('street-tracker-pwa-')) {
      await rm(profile, { recursive: true, force: true })
    }
  }
})
