<script setup lang="ts">
import type { EventType } from '@/types/match.types'

const props = defineProps<{
  selectedAction: EventType | null
}>()

const emit = defineEmits<{
  select: [action: EventType]
  deselect: []
  openSubstitution: []
}>()

// Groupes de boutons d'action
const groups = [
  {
    label: 'Offensif',
    color: 'green',
    actions: [
      { type: 'GOAL_FOR' as EventType, label: '⚽ But' },
      { type: 'SHOT_ON_TARGET' as EventType, label: 'Tir cadré' },
      { type: 'SHOT_OFF_TARGET' as EventType, label: 'Tir raté' },
      { type: 'CHANCE_CLEAR' as EventType, label: 'Occasion nette' },
      { type: 'CORNER_FOR' as EventType, label: 'Corner' },
      { type: 'FREE_KICK_FOR' as EventType, label: 'Coup franc' },
    ],
  },
  {
    label: 'Défensif',
    color: 'red',
    actions: [
      { type: 'GOAL_AGAINST' as EventType, label: '⚽ But encaissé' },
      { type: 'DANGER_SUFFERED' as EventType, label: 'Danger subi' },
      { type: 'CORNER_AGAINST' as EventType, label: 'Corner concédé' },
      { type: 'FREE_KICK_AGAINST' as EventType, label: 'Coup franc concédé' },
    ],
  },
  {
    label: 'Disciplinaire & Tactique',
    color: 'yellow',
    actions: [
      { type: 'YELLOW_CARD' as EventType, label: '🟨 Carton jaune' },
      { type: 'RED_CARD' as EventType, label: '🟥 Carton rouge' },
    ],
  },
] as const

// Styles par groupe
const groupStyles = {
  green: {
    active: 'bg-green-500/20 border-green-500/50 text-green-300',
    inactive: 'bg-white/5 border-white/10 text-neutral-300 hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-300',
    label: 'text-green-400',
  },
  red: {
    active: 'bg-red-500/20 border-red-500/50 text-red-300',
    inactive: 'bg-white/5 border-white/10 text-neutral-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300',
    label: 'text-red-400',
  },
  yellow: {
    active: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    inactive: 'bg-white/5 border-white/10 text-neutral-300 hover:bg-yellow-500/10 hover:border-yellow-500/30 hover:text-yellow-300',
    label: 'text-yellow-400',
  },
} as const

function handleClick(type: EventType) {
  if (type === 'SUBSTITUTION') {
    emit('openSubstitution')
    return
  }
  if (props.selectedAction === type) {
    emit('deselect')
  } else {
    emit('select', type)
  }
}
</script>

<template>
  <div class="px-4 space-y-4">
    <!-- Groupes d'actions -->
    <div v-for="group in groups" :key="group.label">
      <p class="text-xs font-semibold uppercase tracking-wide mb-2" :class="groupStyles[group.color].label">
        {{ group.label }}
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="action in group.actions"
          :key="action.type"
          class="h-12 px-3 rounded-xl border text-sm font-medium transition-all text-left"
          :class="props.selectedAction === action.type
            ? groupStyles[group.color].active
            : groupStyles[group.color].inactive"
          @click="handleClick(action.type)"
        >
          {{ action.label }}
        </button>
      </div>
    </div>

    <!-- Remplacement (séparé car ouvre directement la modal) -->
    <div>
      <p class="text-xs font-semibold uppercase tracking-wide mb-2 text-neutral-400">Tactique</p>
      <button
        class="w-full h-12 px-3 rounded-xl border border-white/10 bg-white/5 text-neutral-300
               text-sm font-medium hover:bg-white/10 hover:text-white transition-all text-left"
        @click="emit('openSubstitution')"
      >
        🔄 Remplacement
      </button>
    </div>
  </div>
</template>
