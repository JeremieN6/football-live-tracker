import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/history',
  },
  {
    path: '/auth',
    name: 'auth',
    component: () => import('@/views/AuthView.vue'),
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/match/:id',
    name: 'tracker',
    component: () => import('@/views/TrackerView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/match/:id/report',
    name: 'report',
    component: () => import('@/views/ReportView.vue'),
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Guard : redirige vers /auth si non connecté
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true

  // Import dynamique pour éviter la dépendance circulaire au démarrage
  const { useAuthStore } = await import('@/stores/auth.store')
  const authStore = useAuthStore()

  if (!authStore.user) {
    return { name: 'auth' }
  }

  return true
})

export default router
