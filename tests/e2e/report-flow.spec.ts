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

    // Si la connexion échoue (mauvais identifiants...), l'app affiche un
    // message d'erreur sur /auth au lieu de rediriger — on le récupère
    // (avec un timeout court, sinon l'attente d'un élément absent bloque
    // jusqu'au timeout global du test) pour un message d'échec clair.
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 8000 }).catch(() => {})
    if (page.url().includes('/auth')) {
      const errorText = await page.locator('.text-danger').first().textContent({ timeout: 2000 }).catch(() => null)
      throw new Error(`Connexion échouée, toujours sur /auth après 8s${errorText ? ` — message affiché : "${errorText.trim()}"` : ' — aucun message d\'erreur visible.'}`)
    }
  }

  // Le compte de test doit atterrir sur /home (club ACTIVE, ni en attente de
  // validation ni sans club) — si ce n'est pas le cas, page.url() ci-dessous
  // dans le message d'échec dit où il a atterri à la place (ex: /pending,
  // /create-club, /claim-profile).
  await expect(page, `URL inattendue après connexion : ${page.url()}`).toHaveURL(/\/home$/, { timeout: 10000 })

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

  // Si l'équipe a déjà un match antérieur avec une composition enregistrée,
  // une popup "Reprendre le 11 du match précédent ?" apparaît par-dessus tout
  // l'écran (overlay plein écran) — sans la fermer, les clics suivants sur le
  // banc/le terrain sont soit bloqués soit absorbés par cet overlay, d'où des
  // placements qui se perdaient de façon incohérente selon le timing.
  const prefillNoThanks = page.getByRole('button', { name: 'Non merci' })
  if (await prefillNoThanks.isVisible({ timeout: 3000 }).catch(() => false)) {
    await prefillNoThanks.click()
  }

  // Place les 11 premiers joueurs du banc sur les 11 premières positions du
  // terrain, un par un (peu importe le poste réel — seul le compte de 11
  // compte). Le compteur "X/11 placés" est ré-attendu après chaque paire de
  // clics (expect().toHaveText() attend/réessaie tout seul) : sans ça, les
  // clics partaient plus vite que la mise à jour de l'état côté app, et un
  // clic sur une position déjà occupée sans joueur sélectionné la
  // DÉ-place (comportement voulu du tap-to-place) au lieu de la remplir —
  // d'où des placements qui se perdaient silencieusement en cours de route.
  const slots = page.locator('[data-testid^="lineup-slot-"]')
  const benchPlayers = page.locator('[data-testid="lineup-bench-player"]')
  const counter = page.locator('text=/\\/11 placés/')
  const slotCount = await slots.count()
  const benchCount = await benchPlayers.count()

  if (benchCount < 11) {
    throw new Error(
      `Effectif insuffisant : ${benchCount} joueur(s) actif(s) trouvé(s), il en faut au moins 11 pour que ce test aille au bout.`,
    )
  }

  for (let i = 0; i < Math.min(11, slotCount); i++) {
    await benchPlayers.first().click()
    await slots.nth(i).click()
    await expect(counter).toHaveText(`${i + 1}/11 placés`, { timeout: 5000 })
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
