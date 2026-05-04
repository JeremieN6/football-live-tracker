<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  minute: number
}>()

const emit = defineEmits<{
  confirm: [{ playerIn: string; playerOut: string }]
  cancel: []
}>()

const playerIn = ref('')
const playerOut = ref('')

function handleConfirm() {
  if (!playerIn.value.trim() || !playerOut.value.trim()) return
  emit('confirm', {
    playerIn: playerIn.value.trim(),
    playerOut: playerOut.value.trim(),
  })
  // Reset
  playerIn.value = ''
  playerOut.value = ''
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

      <!-- Champs -->
      <div class="space-y-4">
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            🟢 Joueur qui entre
          </label>
          <input
            v-model="playerIn"
            type="text"
            placeholder="Nom du joueur"
            maxlength="50"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            🔴 Joueur qui sort
          </label>
          <input
            v-model="playerOut"
            type="text"
            placeholder="Nom du joueur"
            maxlength="50"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          />
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
          :disabled="!playerIn.trim() || !playerOut.trim()"
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
