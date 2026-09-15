import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Charge les fichiers d'environnement locaux sans dependance dotenv.
// - .env.e2e.local : identifiants du compte de test (E2E_SUPABASE_EMAIL/PASSWORD)
// - .env.local     : config Vite deja presente pour lancer l'app ; on y recupere
//   l'URL et la cle anon pour que le test puisse supprimer lui-meme le match
//   qu'il vient de creer (sinon chaque execution laisse un match fantome dans la
//   vraie base). Rien de plus a renseigner a la main de ce fait.
function loadEnvFile(fileName: string): Record<string, string> {
  const envPath = resolve(process.cwd(), fileName)
  const values: Record<string, string> = {}
  if (!existsSync(envPath)) {
    console.log(`[playwright.config] Aucun ${fileName} trouve a ${envPath}.`)
    return values
  }
  for (const rawLine of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
  }
  console.log(`[playwright.config] ${fileName} trouve (${envPath}) — ${Object.keys(values).length} variable(s) chargee(s).`)
  return values
}

for (const [key, value] of Object.entries(loadEnvFile('.env.e2e.local'))) {
  process.env[key] = value
}

// L'URL/cle anon viennent de .env.local (config Vite), sans ecraser une valeur
// deja posee explicitement dans .env.e2e.local.
const viteEnv = loadEnvFile('.env.local')
process.env.E2E_SUPABASE_URL ??= viteEnv.VITE_SUPABASE_URL
process.env.E2E_SUPABASE_ANON_KEY ??= viteEnv.VITE_SUPABASE_ANON_KEY

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
