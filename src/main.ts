import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)

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
