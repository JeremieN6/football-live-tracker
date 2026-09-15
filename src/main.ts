import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as Sentry from '@sentry/vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)

// Monitoring d'erreurs — désactivé tant que VITE_SENTRY_DSN n'est pas défini
// (dev local sans compte Sentry configuré, ou avant que la variable soit
// posée sur l'environnement de build du VPS).
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
if (sentryDsn) {
  Sentry.init({
    app,
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration({ router })],
    tracesSampleRate: 0.2,
  })
}

app.use(createPinia())

// Initialise la session auth AVANT d'installer le routeur : app.use(router)
// déclenche la navigation initiale (et donc la garde d'authentification) dès
// son appel, pas seulement au montage. Si le routeur est installé avant que
// authStore.user soit restauré depuis la session persistée, la garde le
// trouve encore à null et redirige vers /auth même avec une session valide.
import('./stores/auth.store').then(async ({ useAuthStore }) => {
  const authStore = useAuthStore()
  await authStore.init()
  app.use(router)
  app.mount('#app')
})
