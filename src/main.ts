import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Initialise la session auth avant le montage
import('./stores/auth.store').then(({ useAuthStore }) => {
  const authStore = useAuthStore()
  authStore.init().then(() => {
    app.mount('#app')
  })
})
