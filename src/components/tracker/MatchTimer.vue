<script setup lang="ts">
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
}>()

const emit = defineEmits<{
  start: []
  pause: []
  switchHalf: []
  reset: []
}>()
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
    <div class="flex items-baseline justify-center gap-2.5 mt-0.5">
      <span class="font-score text-[36px] font-bold leading-[1.1] text-ink">{{ props.display }}</span>
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
        @click="emit('reset')"
      >
        Reset
      </button>
    </div>

    <!-- Lecture seule -->
    <p v-else class="mt-2.5 text-xs text-ink-meta bg-surface border border-line rounded-input px-3 py-2 text-center">
      Lecture seule — tu n'as pas les droits pour saisir des événements sur ce match.
    </p>
  </div>
</template>
