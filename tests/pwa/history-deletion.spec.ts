import { expect, test, type Page } from '@playwright/test'

async function finishWorkoutWithSet(page: Page) {
  await page.getByRole('button', { name: 'Rozpocznij trening', exact: true }).click()
  await page.getByRole('button', { name: 'Dodaj lub wybierz ćwiczenie' }).click()
  await page.getByRole('searchbox', { name: 'Szukaj ćwiczenia' }).fill('Podciąganie nachwytem')
  await page.getByRole('dialog').getByRole('button', { name: /Podciąganie nachwytem/ }).click()
  await page.getByRole('button', { name: '+ Dodaj serię', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edytuj serię 1: Podciąganie nachwytem' })).toBeVisible()
  await page.getByRole('button', { name: 'Zakończ', exact: true }).click()
  await page.getByRole('button', { name: 'Zakończ trening', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Rozpocznij trening', exact: true })).toBeVisible()
}

test.beforeEach(async ({ page, request }) => {
  await request.post('/__pwa-test__/release', { headers: { 'x-pwa-release': 'A' } })
  await page.goto('/')
  await expect(page.getByText('Aplikacja gotowa do pracy offline', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zamknij', exact: true }).click()
})

test('cancels safely, deletes from history and details, and persists the empty history', async ({ page }, testInfo) => {
  await finishWorkoutWithSet(page)
  await finishWorkoutWithSet(page)
  await page.getByRole('link', { name: 'Historia treningów', exact: true }).click()
  await expect(page.locator('a.history-link')).toHaveCount(2)
  const retainedUrl = await page.locator('a.history-link').last().getAttribute('href')
  const deleteButton = page.getByRole('button', { name: /^Usuń trening z/ }).first()
  await deleteButton.click()
  await expect(page).toHaveURL(/\/historia$/)
  const dialog = page.getByRole('dialog', { name: 'Usunąć trening?' })
  await expect(dialog).toContainText('Tej operacji nie można cofnąć.')
  await page.screenshot({ path: testInfo.outputPath('delete-workout-mobile.png') })
  await dialog.getByRole('button', { name: 'Anuluj', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(deleteButton).toBeFocused()
  await expect(page.locator('a.history-link')).toHaveCount(2)
  await deleteButton.click()
  await dialog.getByRole('button', { name: 'Usuń trening', exact: true }).click()
  await expect(page.locator('a.history-link')).toHaveCount(1)
  await expect(page.locator('a.history-link')).toHaveAttribute('href', retainedUrl ?? '')
  await page.locator('a.history-link').click()
  const detailUrl = page.url()
  await page.getByRole('button', { name: /^Usuń trening z/ }).click()
  await dialog.getByRole('button', { name: 'Usuń trening', exact: true }).click()
  await expect(page).toHaveURL(/\/historia$/)
  await expect(page.getByRole('heading', { name: 'Tutaj zacznie się Twoja historia' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Tutaj zacznie się Twoja historia' })).toBeVisible()
  await page.goto(detailUrl)
  await expect(page.getByRole('heading', { name: 'Nie znaleziono treningu' })).toBeVisible()
  // Check the persisted cascade, including workout drafts, after both UI paths.
  const counts = await page.evaluate(() => new Promise<number[]>((resolve, reject) => {
    const request = indexedDB.open('StreetTracker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const tables = ['workoutSessions', 'setEntries', 'workoutStates']
      const transaction = database.transaction(tables, 'readonly')
      const requests = tables.map((name) => transaction.objectStore(name).count())
      transaction.oncomplete = () => { database.close(); resolve(requests.map((entry) => entry.result)) }
      transaction.onabort = () => { database.close(); reject(transaction.error) }
    }
  }))
  expect(counts).toEqual([0, 0, 0])
})

test('keeps the workout on a storage failure and allows retrying deletion', async ({ page }) => {
  await finishWorkoutWithSet(page)
  await page.getByRole('link', { name: 'Historia treningów', exact: true }).click()
  await page.locator('a.history-link').click()
  await page.getByRole('button', { name: /^Usuń trening z/ }).click()
  // Fail one parent deletion after its dependent records have been removed.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.delete
    IDBObjectStore.prototype.delete = function (key) {
      if (this.name === 'workoutSessions') {
        IDBObjectStore.prototype.delete = original
        throw new DOMException('Deletion unavailable', 'UnknownError')
      }
      return original.call(this, key)
    }
  })
  const dialog = page.getByRole('dialog', { name: 'Usunąć trening?' })
  await dialog.getByRole('button', { name: 'Usuń trening', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Nie udało się zapisać zmian.')
  await expect(page).toHaveURL(/\/historia\/[^/]+$/)
  await dialog.getByRole('button', { name: 'Anuluj', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Podciąganie nachwytem', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Usuń trening z/ }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Usuń trening', exact: true }).click()
  await expect(page).toHaveURL(/\/historia$/)
  await expect(page.getByRole('heading', { name: 'Tutaj zacznie się Twoja historia' })).toBeVisible()
})
