<script setup lang="ts">
import { ref } from 'vue'
import type { Player } from '@/types/match.types'

const props = defineProps<{
  minute: number
  players: Player[]
}>()

const emit = defineEmits<{
  confirm: [{ scorerId: string | null; assistId: string | null }]
  cancel: []
}>()

const scorerId = ref<string | null>(null)
const assistId = ref<string | null>(null)

function playerLabel(p: Player): string {
  return p.number != null ? `#${p.number} ${p.name}` : p.name
}

function handleConfirm() {
  emit('confirm', { scorerId: scorerId.value, assistId: assistId.value })
}

function handleSkip() {
  emit('confirm', { scorerId: null, assistId: null })
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
    @click.self="emit('cancel')"
  >
    <div class="w-full max-w-sm bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">

      <div class="flex items-center justify-between mb-5">
        <div>
          <h2 class="text-base font-semibold text-white">⚽ But</h2>
          <p class="text-xs text-neutral-500 mt-0.5">Minute {{ props.minute }}'</p>
        </div>
        <button class="text-neutral-500 hover:text-white transition-colors p-1" @click="emit('cancel')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Buteur</label>
          <select
            v-model="scorerId"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all [color-scheme:dark]"
          >
            <option :value="null">Non précisé</option>
            <option v-for="p in props.players" :key="p.id" :value="p.id">{{ playerLabel(p) }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Passe décisive (optionnel)</label>
          <select
            v-model="assistId"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all [color-scheme:dark]"
          >
            <option :value="null">Aucune / non précisée</option>
            <option v-for="p in props.players" :key="p.id" :value="p.id" :disabled="p.id === scorerId">
              {{ playerLabel(p) }}
            </option>
          </select>
        </div>
      </div>

      <div class="flex gap-3 mt-5">
        <button
          class="flex-1 h-11 rounded-lg border border-white/10 text-neutral-400 text-sm font-medium
                 hover:border-white/20 hover:text-white transition-all"
          @click="handleSkip"
        >
          Passer
        </button>
        <button
          class="flex-1 h-11 rounded-lg bg-white text-neutral-900 text-sm font-semibold
                 hover:bg-neutral-100 transition-all"
          @click="handleConfirm"
        >
          Confirmer
        </button>
      </div>
    </div>
  </div>
</template>
