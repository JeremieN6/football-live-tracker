<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { v4 as uuidv4 } from 'uuid'
import { useMatchStore } from '@/stores/match.store'
import { useEventsStore } from '@/stores/events.store'
import { useAuthStore } from '@/stores/auth.store'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { useLineupStore } from '@/stores/lineup.store'
import { useTimer } from '@/composables/useTimer'
import { useOfflineQueue } from '@/composables/useOfflineQueue'
import { useMatchSync } from '@/composables/useMatchSync'
import { eventLabel } from '@/lib/eventPalette'
import MatchTimer from '@/components/tracker/MatchTimer.vue'
import PitchMap from '@/components/tracker/PitchMap.vue'
import ActionButtons from '@/components/tracker/ActionButtons.vue'
import SubstitutionModal from '@/components/tracker/SubstitutionModal.vue'
import GoalDetailsModal from '@/components/tracker/GoalDetailsModal.vue'
import CardPlayerModal from '@/components/tracker/CardPlayerModal.vue'
import EventLog from '@/components/tracker/EventLog.vue'
import type { EventType, MatchEvent, ZoneX, ZoneY } from '@/types/match.types'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const eventsStore = useEventsStore()
const authStore = useAuthStore()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()
const lineupStore = useLineupStore()
const timer = useTimer()
const { pendingCount, addEventWithFallback } = useOfflineQueue()

const matchId = route.params.id as string
const { subscribe } = useMatchSync(matchId)

// Action sélectionnée en attente d'un tap terrain
const selectedAction = ref<EventType | null>(null)
const showSubstitutionModal = ref(false)
const showFinishConfirm = ref(false)
const finishing = ref(false)

// But / carton en attente de confirmation du joueur concerné
const pendingGoalPos = ref<{ pitchX: number; pitchY: number; zoneX: ZoneX; zoneY: ZoneY } | null>(null)
const pendingCardType = ref<EventType | null>(null)

// Durée de la 1ère mi-temps, capturée avant que le chrono ne se remette à zéro (sert au calcul des minutes jouées)
const firstHalfMinutes = ref<number | null>(null)

function handleSwitchHalf() {
  firstHalfMinutes.value = timer.currentMinute.value
  timer.switchHalf()
}

// Effectif sélectionné pour ce match, résolu en objets Player
const lineupPlayers = computed(() => {
  const idsByRole = new Map(lineupStore.entries.map((e) => [e.playerId, e.role]))
  return playersStore.players
    .filter((p) => idsByRole.has(p.id))
    .sort((a, b) => {
      const roleA = idsByRole.get(a.id)
      const roleB = idsByRole.get(b.id)
      if (roleA !== roleB) return roleA === 'STARTER' ? -1 : 1
      return (a.number ?? 99) - (b.number ?? 99)
    })
})

const teamMeta = computed(() => {
  const match = matchStore.currentMatch
  if (!match) return ''
  const name = teamsStore.teams.find((t) => t.id === match.teamId)?.name
  return [name, match.competition].filter(Boolean).join(' · ')
})

// Un coach/adjoint/etc. peut toujours tracker ; en plus, un membre désigné
// par le coach pour CE match précis (matches.designated_tracker_member_id,
// cf. CreateMatchModal) peut aussi saisir les événements — sans avoir les
// droits COACH sur toute l'équipe. Écriture directe, revue par le coach a
// posteriori (pas de file de validation séparée).
const canTrack = computed(() => {
  if (clubsStore.canWrite) return true
  const trackerId = matchStore.currentMatch?.designatedTrackerMemberId
  return !!trackerId && trackerId === clubsStore.membership?.id
})

onMounted(async () => {
  eventsStore.reset()
  await Promise.all([
    matchStore.fetchMatch(matchId),
    eventsStore.fetchEvents(matchId),
    playersStore.fetchPlayers(),
    lineupStore.fetchLineup(matchId),
  ])
  if (clubsStore.club) await teamsStore.fetchTeams(clubsStore.club.id)
  // Passe le match en LIVE si PENDING (uniquement si on a le droit de tracker ce match)
  if (canTrack.value && matchStore.currentMatch?.status === 'PENDING') {
    await matchStore.updateMatchStatus(matchId, 'LIVE')
  }
  // Démarrer la synchronisation Realtime
  subscribe()
})

onUnmounted(() => {
  eventsStore.reset()
})

// Score calculé depuis les événements
const scoreHome = computed(
  () => eventsStore.events.filter((e) => e.type === 'GOAL_FOR').length,
)
const scoreAway = computed(
  () => eventsStore.events.filter((e) => e.type === 'GOAL_AGAINST').length,
)

// Actions qui s'enregistrent sans tap terrain
const INSTANT_ACTIONS = new Set<EventType>(['YELLOW_CARD', 'RED_CARD'])

// Tap sur une action — si instantanée, on enregistre directement (ou on demande le joueur si l'effectif est connu)
function handleActionSelect(action: EventType) {
  if (INSTANT_ACTIONS.has(action)) {
    if (lineupPlayers.value.length === 0) {
      recordEvent(action, null, null, null, null)
    } else {
      pendingCardType.value = action
    }
    return
  }
  selectedAction.value = action
}

function handleActionDeselect() {
  selectedAction.value = null
}

const pitchHint = computed(() =>
  selectedAction.value ? `Tape le terrain — ${eventLabel(selectedAction.value).toLowerCase()}` : '',
)

// Tap sur le terrain — enregistre l'événement avec position
function handlePitchClick(pos: { pitchX: number; pitchY: number; zoneX: ZoneX; zoneY: ZoneY }) {
  if (!selectedAction.value) return
  if (selectedAction.value === 'GOAL_FOR' && lineupPlayers.value.length > 0) {
    pendingGoalPos.value = pos
    selectedAction.value = null
    return
  }
  recordEvent(selectedAction.value, pos.pitchX, pos.pitchY, pos.zoneX, pos.zoneY)
  selectedAction.value = null
}

// Confirmation but : buteur + passeur décisif éventuel
function handleGoalConfirm(data: { scorerId: string | null; assistId: string | null }) {
  if (!pendingGoalPos.value) return
  const event = buildEvent('GOAL_FOR', pendingGoalPos.value.pitchX, pendingGoalPos.value.pitchY, pendingGoalPos.value.zoneX, pendingGoalPos.value.zoneY)
  event.scorerId = data.scorerId
  event.assistId = data.assistId
  addEventWithFallback(event)
  pendingGoalPos.value = null
}

// Confirmation carton : joueur sanctionné
function handleCardConfirm(playerId: string | null) {
  if (!pendingCardType.value) return
  const event = buildEvent(pendingCardType.value, null, null, null, null)
  event.playerId = playerId
  addEventWithFallback(event)
  pendingCardType.value = null
}

// Confirmation remplacement
function handleSubstitutionConfirm(data: { playerInId: string; playerOutId: string }) {
  showSubstitutionModal.value = false
  const event: MatchEvent = buildEvent('SUBSTITUTION', null, null, null, null)
  event.playerInId = data.playerInId
  event.playerOutId = data.playerOutId
  addEventWithFallback(event)
}

function buildEvent(
  type: EventType,
  pitchX: number | null,
  pitchY: number | null,
  zoneX: ZoneX | null,
  zoneY: ZoneY | null,
): MatchEvent {
  return {
    id: uuidv4(),
    matchId,
    type,
    team: 'HOME',
    minute: timer.currentMinute.value,
    half: timer.half.value,
    addedTime: false,
    pitchX,
    pitchY,
    zoneX,
    zoneY,
    scorerId: null,
    assistId: null,
    playerId: null,
    playerInId: null,
    playerOutId: null,
    createdBy: authStore.user?.id ?? '',
    createdAt: new Date().toISOString(),
  }
}

function recordEvent(
  type: EventType,
  pitchX: number | null,
  pitchY: number | null,
  zoneX: ZoneX | null,
  zoneY: ZoneY | null,
) {
  const event = buildEvent(type, pitchX, pitchY, zoneX, zoneY)
  addEventWithFallback(event)
}

async function handleDeleteEvent(id: string) {
  await eventsStore.deleteEvent(id)
}

async function handleFinishMatch() {
  finishing.value = true
  try {
    // Si le match se termine en 1ère mi-temps (jamais basculé), toute la durée est comptée en 1ère mi-temps
    const first = timer.half.value === 1 ? timer.currentMinute.value : (firstHalfMinutes.value ?? 0)
    const second = timer.half.value === 2 ? timer.currentMinute.value : 0
    await matchStore.finishMatch(matchId, { firstHalfMinutes: first, secondHalfMinutes: second })
    router.push({ name: 'report', params: { id: matchId } })
  } finally {
    finishing.value = false
    showFinishConfirm.value = false
  }
}
</script>

<template>
  <div class="h-dvh flex flex-col bg-app text-ink overflow-hidden">

    <!-- Chargement -->
    <div v-if="matchStore.loading" class="flex-1 flex items-center justify-center">
      <div class="w-6 h-6 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
    </div>

    <template v-else>
      <!-- Zone 1 — score + chrono + contrôles (fixe) -->
      <MatchTimer
        :display="timer.display.value"
        :running="timer.running.value"
        :half="timer.half.value"
        :score-home="scoreHome"
        :score-away="scoreAway"
        :home-team="matchStore.currentMatch?.homeTeam ?? ''"
        :away-team="matchStore.currentMatch?.awayTeam ?? ''"
        :meta="teamMeta"
        :can-control="canTrack"
        :added-time-display="timer.addedTimeDisplay.value"
        @start="timer.start()"
        @pause="timer.pause()"
        @switch-half="handleSwitchHalf"
        @reset="timer.reset()"
      />

      <!-- Zone 2 — terrain (fixe, 300px) -->
      <PitchMap
        :events="eventsStore.events"
        :active-action="canTrack ? selectedAction : null"
        :hint="canTrack ? pitchHint : ''"
        @pitch-click="handlePitchClick"
      />

      <!-- Zone 3 — palette d'événements (fixe) -->
      <ActionButtons
        v-if="canTrack"
        :selected-action="selectedAction"
        @select="handleActionSelect"
        @deselect="handleActionDeselect"
        @open-substitution="showSubstitutionModal = true"
      />

      <!-- Alerte offline -->
      <div v-if="pendingCount > 0" class="flex-none mx-3 mt-2 px-3 py-2 rounded-input bg-[#451a03] border border-warning/40">
        <p class="text-xs text-warning">
          {{ pendingCount }} événement{{ pendingCount > 1 ? 's' : '' }} en attente de synchronisation
        </p>
      </div>

      <!-- Zone 4 — timeline (seule zone qui scrolle) -->
      <div class="flex-1 min-h-0 overflow-y-auto px-3 pt-2.5 pb-3.5">
        <div class="flex items-baseline justify-between mx-1 mb-2">
          <span class="text-[13px] font-semibold text-ink">Timeline</span>
          <span class="font-data text-[11px] text-ink-meta">{{ eventsStore.events.length }} évén.</span>
        </div>

        <EventLog
          :events="eventsStore.events"
          :players="lineupPlayers"
          :read-only="!canTrack"
          @delete="handleDeleteEvent"
        />

        <!-- Bouton terminer le match -->
        <button
          v-if="canTrack"
          class="w-full h-12 mt-4 rounded-btn border border-line text-ink-secondary text-sm font-medium
                 hover:border-danger-line hover:text-danger hover:bg-danger-soft transition-colors"
          @click="showFinishConfirm = true"
        >
          Terminer le match
        </button>
      </div>
    </template>

    <!-- Modal but : buteur + passeur -->
    <GoalDetailsModal
      v-if="pendingGoalPos"
      :minute="timer.currentMinute.value"
      :players="lineupPlayers"
      @confirm="handleGoalConfirm"
      @cancel="pendingGoalPos = null"
    />

    <!-- Modal carton : joueur sanctionné -->
    <CardPlayerModal
      v-if="pendingCardType"
      :type="pendingCardType"
      :minute="timer.currentMinute.value"
      :players="lineupPlayers"
      @confirm="handleCardConfirm"
      @cancel="pendingCardType = null"
    />

    <!-- Modal remplacement -->
    <SubstitutionModal
      v-if="showSubstitutionModal"
      :minute="timer.currentMinute.value"
      :players="lineupPlayers"
      @confirm="handleSubstitutionConfirm"
      @cancel="showSubstitutionModal = false"
    />

    <!-- Confirmation fin de match -->
    <div
      v-if="showFinishConfirm"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="showFinishConfirm = false"
    >
      <div class="w-full max-w-sm bg-surface border border-line rounded-card p-6">
        <h2 class="text-base font-semibold text-ink mb-1">Terminer le match ?</h2>
        <p class="text-sm text-ink-secondary mb-5">
          Le match passera en statut « Terminé » et tu pourras analyser les événements saisis.
        </p>
        <div class="flex gap-3">
          <button
            class="flex-1 h-11 rounded-btn border border-line text-ink-secondary text-sm font-medium hover:text-ink transition-colors"
            @click="showFinishConfirm = false"
          >
            Annuler
          </button>
          <button
            :disabled="finishing"
            class="flex-1 h-11 rounded-btn bg-brand text-brand-soft text-sm font-semibold
                   hover:bg-brand-hover disabled:opacity-50 transition-colors"
            @click="handleFinishMatch"
          >
            <span v-if="finishing">Finalisation…</span>
            <span v-else>Terminer</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
