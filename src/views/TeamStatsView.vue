<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/services/supabase'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { useMatchStore } from '@/stores/match.store'
import { outcomeFor, displayScore } from '@/lib/matchBadges'
import { MATCH_TYPE_FILTER_LABELS, MATCH_TYPES, type MatchTypeFilter } from '@/lib/matchType'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()
const router = useRouter()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const matchStore = useMatchStore()

const teamId = route.params.id as string
const loading = ref(true)
const errorMessage = ref<string | null>(null)

// Filtre par type de match (championnat/coupe/amical) — s'applique au bilan,
// au split domicile/exterieur, à la discipline et aux derniers matchs affichés.
const typeFilter = ref<MatchTypeFilter>('ALL')
const filterOptions = ['ALL', ...MATCH_TYPES] as const

// Evénements bruts (type + match_id) de TOUS les matchs terminés de l'équipe,
// récupérés une seule fois au montage — le filtre par type de match ne
// nécessite donc aucun refetch, juste un recalcul côté client.
const rawEvents = ref<{ matchId: string; type: string }[]>([])

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub()
    await Promise.all([
      teamsStore.teams.length === 0 ? teamsStore.fetchTeams(club.id) : Promise.resolve(),
      matchStore.fetchMatches(),
    ])

    const matchIds = allFinishedMatches.value.map((m) => m.id)
    if (matchIds.length > 0) {
      const { data, error: sbError } = await supabase
        .from('events')
        .select('type, match_id')
        .in('match_id', matchIds)
      if (sbError) throw sbError
      rawEvents.value = (data ?? []).map((row) => ({ matchId: row.match_id as string, type: row.type as string }))
    }
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Erreur lors du chargement des statistiques.'
  } finally {
    loading.value = false
  }
})

const team = computed(() => teamsStore.teams.find((t) => t.id === teamId) ?? null)

const allFinishedMatches = computed(() =>
  matchStore.matches.filter((m) => m.teamId === teamId && m.status === 'FINISHED'),
)

const finishedMatches = computed(() =>
  typeFilter.value === 'ALL'
    ? allFinishedMatches.value
    : allFinishedMatches.value.filter((m) => m.matchType === typeFilter.value),
)

interface EventCounts {
  yellowCards: number
  redCards: number
  foulsCommitted: number
  foulsSuffered: number
}
const eventCounts = computed<EventCounts>(() => {
  const matchIds = new Set(finishedMatches.value.map((m) => m.id))
  const counts: EventCounts = { yellowCards: 0, redCards: 0, foulsCommitted: 0, foulsSuffered: 0 }
  for (const e of rawEvents.value) {
    if (!matchIds.has(e.matchId)) continue
    switch (e.type) {
      case 'YELLOW_CARD': counts.yellowCards++; break
      case 'RED_CARD': counts.redCards++; break
      case 'FOUL_COMMITTED': counts.foulsCommitted++; break
      case 'FOUL_SUFFERED': counts.foulsSuffered++; break
    }
  }
  return counts
})

interface Summary {
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  homeWins: number
  homePlayed: number
  awayWins: number
  awayPlayed: number
}

const summary = computed<Summary>(() => {
  const s: Summary = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, homeWins: 0, homePlayed: 0, awayWins: 0, awayPlayed: 0 }
  for (const m of finishedMatches.value) {
    s.played++
    s.goalsFor += m.scoreHome
    s.goalsAgainst += m.scoreAway
    const outcome = outcomeFor(m.scoreHome, m.scoreAway)
    if (outcome === 'V') s.wins++
    else if (outcome === 'N') s.draws++
    else s.losses++

    if (m.isHome) {
      s.homePlayed++
      if (outcome === 'V') s.homeWins++
    } else {
      s.awayPlayed++
      if (outcome === 'V') s.awayWins++
    }
  }
  return s
})

const recentMatches = computed(() =>
  [...finishedMatches.value].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="min-h-screen bg-app flex flex-col text-ink">

    <AppHeader back />

    <div class="flex-none px-4 pt-3.5 pb-2">
      <h1 class="text-[20px] font-semibold text-ink truncate">{{ team?.name ?? 'Équipe' }}</h1>
      <p v-if="team?.category" class="text-[11px] text-ink-meta">{{ team.category }}</p>
    </div>

    <main class="flex-1 px-4 pb-8 max-w-lg w-full mx-auto">

      <div v-if="loading" class="py-10 text-center text-sm text-ink-meta">Chargement…</div>

      <p v-else-if="errorMessage" class="text-sm text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2">
        {{ errorMessage }}
      </p>

      <template v-else>
        <!-- Filtre par type de match -->
        <div v-if="allFinishedMatches.length > 0" class="flex items-center gap-1.5 mb-3 overflow-x-auto [scrollbar-width:none]">
          <button
            v-for="opt in filterOptions"
            :key="opt"
            class="flex-none h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap border transition-colors"
            :class="typeFilter === opt ? 'bg-brand-soft border-brand-line text-brand-ink' : 'bg-surface border-line text-ink-secondary'"
            @click="typeFilter = opt"
          >
            {{ MATCH_TYPE_FILTER_LABELS[opt] }}
          </button>
        </div>

        <p v-if="summary.played === 0" class="text-sm text-ink-meta text-center py-10">
          {{ allFinishedMatches.length === 0 ? "Aucun match terminé pour cette équipe pour l'instant." : 'Aucun match pour ce type de match.' }}
        </p>

        <template v-else>
        <!-- Bilan -->
        <div class="grid grid-cols-3 gap-2 mb-2.5">
          <div class="bg-surface border border-line rounded-card px-3 py-3 text-center">
            <p class="font-score text-xl font-bold text-ink">{{ summary.played }}</p>
            <p class="text-[11px] text-ink-meta mt-0.5">Matchs</p>
          </div>
          <div class="bg-surface border border-line rounded-card px-3 py-3 text-center">
            <p class="font-score text-xl font-bold text-ink">{{ summary.goalsFor }}-{{ summary.goalsAgainst }}</p>
            <p class="text-[11px] text-ink-meta mt-0.5">Buts P/C</p>
          </div>
          <div class="bg-surface border border-line rounded-card px-3 py-3 text-center">
            <p class="font-score text-xl font-bold text-brand-ink">{{ summary.wins }}V {{ summary.draws }}N {{ summary.losses }}D</p>
            <p class="text-[11px] text-ink-meta mt-0.5">Résultats</p>
          </div>
        </div>

        <!-- Domicile / extérieur -->
        <div class="grid grid-cols-2 gap-2 mb-2.5">
          <div class="bg-surface border border-line rounded-card px-3.5 py-3">
            <p class="text-[11px] text-ink-meta mb-1">Domicile</p>
            <p class="font-score text-lg font-bold text-ink">{{ summary.homeWins }}<span class="text-ink-meta text-sm">/{{ summary.homePlayed }}</span></p>
            <p class="text-[10px] text-ink-disabled mt-0.5">victoires</p>
          </div>
          <div class="bg-surface border border-line rounded-card px-3.5 py-3">
            <p class="text-[11px] text-ink-meta mb-1">Extérieur</p>
            <p class="font-score text-lg font-bold text-ink">{{ summary.awayWins }}<span class="text-ink-meta text-sm">/{{ summary.awayPlayed }}</span></p>
            <p class="text-[10px] text-ink-disabled mt-0.5">victoires</p>
          </div>
        </div>

        <!-- Discipline / fautes -->
        <div class="grid grid-cols-2 gap-2 mb-2.5">
          <div class="bg-surface border border-line rounded-card px-3.5 py-3">
            <p class="text-[11px] text-ink-meta mb-1">Cartons</p>
            <p class="font-score text-lg font-bold text-ink">
              <span class="text-[#FBBF24]">{{ eventCounts.yellowCards }}</span> · <span class="text-danger">{{ eventCounts.redCards }}</span>
            </p>
          </div>
          <div class="bg-surface border border-line rounded-card px-3.5 py-3">
            <p class="text-[11px] text-ink-meta mb-1">Fautes commises / subies</p>
            <p class="font-score text-lg font-bold text-ink">{{ eventCounts.foulsCommitted }} / {{ eventCounts.foulsSuffered }}</p>
          </div>
        </div>

        <!-- Derniers matchs -->
        <h2 class="text-[11px] font-medium tracking-[.5px] text-ink-secondary mb-2 mt-5">Derniers matchs</h2>
        <div class="flex flex-col gap-1.5">
          <button
            v-for="m in recentMatches"
            :key="m.id"
            class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-card bg-surface border border-line hover:bg-surface-hover transition-colors text-left"
            @click="router.push({ name: 'report', params: { id: m.id } })"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm text-ink font-medium truncate">{{ m.homeTeam }} vs {{ m.awayTeam }}</p>
              <p class="text-[11px] text-ink-meta">{{ formatDate(m.date) }}</p>
            </div>
            <span class="font-score text-sm font-bold text-ink">{{ displayScore(m.scoreHome, m.scoreAway, m.isHome).home }} – {{ displayScore(m.scoreHome, m.scoreAway, m.isHome).away }}</span>
          </button>
        </div>
        </template>
      </template>
    </main>
  </div>
</template>
