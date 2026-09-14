<script setup lang="ts">
import { ref } from 'vue'
import type { Half } from '@/types/match.types'

const props = defineProps<{
  display: string
  running: boolean
  half: Half
  scoreHome: number
  scoreAway: number
  homeTeam: string
  awayTeam: string
  meta: string
  canControl?: boolean
  addedTimeDisplay?: string | null
}>()

const emit = defineEmits<{
  start: []
  pause: []
  switchHalf: []
  reset: []
}>()

const showResetConfirm = ref(false)
function confirmReset() {
  showResetConfirm.value = false
  emit('reset')
}
</script>

<template>
  <div class="flex-none bg-app border-b border-line px-4 pt-2.5 pb-3">

    <!-- Équipes + compétition -->
    <div class="flex items-center justify-between gap-2">
      <span class="text-[11px] font-medium tracking-[.5px] text-ink-secondary whitespace-nowrap overflow-hidden text-ellipsis">{{ props.homeTeam }}</span>
      <span class="text-[11px] font-medium text-ink-meta whitespace-nowrap shrink-0">{{ props.meta }}</span>
      <span class="text-[11px] font-medium tracking-[.5px] text-ink-secondary whitespace-nowrap overflow-hidden text-ellipsis text-right">{{ props.awayTeam }}</span>
    </div>

    <!-- Score -->
    <div class="flex items-center justify-center gap-3.5 mt-1.5">
      <span class="font-score text-[28px] font-bold text-ink tracking-[4px]">{{ props.scoreHome }} - {{ props.scoreAway }}</span>
    </div>

    <!-- Chrono -->
    <div class="flex items-center flex-col justify-center gap-2.5 mt-0.5">
      <span class="font-score text-[36px] font-bold leading-[1.1] text-ink">{{ props.display }}</span>
      <span
        v-if="props.addedTimeDisplay"
        class="font-score text-[15px] font-bold text-warning animate-nrv-pulse"
      >
        {{ props.addedTimeDisplay }}
      </span>
      <span class="text-[11px] font-medium tracking-[.5px] text-brand-ink">{{ props.half === 1 ? '1re mi-temps' : '2e mi-temps' }}</span>
    </div>

    <!-- Contrôles -->
    <div v-if="props.canControl !== false" class="grid grid-cols-3 gap-2 mt-2.5">
      <button
        class="h-9 rounded-input text-xs font-medium border transition-colors"
        :class="props.running
          ? 'bg-surface border-line-strong text-ink hover:bg-surface-hover'
          : 'bg-brand-soft border-brand-line text-brand-ink hover:bg-[#0a3d1c]'"
        @click="props.running ? emit('pause') : emit('start')"
      >
        {{ props.running ? 'Pause' : 'Démarrer' }}
      </button>
      <button
        class="h-9 rounded-input border border-line bg-surface text-ink-secondary text-xs font-medium
               disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover hover:border-line-strong transition-colors"
        :disabled="props.half === 2"
        @click="emit('switchHalf')"
      >
        Mi-temps
      </button>
      <button
        class="h-9 rounded-input border border-line bg-surface text-ink-secondary text-xs font-medium hover:bg-surface-hover hover:border-line-strong transition-colors"
        @click="showResetConfirm = true"
      >
        Reset
      </button>
    </div>

    <!-- Lecture seule -->
    <p v-else class="mt-2.5 text-xs text-ink-meta bg-surface border border-line rounded-input px-3 py-2 text-center">
      Lecture seule — tu n'as pas les droits pour saisir des événements sur ce match.
    </p>

    <!-- Confirmation reset -->
    <div
      v-if="showResetConfirm"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="showResetConfirm = false"
    >
      <div class="w-full max-w-sm bg-surface border border-line rounded-card p-6">
        <h2 class="text-base font-semibold text-ink mb-1">Réinitialiser le chrono ?</h2>
        <p class="text-sm text-ink-secondary mb-5">
          Le chrono repart de zéro en 1re mi-temps. Les événements déjà saisis ne sont pas supprimés.
        </p>
        <div class="flex gap-3">
          <button
            class="flex-1 h-11 rounded-btn border border-line text-ink-secondary text-sm font-medium hover:text-ink transition-colors"
            @click="showResetConfirm = false"
          >
            Annuler
          </button>
          <button
            class="flex-1 h-11 rounded-btn bg-danger text-white text-sm font-semibold hover:opacity-90 transition-colors"
            @click="confirmReset"
          >
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
