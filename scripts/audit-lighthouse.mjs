import { mkdir, writeFile } from 'node:fs/promises'
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'

const url = process.argv[2] ?? 'http://localhost:4173'
await mkdir('reports/lighthouse', { recursive: true })
const chrome = await launch({ chromeFlags: ['--headless=new'] })
try {
  const result = await lighthouse(url, {
    port: chrome.port,
    output: ['html', 'json'],
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: 'mobile',
  })
  if (!result) throw new Error('Lighthouse did not return a report.')
  await writeFile('reports/lighthouse/mobile.html', result.report[0])
  await writeFile('reports/lighthouse/mobile.json', result.report[1])
  for (const category of Object.values(result.lhr.categories)) {
    console.log(`${category.title}: ${category.score === null ? 'n/a' : Math.round(category.score * 100)}`)
  }
  console.log('Reports: reports/lighthouse/mobile.html and mobile.json')
  if (result.lhr.runtimeError) throw new Error(result.lhr.runtimeError.message)
} finally {
  await chrome.kill()
}
