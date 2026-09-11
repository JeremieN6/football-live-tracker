<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Player } from '@/types/match.types'

const props = defineProps<{
  minute: number
  players: Player[]
}>()

const emit = defineEmits<{
  confirm: [{ playerInId: string; playerOutId: string }]
  cancel: []
}>()

const playerInId = ref<string | null>(null)
const playerOutId = ref<string | null>(null)

const canConfirm = computed(
  () => !!playerInId.value && !!playerOutId.value && playerInId.value !== playerOutId.value,
)

function playerLabel(p: Player): string {
  return p.number != null ? `#${p.number} ${p.name}` : p.name
}

function handleConfirm() {
  if (!canConfirm.value) return
  emit('confirm', { playerInId: playerInId.value!, playerOutId: playerOutId.value! })
}
</script>

<template>
  <!-- Overlay -->
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
    @click.self="emit('cancel')"
  >
    <div class="w-full max-w-sm bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">

      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <div>
          <h2 class="text-base font-semibold text-white">Remplacement</h2>
          <p class="text-xs text-neutral-500 mt-0.5">Minute {{ props.minute }}'</p>
        </div>
        <button class="text-neutral-500 hover:text-white transition-colors p-1" @click="emit('cancel')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Pas d'effectif sélectionné pour ce match -->
      <p v-if="props.players.length === 0" class="text-sm text-neutral-400 bg-white/5 border border-white/10 rounded-lg px-3 py-3">
        Aucun effectif sélectionné pour ce match. Renseignez d'abord les titulaires et remplaçants pour saisir un remplacement nominatif.
      </p>

      <!-- Champs -->
      <div v-else class="space-y-4">
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            🟢 Joueur qui entre
          </label>
          <select
            v-model="playerInId"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all [color-scheme:dark]"
          >
            <option :value="null" disabled>Sélectionner...</option>
            <option v-for="p in props.players" :key="p.id" :value="p.id" :disabled="p.id === playerOutId">
              {{ playerLabel(p) }}
            </option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            🔴 Joueur qui sort
          </label>
          <select
            v-model="playerOutId"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all [color-scheme:dark]"
          >
            <option :value="null" disabled>Sélectionner...</option>
            <option v-for="p in props.players" :key="p.id" :value="p.id" :disabled="p.id === playerInId">
              {{ playerLabel(p) }}
            </option>
          </select>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-3 mt-5">
        <button
          class="flex-1 h-11 rounded-lg border border-white/10 text-neutral-400 text-sm font-medium
                 hover:border-white/20 hover:text-white transition-all"
          @click="emit('cancel')"
        >
          Annuler
        </button>
        <button
          :disabled="!canConfirm"
          class="flex-1 h-11 rounded-lg bg-white text-neutral-900 text-sm font-semibold
                 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          @click="handleConfirm"
        >
          Confirmer
        </button>
      </div>
    </div>
  </div>
</template>
