<script setup lang="ts">
import type { EventType } from '@/types/match.types'
import { eventsByGroup } from '@/lib/eventPalette'

const props = defineProps<{
  selectedAction: EventType | null
}>()

const emit = defineEmits<{
  select: [action: EventType]
  deselect: []
  openSubstitution: []
}>()

const GROUPS = [
  { label: 'Offensif', events: eventsByGroup('Offensif') },
  { label: 'Défensif', events: eventsByGroup('Défensif') },
  { label: 'Disciplinaire', events: eventsByGroup('Disciplinaire') },
]

function handleClick(type: EventType) {
  if (type === 'SUBSTITUTION') {
    emit('openSubstitution')
    return
  }
  if (props.selectedAction === type) emit('deselect')
  else emit('select', type)
}
</script>

<template>
  <div class="flex-none px-3 pt-2.5 pb-2 border-b border-line">
    <div v-for="group in GROUPS" :key="group.label" class="mb-2 last:mb-0">
      <p class="text-[11px] font-medium tracking-[.5px] text-ink-meta mx-0.5 mb-1.5">{{ group.label }}</p>
      <div class="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        <button
          v-for="e in group.events"
          :key="e.type"
          class="flex items-center gap-1.5 flex-none min-h-11 px-3 rounded-btn text-sm font-medium whitespace-nowrap border transition-colors text-left"
          :style="selectedAction === e.type
            ? { background: e.bg, borderColor: e.color, borderWidth: '1.5px', color: '#F9FAFB' }
            : { background: e.bg, borderColor: e.border, color: '#D1D5DB' }"
          @click="handleClick(e.type)"
        >
          <span
            class="w-[7px] h-[7px] rounded-full flex-none"
            :style="{ background: e.color, boxShadow: selectedAction === e.type ? `0 0 0 3px ${e.color}33` : 'none' }"
          />
          {{ e.label }}
        </button>
      </div>
    </div>
  </div>
</template>
