<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { v4 as uuidv4 } from 'uuid'
import { useMatchStore } from '@/stores/match.store'
import { useEventsStore } from '@/stores/events.store'
import { useAuthStore } from '@/stores/auth.store'
import { useTimer } from '@/composables/useTimer'
import { useOfflineQueue } from '@/composables/useOfflineQueue'
import { useMatchSync } from '@/composables/useMatchSync'
import MatchTimer from '@/components/tracker/MatchTimer.vue'
import PitchMap from '@/components/tracker/PitchMap.vue'
import ActionButtons from '@/components/tracker/ActionButtons.vue'
import SubstitutionModal from '@/components/tracker/SubstitutionModal.vue'
import EventLog from '@/components/tracker/EventLog.vue'
import type { EventType, MatchEvent, ZoneX, ZoneY } from '@/types/match.types'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const eventsStore = useEventsStore()
const authStore = useAuthStore()
const timer = useTimer()
const { pendingCount, addEventWithFallback } = useOfflineQueue()

const matchId = route.params.id as string
const { subscribe } = useMatchSync(matchId)

// Action sélectionnée en attente d'un clic terrain
const selectedAction = ref<EventType | null>(null)
const showSubstitutionModal = ref(false)
const showFinishConfirm = ref(false)
const finishing = ref(false)

onMounted(async () => {
  eventsStore.reset()
  await Promise.all([
    matchStore.fetchMatch(matchId),
    eventsStore.fetchEvents(matchId),
  ])
  // Passe le match en LIVE si PENDING
  if (matchStore.currentMatch?.status === 'PENDING') {
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

// Actions qui s'enregistrent sans clic terrain
const INSTANT_ACTIONS = new Set<EventType>(['YELLOW_CARD', 'RED_CARD'])

// Clic sur une action — si instantanée, on enregistre directement
function handleActionSelect(action: EventType) {
  if (INSTANT_ACTIONS.has(action)) {
    recordEvent(action, null, null, null, null)
    return
  }
  selectedAction.value = action
}

function handleActionDeselect() {
  selectedAction.value = null
}

// Clic sur le terrain — enregistre l'événement avec position
function handlePitchClick(pos: { pitchX: number; pitchY: number; zoneX: ZoneX; zoneY: ZoneY }) {
  if (!selectedAction.value) return
  recordEvent(selectedAction.value, pos.pitchX, pos.pitchY, pos.zoneX, pos.zoneY)
  selectedAction.value = null
}

// Confirmation remplacement
function handleSubstitutionConfirm(data: { playerIn: string; playerOut: string }) {
  showSubstitutionModal.value = false
  const event: MatchEvent = buildEvent('SUBSTITUTION', null, null, null, null)
  event.playerIn = data.playerIn
  event.playerOut = data.playerOut
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
    playerIn: null,
    playerOut: null,
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
    await matchStore.updateMatchStatus(matchId, 'FINISHED')
    router.push({ name: 'report', params: { id: matchId } })
  } finally {
    finishing.value = false
    showFinishConfirm.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white pb-24">

    <!-- Chrono fixe en haut -->
    <MatchTimer
      :display="timer.display.value"
      :running="timer.running.value"
      :half="timer.half.value"
      :score-home="scoreHome"
      :score-away="scoreAway"
      :home-team="matchStore.currentMatch?.homeTeam ?? ''"
      :away-team="matchStore.currentMatch?.awayTeam ?? ''"
      @start="timer.start()"
      @pause="timer.pause()"
      @switch-half="timer.switchHalf()"
      @reset="timer.reset()"
    />

    <!-- Chargement -->
    <div v-if="matchStore.loading" class="flex items-center justify-center py-20">
      <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>

    <template v-else>
      <!-- Terrain SVG -->
      <div class="py-4">
        <PitchMap
          :events="eventsStore.events"
          :active-action="selectedAction"
          @pitch-click="handlePitchClick"
        />
      </div>

      <!-- Instruction contextuelle -->
      <div class="px-4 mb-3 h-8 flex items-center">
        <p v-if="selectedAction" class="text-sm text-amber-400 font-medium animate-pulse">
          Touchez le terrain pour placer l'action
        </p>
        <p v-else class="text-xs text-neutral-600">
          Sélectionnez une action ci-dessous
        </p>
      </div>

      <!-- Boutons d'action -->
      <ActionButtons
        :selected-action="selectedAction"
        @select="handleActionSelect"
        @deselect="handleActionDeselect"
        @open-substitution="showSubstitutionModal = true"
      />

      <!-- Alerte offline -->
      <div v-if="pendingCount > 0" class="mx-4 mt-4 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <p class="text-xs text-yellow-400">
          {{ pendingCount }} événement{{ pendingCount > 1 ? 's' : '' }} en attente de synchronisation
        </p>
      </div>

      <!-- Séparateur -->
      <div class="mx-4 my-5 border-t border-white/10" />

      <!-- Log des événements -->
      <EventLog
        :events="eventsStore.events"
        @delete="handleDeleteEvent"
      />

      <!-- Bouton terminer le match -->
      <div class="px-4 mt-6">
        <button
          class="w-full h-12 rounded-xl border border-white/10 text-neutral-400 text-sm font-medium
                 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
          @click="showFinishConfirm = true"
        >
          Terminer le match
        </button>
      </div>
    </template>

    <!-- Modal remplacement -->
    <SubstitutionModal
      v-if="showSubstitutionModal"
      :minute="timer.currentMinute.value"
      @confirm="handleSubstitutionConfirm"
      @cancel="showSubstitutionModal = false"
    />

    <!-- Confirmation fin de match -->
    <div
      v-if="showFinishConfirm"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="showFinishConfirm = false"
    >
      <div class="w-full max-w-sm bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h2 class="text-base font-semibold text-white mb-1">Terminer le match ?</h2>
        <p class="text-sm text-neutral-400 mb-5">
          Le match passera en statut "Terminé" et vous pourrez générer l'analyse IA.
        </p>
        <div class="flex gap-3">
          <button
            class="flex-1 h-11 rounded-lg border border-white/10 text-neutral-400 text-sm font-medium hover:text-white transition-all"
            @click="showFinishConfirm = false"
          >
            Annuler
          </button>
          <button
            :disabled="finishing"
            class="flex-1 h-11 rounded-lg bg-white text-neutral-900 text-sm font-semibold
                   hover:bg-neutral-100 disabled:opacity-50 transition-all"
            @click="handleFinishMatch"
          >
            <span v-if="finishing">Finalisation...</span>
            <span v-else>Terminer</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
