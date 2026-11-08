import { expect, test, type Locator, type Page } from '@playwright/test'

const sizes = [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 }]

async function chooseExercise(page: Page, name: string) {
  await page.getByRole('button', { name: 'Dodaj lub wybierz ćwiczenie' }).click()
  const picker = page.getByRole('dialog', { name: 'Dodaj ćwiczenie' })
  await picker.getByRole('searchbox').fill(name)
  await picker.getByRole('button', { name: new RegExp(name) }).click()
}

async function canTap(locator: Locator) {
  await expect(locator).toBeInViewport({ ratio: 1 })
  await expect.poll(() => locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return element.contains(document.elementFromPoint(x + width / 2, y + height / 2))
  })).toBe(true)
}

test.beforeEach(async ({ page, request }) => {
  await request.post('/__pwa-test__/release', { headers: { 'x-pwa-release': 'A' } })
  await page.goto('/')
  await expect(page.getByText('Aplikacja gotowa do pracy offline', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zamknij', exact: true }).click()
})

test('compact training', async ({ page }, testInfo) => {
  const start = page.getByRole('button', { name: 'Rozpocznij trening', exact: true })
  const add = page.getByRole('button', { name: '+ Dodaj serię', exact: true })
  const finish = page.getByRole('button', { name: 'Zakończ', exact: true })
  const save = page.getByRole('button', { name: 'Zapisz i zakończ', exact: true })
  const repetitions = page.getByRole('textbox', { name: 'Powtórzenia', exact: true })
  const weight = page.getByRole('textbox', { name: 'Dodatkowy ciężar (kg)', exact: true })
  const timer = page.getByRole('timer', { name: 'Czas przerwy' })
  const home = page.getByRole('region', { name: 'Ostatnie treningi' })
  const content = page.locator('#main-content')

  await expect(home).toContainText('Tutaj pojawi się Twój pierwszy trening.')
  for (const [index, name] of ['Deska', 'Pompki klasyczne', 'Podciąganie nachwytem'].entries()) {
    const day = index + 4
    await page.clock.setFixedTime(new Date(`2026-11-0${day}T18:00:00`))
    await start.click()
    await chooseExercise(page, name)
    await add.click()
    await page.clock.setFixedTime(new Date(`2026-11-0${day}T18:2${day}:36`))
    await finish.click()
    await save.click()
  }
  await page.clock.setFixedTime(new Date('2026-11-08T15:00:00'))
  await page.reload()
  await expect(home.locator('li')).toHaveCount(3)
  await expect(page.getByText('przedwczoraj', { exact: true })).toBeVisible()
  for (const size of sizes) {
    await page.setViewportSize(size)
    await canTap(start)
    await page.screenshot({ path: testInfo.outputPath(`start-${size.width}x${size.height}.png`), scale: 'css' })
  }

  await start.click()
  await chooseExercise(page, 'Podciąganie nachwytem')
  await repetitions.fill('8')
  await page.getByRole('checkbox', { name: 'Wariant z obciążeniem' }).check()
  await weight.fill('5,5')
  await add.click()
  await page.getByRole('button', { name: 'Powtórz poprzednią serię' }).click()
  await chooseExercise(page, 'Deska')
  await expect(page.getByRole('textbox', { name: 'Czas (s)' })).toHaveAttribute('inputmode', 'numeric')
  await add.click()
  await page.getByRole('button', { name: 'Podciąganie nachwytem', exact: true }).click()
  await page.clock.setFixedTime(new Date('2026-11-08T15:05:20'))
  await add.click()
  await expect(timer).toBeVisible()
  await expect(page.locator('.workout-status')).toContainText('2 ćw. · 4 serie')
  await expect(page.getByText('Street Tracker', { exact: true })).toBeHidden()
  await expect(home).toHaveCount(0)

  for (const size of sizes) {
    await page.setViewportSize(size)
    await content.evaluate((element) => { element.scrollTop = 0 })
    await canTap(repetitions)
    await canTap(weight)
    await canTap(page.getByRole('combobox', { name: 'Wariant', exact: true }))
    await canTap(add)
    await canTap(page.getByRole('heading', { name: 'Podciąganie nachwytem', exact: true, level: 2 }))
    await canTap(page.getByRole('button', { name: 'Podciąganie nachwytem', exact: true }))
    const layout = await page.evaluate(() => {
      const footer = document.querySelector('.workout-footer')
      const status = document.querySelector('.workout-status')
      const main = document.querySelector('#main-content')
      return {
        footer: footer?.getBoundingClientRect().height ?? 0,
        status: status?.getBoundingClientRect().height ?? 0,
        padding: main ? parseFloat(getComputedStyle(main).paddingBottom) : 0,
        viewport: window.visualViewport?.height ?? window.innerHeight,
        fitsWidth: (main?.scrollWidth ?? 0) <= (main?.clientWidth ?? 0),
      }
    })
    expect(layout.fitsWidth).toBe(true)
    expect(layout.padding).toBe(layout.footer)
    if (size.width === 390) expect((layout.footer + layout.status) / layout.viewport).toBeLessThan(0.35)
    await page.screenshot({ path: testInfo.outputPath(`aktywny-${size.width}x${size.height}.png`), scale: 'css' })
  }

  await expect(page.locator('#session-sets li')).toHaveCount(3)
  await page.getByRole('button', { name: 'Pokaż wszystkie' }).click()
  await expect(page.locator('#session-sets li')).toHaveCount(4)
  await page.setViewportSize(sizes[0])
  await weight.focus()
  await page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) throw new Error('VisualViewport is required for this test.')
    Object.defineProperty(viewport, 'height', { configurable: true, value: 350 })
    viewport.dispatchEvent(new Event('resize'))
  })
  await canTap(weight)
  await canTap(add)
  await expect.poll(async () => {
    const action = await add.boundingBox()
    return action ? action.y + action.height : Infinity
  }).toBeLessThanOrEqual(350)
  await expect.poll(async () => {
    const input = await weight.boundingBox()
    const footer = await page.locator('.workout-footer').boundingBox()
    return Boolean(input && footer && input.y + input.height <= footer.y)
  }).toBe(true)
  await page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    Reflect.deleteProperty(viewport, 'height')
    viewport.dispatchEvent(new Event('resize'))
  })
  await page.clock.setFixedTime(new Date('2026-11-08T15:07:00'))
  await expect(timer).toHaveCount(0)
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await canTap(page.locator('#session-sets li').last().getByRole('button', { name: /^Usuń serię/ }))
})

test('finish, discard and rest preferences', async ({ page }) => {
  await page.getByRole('link', { name: 'Ustawienia', exact: true }).click()
  const rest = page.getByRole('textbox', { name: 'Domyślna przerwa (s)' })
  await rest.fill('0')
  await page.getByRole('button', { name: 'Zapisz przerwę' }).click()
  await expect(page.getByText('Zapisano. Zmiana od następnej serii.')).toBeVisible()
  await page.getByRole('link', { name: 'Trening', exact: true }).click()
  await page.getByRole('button', { name: 'Rozpocznij trening', exact: true }).click()
  await chooseExercise(page, 'Deska')
  await page.getByRole('button', { name: '+ Dodaj serię', exact: true }).click()
  await expect(page.getByRole('timer', { name: 'Czas przerwy' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Zakończ', exact: true }).click()
  const finish = page.getByRole('dialog', { name: 'Zakończyć trening?' })
  await expect(finish).toContainText('1 ćwiczenie · 1 seria')
  await finish.getByRole('button', { name: 'Odrzuć trening' }).click()
  const discard = page.getByRole('dialog', { name: 'Odrzucić trening?' })
  await discard.getByRole('button', { name: 'Wróć', exact: true }).click()
  await finish.getByRole('button', { name: 'Wróć', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edytuj serię 1: Deska' })).toBeVisible()
  await page.getByRole('button', { name: 'Zakończ', exact: true }).click()
  await finish.getByRole('button', { name: 'Odrzuć trening' }).click()
  await discard.getByRole('button', { name: 'Usuń trening' }).click()
  await expect(page.getByRole('button', { name: 'Rozpocznij trening', exact: true })).toBeVisible()
  await expect(page.getByText('Tutaj pojawi się Twój pierwszy trening.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Rozpocznij trening', exact: true })).toBeVisible()
})
