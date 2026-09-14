<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import type { EventType, Player } from '@/types/match.types'

const props = defineProps<{
  type: EventType
  minute: number
  players: Player[]
}>()

const emit = defineEmits<{
  confirm: [playerId: string | null]
  cancel: []
}>()

const playerId = ref<string | null>(null)

function playerLabel(p: Player): string {
  return p.number != null ? `#${p.number} ${p.name}` : p.name
}

function handleConfirm() {
  emit('confirm', playerId.value)
}

function handleSkip() {
  emit('confirm', null)
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
    @click.self="emit('cancel')"
  >
    <div class="w-full max-w-sm bg-surface border border-line rounded-card p-6">

      <div class="flex items-center justify-between mb-5">
        <div>
          <h2 class="flex items-center gap-2 text-base font-semibold text-ink">
            <span
              class="w-[9px] h-[9px] rounded-full"
              :style="{ background: props.type === 'RED_CARD' ? '#EF4444' : '#FBBF24' }"
            />
            {{ props.type === 'RED_CARD' ? 'Carton rouge' : 'Carton jaune' }}
          </h2>
          <p class="text-xs text-ink-meta mt-0.5">Minute {{ props.minute }}'</p>
        </div>
        <button class="text-ink-meta hover:text-ink transition-colors p-1" @click="emit('cancel')">
          <X :size="18" :stroke-width="2" />
        </button>
      </div>

      <div class="space-y-1">
        <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Joueur</label>
        <select
          v-model="playerId"
          class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                 text-sm focus:outline-none focus:border-brand transition-colors [color-scheme:dark]"
        >
          <option :value="null">Non précisé</option>
          <option v-for="p in props.players" :key="p.id" :value="p.id">{{ playerLabel(p) }}</option>
        </select>
      </div>

      <div class="flex gap-3 mt-5">
        <button
          class="flex-1 h-11 rounded-btn border border-line text-ink-secondary text-sm font-medium
                 hover:border-line-strong hover:text-ink transition-colors"
          @click="handleSkip"
        >
          Passer
        </button>
        <button
          class="flex-1 h-11 rounded-btn bg-brand text-brand-soft text-sm font-semibold
                 hover:bg-brand-hover transition-colors"
          @click="handleConfirm"
        >
          Confirmer
        </button>
      </div>
    </div>
  </div>
</template>
