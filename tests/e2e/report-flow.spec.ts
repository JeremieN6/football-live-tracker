import { test, expect } from '@playwright/test'

test('flow create match to report generation', async ({ page }) => {
  const email = process.env.E2E_SUPABASE_EMAIL
  const password = process.env.E2E_SUPABASE_PASSWORD

  test.skip(!email || !password, 'Set E2E_SUPABASE_EMAIL and E2E_SUPABASE_PASSWORD to run e2e tests.')

  await page.goto('/auth')

  if (page.url().includes('/auth')) {
    await page.fill('#email', email ?? '')
    await page.fill('#password', password ?? '')
    await page.getByRole('button', { name: 'Se connecter' }).click()
  }

  await expect(page).toHaveURL(/\/history$/)

  const uniqueSuffix = Date.now().toString().slice(-6)
  const homeTeam = `E2E FC ${uniqueSuffix}`
  const awayTeam = `E2E US ${uniqueSuffix}`

  await page.getByRole('button', { name: 'Nouveau match' }).click()
  await page.getByPlaceholder('Ex: Lyon').fill(homeTeam)
  await page.getByPlaceholder('Ex: Marseille').fill(awayTeam)
  await page.getByPlaceholder('Ex: Championnat R1, Coupe Régionale...').fill('E2E Test League')
  await page.getByRole('button', { name: 'Démarrer' }).click()

  await expect(page).toHaveURL(/\/match\/[^/]+$/)

  await page.getByRole('button', { name: '🟨 Carton jaune' }).click()

  await page.getByRole('button', { name: 'Terminer le match' }).click()
  await page.getByRole('button', { name: 'Terminer' }).click()

  await expect(page).toHaveURL(/\/match\/[^/]+\/report$/)

  const generateButton = page.getByRole('button', { name: /Générer l'analyse IA|Regénérer/ })
  if (await generateButton.count()) {
    await generateButton.first().click()
  }

  const summaryText = page.locator('h3:has-text("Résumé") + p')
  const offensiveText = page.locator('h3:has-text("Jeu offensif") + p')
  const defensiveText = page.locator('h3:has-text("Jeu défensif") + p')
  const tacticalText = page.locator('h3:has-text("Lecture tactique") + p')

  await expect(summaryText).toBeVisible({ timeout: 30000 })
  await expect(offensiveText).toBeVisible({ timeout: 30000 })
  await expect(defensiveText).toBeVisible({ timeout: 30000 })
  await expect(tacticalText).toBeVisible({ timeout: 30000 })

  await expect(summaryText).not.toHaveText(/^\s*$/)
  await expect(offensiveText).not.toHaveText(/^\s*$/)
  await expect(defensiveText).not.toHaveText(/^\s*$/)
  await expect(tacticalText).not.toHaveText(/^\s*$/)
})
