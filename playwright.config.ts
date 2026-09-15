import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

// Charge tests/../.env.e2e.local (E2E_SUPABASE_EMAIL/PASSWORD) sans
// dépendance dotenv — rien ne lisait ce fichier jusque-là, le test se
// contentait de le "skip" silencieusement faute de variables définies.
const envFile = '.env.e2e.local'
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].trim()
  }
}

const port = 4173

export default defineConfig({
  testDir: './tests/e2e',
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
