<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchStore } from '@/stores/match.store'
import { useEventsStore } from '@/stores/events.store'
import { useReportStore } from '@/stores/report.store'
import type { ReportStats } from '@/stores/report.store'
import type { MatchEvent } from '@/types/match.types'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const eventsStore = useEventsStore()
const reportStore = useReportStore()

const matchId = route.params.id as string

// Stats calculées côté client (affichées indépendamment du rapport IA)
const stats = ref<ReportStats | null>(null)

onMounted(async () => {
  eventsStore.reset()
  reportStore.reset()
  await Promise.all([
    matchStore.fetchMatch(matchId),
    eventsStore.fetchEvents(matchId),
    reportStore.fetchReport(matchId),
  ])
  stats.value = computeStats(eventsStore.events)
})

function computeStats(events: MatchEvent[]): ReportStats {
  const count = (type: string) => events.filter((e) => e.type === type).length
  return {
    goalsFor: count('GOAL_FOR'),
    goalsAgainst: count('GOAL_AGAINST'),
    shotsOnTarget: count('SHOT_ON_TARGET'),
    shotsOffTarget: count('SHOT_OFF_TARGET'),
    clearChances: count('CHANCE_CLEAR'),
    cornersFor: count('CORNER_FOR'),
    cornersAgainst: count('CORNER_AGAINST'),
    freeKicksFor: count('FREE_KICK_FOR'),
    freeKicksAgainst: count('FREE_KICK_AGAINST'),
    dangersSuffered: count('DANGER_SUFFERED'),
    yellowCards: count('YELLOW_CARD'),
    redCards: count('RED_CARD'),
    substitutions: count('SUBSTITUTION'),
    totalEvents: events.length,
  }
}

const scoreHome = computed(() => eventsStore.events.filter((e) => e.type === 'GOAL_FOR').length)
const scoreAway = computed(() => eventsStore.events.filter((e) => e.type === 'GOAL_AGAINST').length)

async function handleGenerate() {
  try {
    const returnedStats = await reportStore.generateReport(matchId)
    if (returnedStats) stats.value = returnedStats
  } catch {
    // error déjà dans reportStore.error
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white pb-20">

    <!-- Header -->
    <div class="sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center gap-3">
      <button
        class="text-neutral-500 hover:text-white transition-colors p-1 -ml-1"
        @click="router.push({ name: 'history' })"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-sm font-semibold text-white truncate">
          {{ matchStore.currentMatch?.homeTeam }} vs {{ matchStore.currentMatch?.awayTeam }}
        </h1>
        <p class="text-xs text-neutral-500">{{ matchStore.currentMatch?.competition }}</p>
      </div>
    </div>

    <!-- Chargement initial -->
    <div v-if="matchStore.loading" class="flex items-center justify-center py-20">
      <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>

    <template v-else>

      <!-- Score final -->
      <div class="flex flex-col items-center py-8 px-4">
        <p class="text-xs uppercase tracking-widest text-neutral-500 mb-3">Score final</p>
        <div class="flex items-center gap-4">
          <span class="text-4xl font-bold tabular-nums text-white">{{ scoreHome }}</span>
          <span class="text-2xl text-neutral-600">—</span>
          <span class="text-4xl font-bold tabular-nums text-white">{{ scoreAway }}</span>
        </div>
        <p class="text-xs text-neutral-500 mt-2">{{ matchStore.currentMatch?.date }}</p>
      </div>

      <!-- Grille de stats -->
      <div v-if="stats" class="px-4 mb-6">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">Statistiques</h2>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="item in [
              { label: 'Tirs cadrés', value: stats.shotsOnTarget, color: 'text-blue-400' },
              { label: 'Tirs non cadrés', value: stats.shotsOffTarget, color: 'text-indigo-400' },
              { label: 'Occasions nettes', value: stats.clearChances, color: 'text-amber-400' },
              { label: 'Corners', value: `${stats.cornersFor} / ${stats.cornersAgainst}`, color: 'text-cyan-400' },
              { label: 'Coups francs', value: `${stats.freeKicksFor} / ${stats.freeKicksAgainst}`, color: 'text-violet-400' },
              { label: 'Dangers subis', value: stats.dangersSuffered, color: 'text-red-400' },
              { label: '🟨 Cartons jaunes', value: stats.yellowCards, color: 'text-yellow-400' },
              { label: '🟥 Cartons rouges', value: stats.redCards, color: 'text-red-500' },
            ]"
            :key="item.label"
            class="bg-white/5 border border-white/8 rounded-xl px-3 py-3"
          >
            <p class="text-xs text-neutral-500 mb-1">{{ item.label }}</p>
            <p class="text-lg font-bold" :class="item.color">{{ item.value }}</p>
          </div>
        </div>
      </div>

      <!-- Séparateur -->
      <div class="mx-4 border-t border-white/10 mb-6" />

      <!-- Section Rapport IA -->
      <div class="px-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500">Analyse IA</h2>
          <!-- Bouton regénérer si rapport déjà existant -->
          <button
            v-if="reportStore.report && !reportStore.generating"
            class="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
            @click="handleGenerate"
          >
            Regénérer
          </button>
        </div>

        <!-- Erreur -->
        <div v-if="reportStore.error" class="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p class="text-sm text-red-400">{{ reportStore.error }}</p>
        </div>

        <!-- Génération en cours -->
        <div v-if="reportStore.generating" class="flex flex-col items-center py-12 gap-4">
          <div class="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <p class="text-sm text-neutral-400">Analyse du match en cours…</p>
          <p class="text-xs text-neutral-600">L'IA analyse vos données tactiques</p>
        </div>

        <!-- Bouton générer (si pas de rapport) -->
        <div v-else-if="!reportStore.report && !reportStore.loading" class="text-center py-10">
          <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-2xl">
            🤖
          </div>
          <p class="text-sm text-neutral-400 mb-1">Aucun rapport généré</p>
          <p class="text-xs text-neutral-600 mb-6">L'IA va analyser les {{ stats?.totalEvents ?? 0 }} événements du match</p>
          <button
            class="h-12 px-8 rounded-xl bg-white text-neutral-900 text-sm font-semibold
                   hover:bg-neutral-100 transition-all disabled:opacity-50"
            :disabled="reportStore.generating"
            @click="handleGenerate"
          >
            Générer l'analyse IA
          </button>
        </div>

        <!-- Chargement rapport existant -->
        <div v-else-if="reportStore.loading" class="flex items-center justify-center py-10">
          <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>

        <!-- Rapport affiché -->
        <div v-else-if="reportStore.report" class="space-y-4">

          <!-- Résumé -->
          <div class="bg-white/5 border border-white/8 rounded-xl p-4">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">Résumé</h3>
            <p class="text-sm text-neutral-200 leading-relaxed">{{ reportStore.report.content.summary }}</p>
          </div>

          <!-- Offensif -->
          <div class="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-green-500 mb-2">⚡ Jeu offensif</h3>
            <p class="text-sm text-neutral-200 leading-relaxed">{{ reportStore.report.content.offensive }}</p>
          </div>

          <!-- Défensif -->
          <div class="bg-red-500/5 border border-red-500/15 rounded-xl p-4">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-red-400 mb-2">🛡️ Jeu défensif</h3>
            <p class="text-sm text-neutral-200 leading-relaxed">{{ reportStore.report.content.defensive }}</p>
          </div>

          <!-- Tactique -->
          <div class="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-blue-400 mb-2">🧠 Lecture tactique</h3>
            <p class="text-sm text-neutral-200 leading-relaxed">{{ reportStore.report.content.tactical }}</p>
          </div>

          <!-- Axes d'amélioration -->
          <div class="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-3">🎯 Axes d'amélioration</h3>
            <ul class="space-y-2">
              <li
                v-for="(item, i) in reportStore.report.content.improvements"
                :key="i"
                class="flex items-start gap-2 text-sm text-neutral-200"
              >
                <span class="text-amber-500 font-bold shrink-0 mt-0.5">{{ i + 1 }}.</span>
                <span class="leading-relaxed">{{ item }}</span>
              </li>
            </ul>
          </div>

        </div>
      </div>

    </template>
  </div>
</template>
