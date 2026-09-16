<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bot, ChevronDown } from 'lucide-vue-next'
import { useMatchStore } from '@/stores/match.store'
import { useEventsStore } from '@/stores/events.store'
import { useReportStore } from '@/stores/report.store'
import { usePlayersStore } from '@/stores/players.store'
import { useLineupStore } from '@/stores/lineup.store'
import { eventMeta } from '@/lib/eventPalette'
import AppHeader from '@/components/AppHeader.vue'
import type { ReportStats } from '@/stores/report.store'
import type { MatchEvent } from '@/types/match.types'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const eventsStore = useEventsStore()
const reportStore = useReportStore()
const playersStore = usePlayersStore()
const lineupStore = useLineupStore()

const matchId = route.params.id as string

const stats = ref<ReportStats | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const scrolled = ref(false)

function handleScroll() {
  scrolled.value = (scrollEl.value?.scrollTop ?? 0) > 24
}

onMounted(async () => {
  eventsStore.reset()
  reportStore.reset()
  await Promise.all([
    matchStore.fetchMatch(matchId),
    eventsStore.fetchEvents(matchId),
    reportStore.fetchReport(matchId),
    playersStore.fetchPlayers(),
    lineupStore.fetchLineup(matchId),
  ])
  stats.value = computeStats(eventsStore.events)
  // Le listener scroll doit être posé sur le nœud scrollable lui-même
  await nextTick()
  scrollEl.value?.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  scrollEl.value?.removeEventListener('scroll', handleScroll)
})

const lineupPlayers = computed(() => {
  const ids = new Set(lineupStore.entries.map((e) => e.playerId))
  return playersStore.players.filter((p) => ids.has(p.id))
})

function playerName(id: string | null): string | null {
  if (!id) return null
  return lineupPlayers.value.find((p) => p.id === id)?.name ?? null
}

const chronology = computed(() => [...eventsStore.events].sort((a, b) => a.minute - b.minute))

function chronologyLabel(event: MatchEvent): string {
  const label = eventMeta(event.type).label
  if (event.type === 'GOAL_FOR') {
    const scorer = playerName(event.scorerId)
    const assist = playerName(event.assistId)
    if (scorer && assist) return `But — ${scorer} (passe déc. : ${assist})`
    if (scorer) return `But — ${scorer}`
    return label
  }
  if (event.type === 'SUBSTITUTION') {
    const playerIn = playerName(event.playerInId)
    const playerOut = playerName(event.playerOutId)
    if (playerIn && playerOut) return `${playerIn} ↔ ${playerOut}`
    return label
  }
  const player = playerName(event.playerId)
  return player ? `${label} — ${player}` : label
}

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

const matchDateLabel = computed(() => {
  const date = matchStore.currentMatch?.date
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})

const durationLabel = computed(() => {
  const m = matchStore.currentMatch
  if (!m || m.firstHalfMinutes == null) return null
  return `${m.firstHalfMinutes + (m.secondHalfMinutes ?? 0)} min`
})

const shotsLabel = computed(() => {
  if (!stats.value) return null
  const total = stats.value.shotsOnTarget + stats.value.shotsOffTarget
  return total > 0 ? `${total} tir${total > 1 ? 's' : ''}` : null
})

// 5 sections numérotées, construites depuis le contenu réel généré par l'IA
// (summary/offensive/defensive/tactical/improvements — cf. report.store.ts).
// La maquette en montre 6, la 6e ("Points forts") n'a pas d'équivalent généré
// côté backend : plutôt que d'inventer du contenu, on s'arrête à 5.
interface Section { num: string; title: string; body: string; list?: string[]; tone?: 'bad' }
const sections = computed<Section[]>(() => {
  const c = reportStore.report?.content
  if (!c) return []
  return [
    { num: '01', title: 'Résumé du match', body: c.summary },
    { num: '02', title: 'Jeu offensif', body: c.offensive },
    { num: '03', title: 'Jeu défensif', body: c.defensive },
    { num: '04', title: 'Lecture tactique', body: c.tactical },
    { num: '05', title: 'Axes d\'amélioration', body: '', list: c.improvements, tone: 'bad' },
  ]
})

const openSections = ref<Record<string, boolean>>({})
function isOpen(num: string): boolean {
  return openSections.value[num] !== false
}
function toggleSection(num: string) {
  openSections.value[num] = !isOpen(num)
}

async function handleGenerate() {
  try {
    const returnedStats = await reportStore.generateReport(matchId)
    if (returnedStats) stats.value = returnedStats
  } catch {
    // error déjà dans reportStore.error
  }
}

function openTimeline() {
  router.push({ name: 'tracker', params: { id: matchId } })
}

function exportPdf() {
  window.print()
}
</script>

<template>
  <div class="h-dvh flex flex-col bg-app text-ink overflow-hidden">

    <!-- Header d'app commun (logo + menu avatar) — manquait sur cet ecran,
         seul l'ecran Rapport n'avait pas encore ete rattrape le 15/09. -->
    <AppHeader back />

    <!-- Sous-header propre a l'ecran : retour precis vers "Matchs" (plus
         pertinent ici que le retour generique vers l'accueil d'AppHeader),
         score qui apparait au scroll, badge "Analyse IA". -->
    <div class="flex-none flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
      <button class="text-[13px] font-medium text-ink-secondary hover:text-ink transition-colors" @click="router.push({ name: 'history' })">
        ← Historique
      </button>
      <div
        class="flex items-center gap-2 overflow-hidden transition-all duration-200"
        :style="{ opacity: scrolled ? 1 : 0, maxWidth: scrolled ? '220px' : '0px' }"
      >
        <span class="font-score text-sm font-bold tracking-[1px] text-ink whitespace-nowrap">{{ scoreHome }} - {{ scoreAway }}</span>
        <span class="text-[11px] text-ink-meta whitespace-nowrap truncate">{{ matchStore.currentMatch?.homeTeam }} · {{ matchStore.currentMatch?.awayTeam }}</span>
      </div>
      <span class="flex-none text-[11px] font-medium tracking-[.5px] text-brand-ink px-2 py-1 bg-brand-soft border border-brand-line rounded-full">Analyse</span>
    </div>

    <!-- Chargement initial -->
    <div v-if="matchStore.loading" class="flex-1 flex items-center justify-center">
      <div class="w-6 h-6 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
    </div>

    <div v-else ref="scrollEl" class="flex-1 min-h-0 overflow-y-auto">

      <!-- Score final -->
      <div class="px-4 pt-5 pb-[18px] border-b border-line">
        <div class="flex items-center justify-center gap-4">
          <span class="flex-1 text-right text-[13px] font-semibold text-ink truncate">{{ matchStore.currentMatch?.homeTeam }}</span>
          <span class="font-score text-[40px] font-bold tracking-[2px] text-ink whitespace-nowrap">{{ scoreHome }} - {{ scoreAway }}</span>
          <span class="flex-1 text-[13px] font-semibold text-ink-secondary truncate">{{ matchStore.currentMatch?.awayTeam }}</span>
        </div>
        <p class="mt-2.5 text-center text-xs text-ink-meta">
          {{ [matchStore.currentMatch?.competition, matchDateLabel].filter(Boolean).join(' · ') }}
        </p>
        <div class="flex justify-center flex-wrap gap-1.5 mt-3">
          <span v-if="durationLabel" class="font-data text-[11px] text-ink-secondary px-2.5 py-1.5 bg-surface border border-line rounded-full">{{ durationLabel }}</span>
          <span v-if="stats" class="font-data text-[11px] text-ink-secondary px-2.5 py-1.5 bg-surface border border-line rounded-full">{{ stats.totalEvents }} événement{{ stats.totalEvents > 1 ? 's' : '' }}</span>
          <span v-if="shotsLabel" class="font-data text-[11px] text-ink-secondary px-2.5 py-1.5 bg-surface border border-line rounded-full">{{ shotsLabel }}</span>
        </div>
      </div>

      <div class="px-4 pt-1 pb-5">

        <!-- Erreur -->
        <p v-if="reportStore.error" class="mt-4 text-sm text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2">
          {{ reportStore.error }}
        </p>

        <!-- Génération en cours -->
        <div v-if="reportStore.generating" class="flex flex-col items-center py-12 gap-3">
          <div class="w-8 h-8 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
          <p class="text-sm text-ink-body">Analyse en cours…</p>
          <p class="text-xs text-ink-meta">L'IA lit tes données tactiques</p>
        </div>

        <!-- Chargement rapport existant -->
        <div v-else-if="reportStore.loading" class="flex items-center justify-center py-10">
          <div class="w-6 h-6 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
        </div>

        <!-- Pas de rapport -->
        <div v-else-if="!reportStore.report" class="text-center py-10">
          <div class="w-14 h-14 rounded-2xl bg-surface border border-line flex items-center justify-center mx-auto mb-4">
            <Bot :size="24" :stroke-width="1.5" class="text-ink-meta" />
          </div>
          <p class="text-sm text-ink-body mb-1">Aucune analyse</p>
          <p class="text-xs text-ink-meta mb-6">L'IA peut lire les {{ stats?.totalEvents ?? 0 }} événements saisis</p>
          <button
            class="h-12 px-8 rounded-btn bg-brand text-brand-soft text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors"
            :disabled="reportStore.generating"
            @click="handleGenerate"
          >
            Analyser le match
          </button>
        </div>

        <!-- Sections du rapport (IA, seulement si généré) -->
        <template v-if="sections.length > 0">
          <div v-for="(s, i) in sections" :key="s.num" :data-testid="`report-section-${s.num}`">
            <div
              :class="s.tone === 'bad'
                ? 'px-3.5 py-4 my-3.5 bg-[#1a0a0a] border-l-2 border-danger rounded-r-[10px]'
                : (i < sections.length - 2 ? 'py-[18px] border-b border-line' : 'py-[18px]')"
            >
              <button class="w-full flex items-center gap-2.5 py-0.5 text-left" @click="toggleSection(s.num)">
                <span class="flex-none font-data text-[11px] font-bold text-ink-disabled">{{ s.num }}</span>
                <h2 class="flex-1 text-[15px] font-semibold text-ink">{{ s.title }}</h2>
                <ChevronDown
                  :size="14"
                  :stroke-width="2"
                  class="flex-none text-ink-disabled transition-transform"
                  :style="{ transform: isOpen(s.num) ? 'rotate(0deg)' : 'rotate(-90deg)' }"
                />
              </button>
              <template v-if="isOpen(s.num)">
                <p v-if="s.body" data-testid="report-section-body" class="mt-2.5 text-sm text-ink-body leading-[1.7]">{{ s.body }}</p>
                <ul v-if="s.list" class="mt-2.5 flex flex-col gap-2">
                  <li v-for="(item, idx) in s.list" :key="idx" class="flex items-start gap-2 text-sm text-ink-body leading-[1.7]">
                    <span class="text-danger font-bold shrink-0">{{ idx + 1 }}.</span>
                    {{ item }}
                  </li>
                </ul>
              </template>
            </div>
          </div>

          <button class="block mx-auto mt-1 text-xs text-ink-meta hover:text-ink-secondary transition-colors" @click="handleGenerate">
            Réanalyser
          </button>
        </template>

        <!-- Chronologie (donnée factuelle, pas de l'IA — indépendante du rapport IA, -->
        <!-- affichée dès qu'il y a des événements même si aucun rapport n'a été généré) -->
        <div v-if="chronology.length > 0" class="mt-5 pt-4 border-t border-line">
          <h2 class="text-[13px] font-semibold text-ink mb-3">Chronologie</h2>
          <div class="bg-surface border border-line rounded-card divide-y divide-line">
            <div
              v-for="event in chronology"
              :key="event.id"
              class="flex items-center gap-2.5 px-3 py-2.5 odd:bg-surface-sub"
            >
              <component
                :is="eventMeta(event.type).icon"
                :size="15"
                :stroke-width="2"
                class="flex-none"
                :style="{ color: eventMeta(event.type).color }"
              />
              <span class="font-score text-xs font-bold text-ink-meta w-7 shrink-0">{{ event.minute }}'</span>
              <span class="text-sm text-ink-body">{{ chronologyLabel(event) }}</span>
            </div>
          </div>
        </div>

        <div v-if="reportStore.report" class="flex flex-col gap-2 mt-5">
          <button
            class="h-12 rounded-btn border border-line bg-surface text-ink text-sm font-medium hover:bg-surface-hover transition-colors"
            @click="exportPdf"
          >
            Exporter en PDF
          </button>
          <button
            class="h-12 rounded-btn border border-line bg-transparent text-ink-secondary text-sm font-medium hover:text-ink hover:bg-surface transition-colors"
            @click="openTimeline"
          >
            Revoir la timeline
          </button>
        </div>
        <p v-if="reportStore.report" class="mt-4 text-center text-[11px] text-ink-disabled leading-[1.6]">
          Analyse produite à partir des {{ stats?.totalEvents ?? 0 }} événements saisis — relis-la avant de la partager.
        </p>
      </div>
    </div>
  </div>
</template>
