<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { usePlayersStore } from '@/stores/players.store'
import { usePlayerProfileStore } from '@/stores/playerProfile.store'
import { useTeamsStore } from '@/stores/teams.store'
import { useClubsStore } from '@/stores/clubs.store'
import AppHeader from '@/components/AppHeader.vue'
import ClubCrest from '@/components/ClubCrest.vue'
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

const statItems = () => [
  { label: 'Matchs joués', value: profileStore.totals.matchesPlayed },
  { label: 'Titularisations', value: profileStore.totals.starts },
  { label: 'Buts', value: profileStore.totals.goals },
  { label: 'Passes décisives', value: profileStore.totals.assists },
  { label: 'Cartons jaunes', value: profileStore.totals.yellowCards },
  { label: 'Cartons rouges', value: profileStore.totals.redCards },
  { label: 'Entrées en jeu', value: profileStore.totals.subAppearances },
  { label: 'Banc non utilisé', value: profileStore.totals.unusedBench },
]
</script>

<template>
  <div class="min-h-screen bg-app flex flex-col text-ink">

    <AppHeader />

    <!-- Header -->
    <div class="flex-none sticky top-0 z-30 bg-app/90 backdrop-blur-sm border-b border-line px-4 py-3 flex items-center gap-2.5">
      <button
        class="p-1 -ml-1 text-ink-meta hover:text-ink transition-colors"
        @click="router.push({ name: 'club', query: { tab: 'roster' } })"
      >
        <ArrowLeft :size="18" :stroke-width="2" />
      </button>
      <ClubCrest :logo-url="clubsStore.club?.logoUrl" :name="clubsStore.club?.name" size="sm" />
      <div class="flex-1 min-w-0">
        <h1 class="text-sm font-semibold text-ink truncate">{{ player?.name ?? 'Joueur' }}</h1>
        <p v-if="player" class="text-[11px] text-ink-meta truncate">
          {{ player.number != null ? `#${player.number}` : 'Sans numéro' }}<span v-if="player.position"> · {{ player.position }}</span> · {{ teamName(player.teamId) }}
        </p>
      </div>
    </div>

    <div class="px-4 pt-5 pb-8 max-w-2xl mx-auto w-full">

      <p v-if="clubsStore.error || profileStore.error" class="mb-4 text-sm text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2">
        {{ clubsStore.error || profileStore.error }}
      </p>

      <div v-if="profileStore.loading" class="flex items-center justify-center py-16">
        <div class="w-6 h-6 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
      </div>

      <template v-else>
        <!-- Grille de stats globales -->
        <div class="grid grid-cols-2 gap-2 mb-5">
          <div
            v-for="item in statItems()"
            :key="item.label"
            class="bg-surface border border-line rounded-card px-3.5 py-3"
          >
            <p class="text-[11px] text-ink-meta mb-1">{{ item.label }}</p>
            <p class="font-score text-lg font-bold text-ink">{{ item.value }}</p>
          </div>
        </div>

        <!-- Minutes jouées -->
        <div class="bg-surface border border-line rounded-card px-4 py-3.5 mb-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[11px] text-ink-meta mb-1">Minutes jouées (total)</p>
              <p class="font-score text-lg font-bold text-ink">{{ profileStore.totals.totalMinutes }}'</p>
            </div>
            <div class="text-right">
              <p class="text-[11px] text-ink-meta mb-1">Moyenne / match</p>
              <p class="font-score text-lg font-bold text-ink">
                {{ profileStore.totals.averageMinutes != null ? `${profileStore.totals.averageMinutes}'` : '—' }}
              </p>
            </div>
          </div>
          <p v-if="!profileStore.totals.minutesKnownForAll" class="text-[11px] text-ink-disabled mt-2 leading-[1.5]">
            Certains matchs terminés avant cette fonctionnalité n'ont pas de durée enregistrée : les minutes jouées sur ces matchs ne sont pas comptées.
          </p>
        </div>

        <!-- Renforts avec une autre équipe -->
        <div v-if="profileStore.totals.calledUpCount > 0" class="bg-brand-soft border border-brand-line rounded-card px-4 py-3 mb-5">
          <p class="text-sm text-brand-ink">
            Appelé en renfort avec une autre équipe sur {{ profileStore.totals.calledUpCount }} match{{ profileStore.totals.calledUpCount > 1 ? 's' : '' }}
          </p>
        </div>

        <!-- Détail par match -->
        <h2 class="text-[11px] font-medium tracking-[.5px] text-ink-secondary mb-3">Historique des matchs</h2>

        <p v-if="profileStore.appearances.length === 0" class="text-sm text-ink-meta text-center py-8">
          Ce joueur n'a encore été sélectionné pour aucun match.
        </p>

        <div v-else class="flex flex-col gap-1.5">
          <button
            v-for="a in profileStore.appearances"
            :key="a.match.id"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-card bg-surface border border-line hover:bg-surface-hover transition-colors text-left"
            @click="router.push({ name: 'report', params: { id: a.match.id } })"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm text-ink font-medium truncate">
                {{ a.match.homeTeam }} vs {{ a.match.awayTeam }}
              </p>
              <p class="text-[11px] text-ink-meta">
                {{ formatDate(a.match.date) }} · {{ statusLabel(a.role, a.enteredAsSub) }}
                <span v-if="a.minutesPlayed != null"> · {{ a.minutesPlayed }}'</span>
                <span v-if="a.calledUp" class="text-brand-ink"> · {{ teamName(a.match.teamId) }}</span>
              </p>
            </div>
            <div class="flex items-center gap-2 text-[11px] font-data shrink-0">
              <span v-if="a.goals > 0" class="text-[#60A5FA]">B×{{ a.goals }}</span>
              <span v-if="a.assists > 0" class="text-[#22D3EE]">PD×{{ a.assists }}</span>
              <span v-if="a.yellowCards > 0" class="text-[#FBBF24]">J×{{ a.yellowCards }}</span>
              <span v-if="a.redCards > 0" class="text-danger">R</span>
            </div>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
