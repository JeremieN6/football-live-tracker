<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMatchStore } from '@/stores/match.store'
import { useAuthStore } from '@/stores/auth.store'
import CreateMatchModal from '@/components/tracker/CreateMatchModal.vue'

const router = useRouter()
const matchStore = useMatchStore()
const authStore = useAuthStore()

const showCreateModal = ref(false)

onMounted(() => {
  matchStore.fetchMatches()
})

// Formate la date en "1 mai 2026"
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Badge couleur selon le statut du match
const statusConfig = {
  PENDING: { label: 'À venir', class: 'bg-neutral-700 text-neutral-300' },
  LIVE: { label: 'En cours', class: 'bg-green-500/20 text-green-400 animate-pulse' },
  FINISHED: { label: 'Terminé', class: 'bg-neutral-800 text-neutral-500' },
} as const

function goToTracker(id: string) {
  router.push({ name: 'tracker', params: { id } })
}

function goToReport(id: string) {
  router.push({ name: 'report', params: { id } })
}

async function handleSignOut() {
  await authStore.signOut()
  router.push({ name: 'auth' })
}

const hasMatches = computed(() => matchStore.matches.length > 0)
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white">

    <!-- Header -->
    <header class="border-b border-white/10 px-4 py-4">
      <div class="max-w-2xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-5 h-5 text-neutral-400">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20M2 12h20M12 2c-2.5 3-4 6.3-4 10s1.5 7 4 10M12 2c2.5 3 4 6.3 4 10s-1.5 7-4 10" />
          </svg>
          <span class="font-semibold text-sm">Match Report AI</span>
        </div>
        <button
          class="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          @click="handleSignOut"
        >
          Déconnexion
        </button>
      </div>
    </header>

    <!-- Contenu principal -->
    <main class="max-w-2xl mx-auto px-4 py-8">

      <!-- Titre + bouton nouveau match -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-semibold">Historique</h1>
        <button
          class="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white text-neutral-900 text-sm font-semibold
                 hover:bg-neutral-100 transition-all"
          @click="showCreateModal = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouveau match
        </button>
      </div>

      <!-- État de chargement -->
      <div v-if="matchStore.loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-20 rounded-xl bg-white/5 animate-pulse" />
      </div>

      <!-- Erreur -->
      <p v-else-if="matchStore.error" class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
        {{ matchStore.error }}
      </p>

      <!-- Liste des matchs -->
      <div v-else-if="hasMatches" class="space-y-3">
        <div
          v-for="match in matchStore.matches"
          :key="match.id"
          class="group bg-white/5 border border-white/10 rounded-xl px-4 py-4 hover:bg-white/8 hover:border-white/20 transition-all cursor-pointer"
          @click="match.status === 'FINISHED' ? goToReport(match.id) : goToTracker(match.id)"
        >
          <div class="flex items-start justify-between gap-3">

            <!-- Équipes + score -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <span class="font-semibold text-sm truncate">{{ match.homeTeam }}</span>
                <span
                  v-if="match.status !== 'PENDING'"
                  class="text-sm font-bold tabular-nums text-white shrink-0"
                >
                  {{ match.scoreHome }} – {{ match.scoreAway }}
                </span>
                <span v-else class="text-neutral-600 text-xs shrink-0">vs</span>
                <span class="font-semibold text-sm truncate">{{ match.awayTeam }}</span>
              </div>
              <div class="flex items-center gap-2 mt-1.5">
                <span class="text-xs text-neutral-500">{{ formatDate(match.date) }}</span>
                <span v-if="match.competition" class="text-neutral-700">·</span>
                <span v-if="match.competition" class="text-xs text-neutral-500 truncate">{{ match.competition }}</span>
              </div>
            </div>

            <!-- Badge statut + action -->
            <div class="flex flex-col items-end gap-2 shrink-0">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="statusConfig[match.status].class">
                {{ statusConfig[match.status].label }}
              </span>
              <span class="text-xs text-neutral-600 group-hover:text-neutral-400 transition-colors">
                {{ match.status === 'FINISHED' ? 'Voir le rapport →' : 'Continuer →' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- État vide -->
      <div v-else class="text-center py-20">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-7 h-7 text-neutral-600">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20M2 12h20M12 2c-2.5 3-4 6.3-4 10s1.5 7 4 10M12 2c2.5 3 4 6.3 4 10s-1.5 7-4 10" />
          </svg>
        </div>
        <p class="text-neutral-400 font-medium mb-1">Aucun match pour l'instant</p>
        <p class="text-sm text-neutral-600 mb-6">Créez votre premier match pour commencer l'analyse.</p>
        <button
          class="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-white text-neutral-900 text-sm font-semibold
                 hover:bg-neutral-100 transition-all"
          @click="showCreateModal = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouveau match
        </button>
      </div>
    </main>

    <!-- Modal création match -->
    <CreateMatchModal v-if="showCreateModal" @close="showCreateModal = false" />
  </div>
</template>
