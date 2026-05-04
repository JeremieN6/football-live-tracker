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
}>()

const emit = defineEmits<{
  start: []
  pause: []
  switchHalf: []
  reset: []
}>()
</script>

<template>
  <!-- Barre fixe en haut — toujours visible, jamais scrollable -->
  <div class="sticky top-0 z-40 bg-neutral-900/95 backdrop-blur-sm border-b border-white/10">
    <div class="px-4 py-3">

      <!-- Score -->
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-white truncate flex-1 text-left">{{ props.homeTeam }}</span>
        <div class="flex items-center gap-3 mx-3 shrink-0">
          <span class="text-2xl font-bold tabular-nums text-white">{{ props.scoreHome }}</span>
          <span class="text-neutral-600 font-light">–</span>
          <span class="text-2xl font-bold tabular-nums text-white">{{ props.scoreAway }}</span>
        </div>
        <span class="text-sm font-semibold text-white truncate flex-1 text-right">{{ props.awayTeam }}</span>
      </div>

      <!-- Chrono + contrôles -->
      <div class="flex items-center justify-between">

        <!-- Indicateur mi-temps -->
        <div class="flex items-center gap-1.5">
          <div
            class="w-2 h-2 rounded-full"
            :class="props.running ? 'bg-green-400 animate-pulse' : 'bg-neutral-600'"
          />
          <span class="text-xs text-neutral-400">{{ props.half === 1 ? '1ère mi-temps' : '2ème mi-temps' }}</span>
        </div>

        <!-- Affichage chrono -->
        <span class="text-3xl font-mono font-bold text-white tabular-nums tracking-tight">
          {{ props.display }}
        </span>

        <!-- Boutons de contrôle -->
        <div class="flex items-center gap-1.5">
          <!-- Start / Pause -->
          <button
            v-if="!props.running"
            class="h-9 px-3 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/30 transition-all"
            @click="emit('start')"
          >
            ▶
          </button>
          <button
            v-else
            class="h-9 px-3 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-semibold hover:bg-yellow-500/30 transition-all"
            @click="emit('pause')"
          >
            ⏸
          </button>

          <!-- Mi-temps (uniquement en 1ère mi-temps) -->
          <button
            v-if="props.half === 1"
            class="h-9 px-3 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-all"
            @click="emit('switchHalf')"
          >
            MT
          </button>

          <!-- Reset -->
          <button
            class="h-9 px-3 rounded-lg bg-white/5 text-neutral-500 text-xs font-semibold hover:bg-white/10 hover:text-neutral-300 transition-all"
            @click="emit('reset')"
          >
            ↺
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
