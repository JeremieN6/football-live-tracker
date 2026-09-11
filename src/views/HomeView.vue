<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMatchStore } from '@/stores/match.store'
import { useAuthStore } from '@/stores/auth.store'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { useAdminClubsStore } from '@/stores/adminClubs.store'
import CreateMatchModal from '@/components/tracker/CreateMatchModal.vue'

const router = useRouter()
const matchStore = useMatchStore()
const authStore = useAuthStore()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()
const adminStore = useAdminClubsStore()

const showCreateModal = ref(false)
const loading = ref(true)

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub().catch(() => null)
    await Promise.all([
      matchStore.fetchMatches(),
      playersStore.fetchPlayers(),
      club ? teamsStore.fetchTeams(club.id) : Promise.resolve(),
    ])
    adminStore.checkAdmin().catch(() => {})
  } finally {
    loading.value = false
  }
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function teamName(id: string | null): string {
  if (!id) return 'Sans équipe'
  return teamsStore.teams.find((t) => t.id === id)?.name ?? 'Équipe inconnue'
}

async function handleSignOut() {
  await authStore.signOut()
  router.push({ name: 'auth' })
}

function openMatch(id: string, status: string) {
  router.push(status === 'FINISHED' ? { name: 'report', params: { id } } : { name: 'tracker', params: { id } })
}

// Prochains matchs : à venir ou en cours, triés du plus proche au plus loin
const upcomingMatches = computed(() =>
  [...matchStore.matches]
    .filter((m) => m.status === 'PENDING' || m.status === 'LIVE')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5),
)

// Derniers résultats : matchs terminés, du plus récent au plus ancien
const recentResults = computed(() =>
  [...matchStore.matches]
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3),
)

function resultBadge(m: { scoreHome: number; scoreAway: number }): { label: string; class: string } {
  if (m.scoreHome > m.scoreAway) return { label: 'V', class: 'text-green-400 bg-green-500/10' }
  if (m.scoreHome < m.scoreAway) return { label: 'D', class: 'text-red-400 bg-red-500/10' }
  return { label: 'N', class: 'text-neutral-400 bg-white/10' }
}

const activePlayerCount = computed(() => playersStore.players.filter((p) => p.active).length)

const clubInitial = computed(() => (clubsStore.club?.name?.trim()?.[0] ?? '?').toUpperCase())
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
          <span class="font-semibold text-sm">NRV</span>
        </div>
        <div class="flex items-center gap-4 flex-wrap justify-end">
          <button
            v-if="adminStore.isAdmin"
            class="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            @click="router.push({ name: 'admin-clubs' })"
          >
            Admin
          </button>
          <button
            class="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            @click="router.push({ name: 'members' })"
          >
            Membres
          </button>
          <button
            class="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            @click="handleSignOut"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-2xl mx-auto px-4 py-6">

      <!-- Titre club -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-semibold">{{ clubsStore.club?.name ?? 'Accueil' }}</h1>
        <button
          v-if="clubsStore.canWrite"
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

      <div v-if="loading" class="grid grid-cols-2 gap-3">
        <div v-for="i in 4" :key="i" class="h-24 rounded-2xl bg-white/5 animate-pulse" :class="i === 1 ? 'col-span-2 h-32' : ''" />
      </div>

      <!-- Grille bento -->
      <div v-else class="grid grid-cols-2 gap-3">

        <!-- Prochains matchs (pleine largeur) -->
        <div class="col-span-2 rounded-2xl bg-white/5 border border-white/8 p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500">Prochains matchs</h2>
            <button class="text-xs text-neutral-500 hover:text-white transition-colors" @click="router.push({ name: 'history' })">
              Tout voir →
            </button>
          </div>

          <p v-if="upcomingMatches.length === 0" class="text-sm text-neutral-600 py-4 text-center">
            Aucun match à venir.
          </p>

          <div v-else class="space-y-1.5">
            <button
              v-for="match in upcomingMatches"
              :key="match.id"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left"
              @click="openMatch(match.id, match.status)"
            >
              <span
                class="w-11 h-9 rounded-lg flex flex-col items-center justify-center shrink-0 text-[10px] font-semibold leading-none"
                :class="match.status === 'LIVE' ? 'bg-green-500/15 text-green-400' : 'bg-white/10 text-neutral-300'"
              >
                <template v-if="match.status === 'LIVE'">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mb-0.5" />
                  LIVE
                </template>
                <template v-else>{{ formatDate(match.date) }}</template>
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-white font-medium truncate">{{ match.homeTeam }} vs {{ match.awayTeam }}</p>
                <p class="text-xs text-neutral-500 truncate">{{ teamName(match.teamId) }}</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Effectif -->
        <button
          class="rounded-2xl bg-white/5 border border-white/8 p-4 text-left hover:bg-white/8 transition-all"
          @click="router.push({ name: 'club', query: { tab: 'roster' } })"
        >
          <p class="text-2xl font-bold text-white tabular-nums">{{ activePlayerCount }}</p>
          <p class="text-xs text-neutral-500 mt-0.5">Joueur{{ activePlayerCount > 1 ? 's' : '' }}</p>
        </button>

        <!-- Équipes -->
        <button
          class="rounded-2xl bg-white/5 border border-white/8 p-4 text-left hover:bg-white/8 transition-all"
          @click="router.push({ name: 'club', query: { tab: 'teams' } })"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center shrink-0">
              {{ clubInitial }}
            </span>
            <p class="text-2xl font-bold text-white tabular-nums">{{ teamsStore.teams.length }}</p>
          </div>
          <p class="text-xs text-neutral-500">Équipe{{ teamsStore.teams.length > 1 ? 's' : '' }}</p>
        </button>

        <!-- Derniers résultats (pleine largeur) -->
        <div v-if="recentResults.length > 0" class="col-span-2 rounded-2xl bg-white/5 border border-white/8 p-4">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">Derniers résultats</h2>
          <div class="space-y-1.5">
            <button
              v-for="match in recentResults"
              :key="match.id"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all text-left"
              @click="openMatch(match.id, match.status)"
            >
              <span class="text-xs font-bold w-6 h-6 rounded-md flex items-center justify-center shrink-0" :class="resultBadge(match).class">
                {{ resultBadge(match).label }}
              </span>
              <span class="flex-1 min-w-0 text-sm text-neutral-300 truncate">{{ match.homeTeam }} vs {{ match.awayTeam }}</span>
              <span class="text-sm font-bold tabular-nums text-white shrink-0">{{ match.scoreHome }} – {{ match.scoreAway }}</span>
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal création match -->
    <CreateMatchModal v-if="showCreateModal" @close="showCreateModal = false" />
  </div>
</template>
