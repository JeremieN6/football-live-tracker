import { test, expect } from '@playwright/test'

// Prérequis pour que ce test tourne jusqu'au bout (au-delà de E2E_SUPABASE_EMAIL/PASSWORD) :
// le compte de test doit avoir un club ACTIVE avec au moins une équipe et
// au moins 11 joueurs actifs dans l'effectif (n'importe quelle équipe, ou
// l'équipe par défaut si le club n'en a qu'une) — la composition (Lineup)
// exige 11 titulaires placés avant de pouvoir lancer le tracker, il n'y a
// plus de "passer sans effectif" pour un compte qui a le droit d'écrire.
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

  await expect(page).toHaveURL(/\/home$/)

  const uniqueSuffix = Date.now().toString().slice(-6)
  const homeTeam = `E2E FC ${uniqueSuffix}`
  const awayTeam = `E2E US ${uniqueSuffix}`

  await page.getByRole('button', { name: /Créer un match/ }).click()
  await page.getByPlaceholder('Ex: Lyon').fill(homeTeam)
  await page.getByPlaceholder('Ex: Marseille').fill(awayTeam)
  await page.getByPlaceholder('Ex: Championnat R1, Coupe Régionale...').fill('E2E Test League')
  await page.getByRole('button', { name: 'Démarrer' }).click()

  // La création redirige vers la composition (Lineup), pas directement vers le tracker.
  await expect(page).toHaveURL(/\/match\/[^/]+\/lineup$/)

  // Place les 11 premiers joueurs du banc sur les 11 premières positions du
  // terrain, un par un (peu importe le poste réel — seul le compte de 11 compte).
  const slots = page.locator('[data-testid^="lineup-slot-"]')
  const slotCount = await slots.count()
  for (let i = 0; i < Math.min(11, slotCount); i++) {
    await page.locator('[data-testid="lineup-bench-player"]').first().click()
    await slots.nth(i).click()
  }

  await page.getByRole('button', { name: 'Lancer le tracker' }).click()

  await expect(page).toHaveURL(/\/match\/[^/]+$/)

  await page.getByRole('button', { name: 'Carton jaune' }).click()
  // Effectif connu (11 titulaires placés) : la palette ouvre CardPlayerModal
  // pour choisir le joueur sanctionné plutôt que d'enregistrer directement
  // l'événement — "Passer" confirme l'événement sans préciser de joueur.
  await page.getByRole('button', { name: 'Passer' }).click()

  await page.getByRole('button', { name: 'Terminer le match' }).click()
  await page.getByRole('button', { name: 'Terminer', exact: true }).click()

  await expect(page).toHaveURL(/\/match\/[^/]+\/report$/)

  const generateButton = page.getByRole('button', { name: /Analyser le match|Réanalyser/ })
  if (await generateButton.count()) {
    await generateButton.first().click()
  }

  const summaryText = page.getByRole('heading', { name: 'Résumé du match' }).locator('xpath=../..').locator('p').first()
  const offensiveText = page.getByRole('heading', { name: 'Jeu offensif' }).locator('xpath=../..').locator('p').first()
  const defensiveText = page.getByRole('heading', { name: 'Jeu défensif' }).locator('xpath=../..').locator('p').first()
  const tacticalText = page.getByRole('heading', { name: 'Lecture tactique' }).locator('xpath=../..').locator('p').first()

  await expect(summaryText).toBeVisible({ timeout: 30000 })
  await expect(offensiveText).toBeVisible({ timeout: 30000 })
  await expect(defensiveText).toBeVisible({ timeout: 30000 })
  await expect(tacticalText).toBeVisible({ timeout: 30000 })

  await expect(summaryText).not.toHaveText(/^\s*$/)
  await expect(offensiveText).not.toHaveText(/^\s*$/)
  await expect(defensiveText).not.toHaveText(/^\s*$/)
  await expect(tacticalText).not.toHaveText(/^\s*$/)
})
