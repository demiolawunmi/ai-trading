import { expect, test, type Page } from '@playwright/test'

const EVIDENCE_SCREENSHOT_PATH = '../../.sisyphus/evidence/task-12-e2e.png'

const goTo = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`)
}

test('connect save -> manual trade -> portfolio update -> metrics update', async ({ page }) => {
  await goTo(page, '#/connect')

  await page.getByLabel('API Key').first().fill('stocks-key-1234')
  await page.getByLabel('API Secret').first().fill('stocks-secret-1234')
  await page.getByRole('button', { name: 'Save Locally' }).first().click()

  await page.getByRole('button', { name: 'Check Connections' }).click()
  await expect(page.getByText('Connection check complete using worker status.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'connected' }).first()).toBeVisible()

  await goTo(page, '#/terminal/stocks')
  await page.getByLabel('Venue').selectOption('stocks')
  await page.getByLabel('Symbol').fill('AAPL')
  await page.getByRole('spinbutton', { name: 'Notional' }).fill('100')

  await page.getByRole('button', { name: 'Preview Quote' }).click()
  await expect(page.getByText('No quote loaded yet.')).toBeHidden()

  await page.getByRole('button', { name: 'Submit Market Order' }).click()
  await expect(page.getByText('Order accepted')).toBeVisible()

  await goTo(page, '#/portfolio')
  await page.getByLabel('Cash').fill('250000')
  await page.getByLabel('Buying Power').fill('250000')
  await page.getByRole('button', { name: 'Save Portfolio' }).click()
  await expect(page.getByText('Portfolio saved.')).toBeVisible()
  await expect(page.getByLabel('Cash')).toHaveValue('250000')
  await expect(page.getByLabel('Buying Power')).toHaveValue('250000')

  await goTo(page, '#/metrics')
  await expect(page.getByRole('table', { name: 'Metrics snapshot table' })).toBeVisible()

  await expect(page.getByText('No rows yet.')).toBeHidden()

  await page.screenshot({ path: EVIDENCE_SCREENSHOT_PATH, fullPage: true })
})
