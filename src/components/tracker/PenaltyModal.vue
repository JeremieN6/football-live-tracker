<script setup lang="ts">
import { ref, computed } from 'vue'
import { X } from 'lucide-vue-next'
import { eventMeta } from '@/lib/eventPalette'
import type { EventType, Player } from '@/types/match.types'

const props = defineProps<{
  type: EventType // 'PENALTY_FOR' | 'PENALTY_AGAINST'
  minute: number
  players: Player[]
}>()

const emit = defineEmits<{
  confirm: [data: { scored: boolean; takerId: string | null }]
  cancel: []
}>()

const takerId = ref<string | null>(null)
const scored = ref<boolean | null>(null)
const meta = eventMeta(props.type)
const isFor = props.type === 'PENALTY_FOR'

function playerLabel(p: Player): string {
  return p.number != null ? `#${p.number} ${p.name}` : p.name
}

const canConfirm = computed(() => scored.value !== null)

function handleConfirm() {
  if (scored.value === null) return
  emit('confirm', { scored: scored.value, takerId: isFor ? takerId.value : null })
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
            <span class="w-[9px] h-[9px] rounded-full" :style="{ background: meta.color }" />
            {{ meta.label }}
          </h2>
          <p class="text-xs text-ink-meta mt-0.5">Minute {{ props.minute }}'</p>
        </div>
        <button class="text-ink-meta hover:text-ink transition-colors p-1" @click="emit('cancel')">
          <X :size="18" :stroke-width="2" />
        </button>
      </div>

      <div v-if="isFor" class="space-y-1 mb-4">
        <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Tireur</label>
        <select
          v-model="takerId"
          class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                 text-sm focus:outline-none focus:border-brand transition-colors [color-scheme:dark]"
        >
          <option :value="null">Non précisé</option>
          <option v-for="p in props.players" :key="p.id" :value="p.id">{{ playerLabel(p) }}</option>
        </select>
      </div>

      <div class="space-y-1">
        <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Résultat</label>
        <div class="flex gap-1 p-[3px] bg-surface-sub border border-line rounded-input">
          <button
            type="button"
            class="flex-1 h-9 rounded-[7px] text-sm font-medium transition-colors"
            :class="scored === true ? 'bg-brand-soft border border-brand-line text-brand-ink' : 'bg-transparent border border-transparent text-ink-meta'"
            @click="scored = true"
          >
            Marqué
          </button>
          <button
            type="button"
            class="flex-1 h-9 rounded-[7px] text-sm font-medium transition-colors"
            :class="scored === false ? 'bg-danger-soft border border-danger-line text-danger' : 'bg-transparent border border-transparent text-ink-meta'"
            @click="scored = false"
          >
            Non marqué
          </button>
        </div>
      </div>

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
                 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="handleConfirm"
        >
          Confirmer
        </button>
      </div>
    </div>
  </div>
</template>
