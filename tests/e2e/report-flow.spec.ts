import { test, expect } from '@playwright/test'

// Prérequis pour que ce test tourne jusqu'au bout (au-delà de E2E_SUPABASE_EMAIL/PASSWORD) :
// le compte de test doit avoir un club ACTIVE avec au moins une équipe et
// au moins 11 joueurs actifs dans l'effectif (n'importe quelle équipe, ou
// l'équipe par défaut si le club n'en a qu'une) — la composition (Lineup)
// exige 11 titulaires placés avant de pouvoir lancer le tracker, il n'y a
// plus de "passer sans effectif" pour un compte qui a le droit d'écrire.

// Le test cree un vrai match dans la vraie base : sans ce nettoyage, chaque
// execution laissait un match fantome ("E2E FC ...") dans l'accueil du club.
// `reports` n'a PAS de ON DELETE CASCADE sur match_id (contrairement a `events`
// et `match_lineups`), donc le rapport doit etre supprime AVANT le match.
let createdMatchId: string | null = null

test.afterEach(async ({ request }) => {
  const matchId = createdMatchId
  createdMatchId = null
  if (!matchId) return

  const url = process.env.E2E_SUPABASE_URL
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY
  const email = process.env.E2E_SUPABASE_EMAIL
  const password = process.env.E2E_SUPABASE_PASSWORD
  if (!url || !anonKey || !email || !password) {
    console.warn(`[e2e] Nettoyage impossible (config Supabase absente) — match ${matchId} laisse en base.`)
    return
  }

  const auth = await request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  if (!auth.ok()) {
    console.warn(`[e2e] Nettoyage impossible (connexion refusee) — match ${matchId} laisse en base.`)
    return
  }

  const { access_token: accessToken } = await auth.json() as { access_token: string }
  const headers = { apikey: anonKey, Authorization: `Bearer ${accessToken}` }

  await request.delete(`${url}/rest/v1/reports?match_id=eq.${matchId}`, { headers })
  const deleted = await request.delete(`${url}/rest/v1/matches?id=eq.${matchId}`, { headers })
  if (!deleted.ok()) {
    console.warn(`[e2e] Suppression du match ${matchId} refusee (${deleted.status()}) — a nettoyer a la main.`)
  }
})

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

  // Retenu pour que le afterEach puisse supprimer ce match de la vraie base.
  createdMatchId = page.url().match(/\/match\/([^/]+)\/lineup/)?.[1] ?? null

  // Si l'équipe a déjà un match antérieur avec une composition enregistrée,
  // une popup "Reprendre le 11 du match précédent ?" apparaît par-dessus tout
  // l'écran (overlay plein écran) — sans la fermer, les clics suivants sur le
  // banc/le terrain sont soit bloqués soit absorbés par cet overlay. Elle
  // n'apparaît qu'après une requête réseau (checkPreviousLineup), donc il
  // faut une vraie attente qui réessaie (isVisible() ne fait qu'un seul
  // coup d'œil immédiat, sans poll — c'est ça qui ratait la popup).
  const prefillNoThanks = page.getByRole('button', { name: 'Non merci' })
  await prefillNoThanks.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {})
  if (await prefillNoThanks.isVisible()) {
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
  // Effectif connu (11 titulaires placés) : la palette ouvre PlayerEventModal
  // pour choisir le joueur sanctionné plutôt que d'enregistrer directement
  // l'événement — "Passer" confirme l'événement sans préciser de joueur.
  await page.getByRole('button', { name: 'Passer' }).click()

  await page.getByRole('button', { name: 'Terminer le match' }).click()
  await page.getByRole('button', { name: 'Terminer', exact: true }).click()

  await expect(page).toHaveURL(/\/match\/[^/]+\/report$/)

  // Le rapport se charge d'abord (spinner), puis le bouton d'analyse apparaît —
  // sans cette attente, count() vaut 0 pendant le chargement et on ne cliquait
  // simplement jamais sur "Analyser le match".
  const generateButton = page.getByRole('button', { name: /Analyser le match|Réanalyser/ })
  await generateButton.first().waitFor({ state: 'visible', timeout: 20000 })
  await generateButton.first().click()

  // L'appel à l'edge function `generate-report` (Anthropic) prend plusieurs
  // dizaines de secondes. Deux issues possibles : les sections apparaissent,
  // ou une erreur s'affiche — on attend la première des deux pour remonter le
  // vrai message d'erreur plutôt qu'un timeout opaque.
  const errorBanner = page.locator('.text-danger.bg-danger-soft')
  const firstSection = page.locator('[data-testid="report-section-01"]')

  await Promise.race([
    firstSection.waitFor({ state: 'visible', timeout: 120000 }),
    errorBanner.waitFor({ state: 'visible', timeout: 120000 }),
  ]).catch(() => {})

  if (await errorBanner.isVisible()) {
    const message = await errorBanner.textContent({ timeout: 2000 }).catch(() => null)
    throw new Error(`Génération du rapport IA en échec — message affiché : "${message?.trim() ?? '(vide)'}"`)
  }

  // Les 4 sections rédigées par l'IA (la 5e, "Axes d'amélioration", est une
  // liste et pas un paragraphe — vérifiée séparément ci-dessous).
  for (const num of ['01', '02', '03', '04']) {
    const body = page.locator(`[data-testid="report-section-${num}"] [data-testid="report-section-body"]`)
    await expect(body, `Section ${num} du rapport absente`).toBeVisible({ timeout: 30000 })
    await expect(body, `Section ${num} du rapport vide`).not.toHaveText(/^\s*$/)
  }

  await expect(page.locator('[data-testid="report-section-05"] li').first()).toBeVisible({ timeout: 10000 })
})
