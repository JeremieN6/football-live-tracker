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
    path: '/pending',
    name: 'pending',
    component: () => import('@/views/PendingApprovalView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/create-club',
    name: 'create-club',
    component: () => import('@/views/CreateClubView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/clubs',
    name: 'admin-clubs',
    component: () => import('@/views/AdminClubsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/teams',
    name: 'teams',
    component: () => import('@/views/TeamsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/members',
    name: 'members',
    component: () => import('@/views/MembersView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/roster',
    name: 'roster',
    component: () => import('@/views/RosterView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/roster/:id',
    name: 'player-profile',
    component: () => import('@/views/PlayerProfileView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/match/:id/lineup',
    name: 'lineup',
    component: () => import('@/views/LineupView.vue'),
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

// Guard : redirige vers /auth si non connecté, vers /create-club si
// l'utilisateur n'a encore ni club ni invitation, vers /pending si son club
// n'est pas encore validé par l'administrateur.
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true

  // Import dynamique pour éviter la dépendance circulaire au démarrage
  const { useAuthStore } = await import('@/stores/auth.store')
  const authStore = useAuthStore()

  if (!authStore.user) {
    return { name: 'auth' }
  }

  // La page admin gère son propre contrôle d'accès (RLS + vérification
  // isAdmin dans la vue) : un admin doit pouvoir y accéder même si son
  // propre club (s'il en a un) est en attente ou inexistant.
  if (to.name === 'admin-clubs') return true

  const { useClubsStore, ClubNotFoundError } = await import('@/stores/clubs.store')
  const clubsStore = useClubsStore()

  if (!clubsStore.club) {
    try {
      await clubsStore.ensureClub()
    } catch (err) {
      if (err instanceof ClubNotFoundError) {
        return to.name === 'create-club' ? true : { name: 'create-club' }
      }
      // Laisse la vue cible gérer/afficher l'erreur, comme avant ce guard.
      return true
    }
  }

  if (clubsStore.club?.status === 'PENDING') {
    return to.name === 'pending' ? true : { name: 'pending' }
  }

  // Le club est actif : /pending et /create-club n'ont plus lieu d'être.
  if (to.name === 'pending' || to.name === 'create-club') {
    return { name: 'history' }
  }

  return true
})

export default router
