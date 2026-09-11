<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players.store'
import { usePlayerProfileStore } from '@/stores/playerProfile.store'
import { useTeamsStore } from '@/stores/teams.store'
import { useClubsStore } from '@/stores/clubs.store'
import type { Player } from '@/types/match.types'

const route = useRoute()
const router = useRouter()
const playersStore = usePlayersStore()
const profileStore = usePlayerProfileStore()
const teamsStore = useTeamsStore()
const clubsStore = useClubsStore()

const playerId = route.params.id as string
const player = ref<Player | null>(null)

onMounted(async () => {
  profileStore.reset()
  try {
    const club = await clubsStore.ensureClub()
    await Promise.all([
      playersStore.players.length === 0 ? playersStore.fetchPlayers() : Promise.resolve(),
      teamsStore.fetchTeams(club.id),
    ])
    player.value = playersStore.players.find((p) => p.id === playerId) ?? null
    await profileStore.fetchProfile(playerId, player.value?.teamId ?? null)
  } catch {
    // clubsStore.error / profileStore.error portent déjà le message, affiché dans le template
  }
})

function teamName(teamId: string | null): string {
  if (!teamId) return 'Équipe non renseignée'
  return teamsStore.teams.find((t) => t.id === teamId)?.name ?? 'Équipe inconnue'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusLabel(role: string, enteredAsSub: boolean): string {
  if (role === 'STARTER') return 'Titulaire'
  if (enteredAsSub) return 'Entré en jeu'
  return 'Banc (non utilisé)'
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white pb-20">

    <!-- Header -->
    <div class="sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center gap-3">
      <button
        class="text-neutral-500 hover:text-white transition-colors p-1 -ml-1"
        @click="router.push({ name: 'roster' })"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-sm font-semibold text-white truncate">{{ player?.name ?? 'Joueur' }}</h1>
        <p v-if="player" class="text-xs text-neutral-500">
          {{ player.number != null ? `#${player.number}` : 'Sans numéro' }}<span v-if="player.position"> · {{ player.position }}</span> · {{ teamName(player.teamId) }}
        </p>
      </div>
    </div>

    <div class="px-4 pt-5 max-w-2xl mx-auto">

      <p v-if="clubsStore.error || profileStore.error" class="mb-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
        {{ clubsStore.error || profileStore.error }}
      </p>

      <div v-if="profileStore.loading" class="flex items-center justify-center py-16">
        <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>

      <template v-else>
        <!-- Grille de stats globales -->
        <div class="grid grid-cols-2 gap-2 mb-6">
          <div
            v-for="item in [
              { label: 'Matchs joués', value: profileStore.totals.matchesPlayed, color: 'text-white' },
              { label: 'Titularisations', value: profileStore.totals.starts, color: 'text-green-400' },
              { label: '⚽ Buts', value: profileStore.totals.goals, color: 'text-blue-400' },
              { label: '🎯 Passes décisives', value: profileStore.totals.assists, color: 'text-cyan-400' },
              { label: '🟨 Cartons jaunes', value: profileStore.totals.yellowCards, color: 'text-yellow-400' },
              { label: '🟥 Cartons rouges', value: profileStore.totals.redCards, color: 'text-red-500' },
              { label: 'Entrées en jeu', value: profileStore.totals.subAppearances, color: 'text-neutral-300' },
              { label: 'Banc non utilisé', value: profileStore.totals.unusedBench, color: 'text-neutral-500' },
            ]"
            :key="item.label"
            class="bg-white/5 border border-white/8 rounded-xl px-3 py-3"
          >
            <p class="text-xs text-neutral-500 mb-1">{{ item.label }}</p>
            <p class="text-lg font-bold" :class="item.color">{{ item.value }}</p>
          </div>
        </div>

        <!-- Minutes jouées -->
        <div class="bg-white/5 border border-white/8 rounded-xl px-4 py-3 mb-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-neutral-500 mb-1">Minutes jouées (total)</p>
              <p class="text-lg font-bold text-white">{{ profileStore.totals.totalMinutes }}'</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-neutral-500 mb-1">Moyenne / match</p>
              <p class="text-lg font-bold text-white">
                {{ profileStore.totals.averageMinutes != null ? `${profileStore.totals.averageMinutes}'` : '—' }}
              </p>
            </div>
          </div>
          <p v-if="!profileStore.totals.minutesKnownForAll" class="text-xs text-neutral-600 mt-2">
            Certains matchs terminés avant cette fonctionnalité n'ont pas de durée enregistrée : les minutes jouées sur ces matchs ne sont pas comptées.
          </p>
        </div>

        <!-- Renforts avec une autre équipe -->
        <div v-if="profileStore.totals.calledUpCount > 0" class="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 mb-6">
          <p class="text-sm text-violet-300">
            ⭐ Appelé en renfort avec une autre équipe sur {{ profileStore.totals.calledUpCount }} match{{ profileStore.totals.calledUpCount > 1 ? 's' : '' }}
          </p>
        </div>

        <!-- Détail par match -->
        <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">Historique des matchs</h2>

        <p v-if="profileStore.appearances.length === 0" class="text-sm text-neutral-600 text-center py-8">
          Ce joueur n'a encore été sélectionné pour aucun match.
        </p>

        <div v-else class="space-y-1.5">
          <button
            v-for="a in profileStore.appearances"
            :key="a.match.id"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-all text-left"
            @click="router.push({ name: 'report', params: { id: a.match.id } })"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white font-medium truncate">
                {{ a.match.homeTeam }} vs {{ a.match.awayTeam }}
              </p>
              <p class="text-xs text-neutral-500">
                {{ formatDate(a.match.date) }} · {{ statusLabel(a.role, a.enteredAsSub) }}
                <span v-if="a.minutesPlayed != null"> · {{ a.minutesPlayed }}'</span>
                <span v-if="a.calledUp" class="text-violet-400"> · ⭐ {{ teamName(a.match.teamId) }}</span>
              </p>
            </div>
            <div class="flex items-center gap-2 text-xs shrink-0">
              <span v-if="a.goals > 0" class="text-blue-400">⚽×{{ a.goals }}</span>
              <span v-if="a.assists > 0" class="text-cyan-400">🎯×{{ a.assists }}</span>
              <span v-if="a.yellowCards > 0" class="text-yellow-400">🟨×{{ a.yellowCards }}</span>
              <span v-if="a.redCards > 0" class="text-red-500">🟥</span>
            </div>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
