<script setup lang="ts">
import { ref, computed } from 'vue'
import { X } from 'lucide-vue-next'
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
    <div class="w-full max-w-sm bg-surface border border-line rounded-card p-6">

      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <div>
          <h2 class="text-base font-semibold text-ink">Remplacement</h2>
          <p class="text-xs text-ink-meta mt-0.5">Minute {{ props.minute }}'</p>
        </div>
        <button class="text-ink-meta hover:text-ink transition-colors p-1" @click="emit('cancel')">
          <X :size="18" :stroke-width="2" />
        </button>
      </div>

      <!-- Pas d'effectif sélectionné pour ce match -->
      <p v-if="props.players.length === 0" class="text-sm text-ink-secondary bg-surface-sub border border-line rounded-input px-3 py-3">
        Aucun effectif sélectionné pour ce match. Renseignez d'abord les titulaires et remplaçants pour saisir un remplacement nominatif.
      </p>

      <!-- Champs -->
      <div v-else class="space-y-4">
        <div class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">
            Joueur qui entre
          </label>
          <select
            v-model="playerInId"
            class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                   text-sm focus:outline-none focus:border-brand transition-colors [color-scheme:dark]"
          >
            <option :value="null" disabled>Sélectionner...</option>
            <option v-for="p in props.players" :key="p.id" :value="p.id" :disabled="p.id === playerOutId">
              {{ playerLabel(p) }}
            </option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">
            Joueur qui sort
          </label>
          <select
            v-model="playerOutId"
            class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                   text-sm focus:outline-none focus:border-brand transition-colors [color-scheme:dark]"
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
          class="flex-1 h-11 rounded-btn border border-line text-ink-secondary text-sm font-medium
                 hover:border-line-strong hover:text-ink transition-colors"
          @click="emit('cancel')"
        >
          Annuler
        </button>
        <button
          :disabled="!canConfirm"
          class="flex-1 h-11 rounded-btn bg-brand text-brand-soft text-sm font-semibold
                 hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          @click="handleConfirm"
        >
          Confirmer
        </button>
      </div>
    </div>
  </div>
</template>
