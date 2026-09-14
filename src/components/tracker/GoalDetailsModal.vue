<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
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
    <div class="w-full max-w-sm bg-surface border border-line rounded-card p-6">

      <div class="flex items-center justify-between mb-5">
        <div>
          <h2 class="text-base font-semibold text-ink">But</h2>
          <p class="text-xs text-ink-meta mt-0.5">Minute {{ props.minute }}'</p>
        </div>
        <button class="text-ink-meta hover:text-ink transition-colors p-1" @click="emit('cancel')">
          <X :size="18" :stroke-width="2" />
        </button>
      </div>

      <div class="space-y-4">
        <div class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Buteur</label>
          <select
            v-model="scorerId"
            class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                   text-sm focus:outline-none focus:border-brand transition-colors [color-scheme:dark]"
          >
            <option :value="null">Non précisé</option>
            <option v-for="p in props.players" :key="p.id" :value="p.id">{{ playerLabel(p) }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Passe décisive (optionnel)</label>
          <select
            v-model="assistId"
            class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                   text-sm focus:outline-none focus:border-brand transition-colors [color-scheme:dark]"
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
