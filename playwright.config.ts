import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Charge .env.e2e.local (E2E_SUPABASE_EMAIL/PASSWORD) sans dépendance
// dotenv — rien ne lisait ce fichier jusque-là, le test se contentait de le
// "skip" silencieusement faute de variables définies. Diagnostic affiché à
// chaque lancement pour ne plus jamais échouer en silence sur ce point.
const envPath = resolve(process.cwd(), '.env.e2e.local')
if (existsSync(envPath)) {
  let loaded = 0
  for (const rawLine of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    process.env[match[1]] = value
    loaded++
  }
  console.log(`[playwright.config] .env.e2e.local trouvé (${envPath}) — ${loaded} variable(s) chargée(s).`)
} else {
  console.log(`[playwright.config] Aucun .env.e2e.local trouvé à ${envPath} — le test e2e sera "skipped".`)
}

const port = 4173

export default defineConfig({
  testDir: './tests/e2e',
  // Le parcours complet (connexion -> match -> composition -> tracker ->
  // rapport IA) dépasse largement le timeout par défaut de 30s, ne serait-ce
  // que par l'appel à l'edge function `generate-report` (Anthropic) qui prend
  // à lui seul plusieurs dizaines de secondes. Sans ça, aucun `timeout:` posé
  // sur une assertion individuelle ne peut servir : le test est tué avant.
  timeout: 180000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
