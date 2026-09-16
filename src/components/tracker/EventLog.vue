<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MatchEvent, Player } from '@/types/match.types'
import { eventColor, eventLabel } from '@/lib/eventPalette'

const props = defineProps<{
  events: MatchEvent[]
  players?: Player[]
  readOnly?: boolean
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

function playerName(id: string | null): string | null {
  if (!id) return null
  return props.players?.find((p) => p.id === id)?.name ?? null
}

const selectedId = ref<string | null>(null)

function toggleSelect(id: string) {
  if (props.readOnly) return
  selectedId.value = selectedId.value === id ? null : id
}

function handleDelete(id: string) {
  emit('delete', id)
  selectedId.value = null
}

function label(event: MatchEvent): string {
  if (event.type === 'SUBSTITUTION') {
    const playerIn = playerName(event.playerInId)
    const playerOut = playerName(event.playerOutId)
    if (playerIn && playerOut) return `${playerIn} ↔ ${playerOut}`
    return eventLabel(event.type)
  }
  if (event.type === 'GOAL_FOR') {
    const scorer = playerName(event.scorerId)
    const assist = playerName(event.assistId)
    if (scorer && assist) return `But — ${scorer} (passe : ${assist})`
    if (scorer) return `But — ${scorer}`
    return eventLabel(event.type)
  }
  const player = playerName(event.playerId)
  if (player) return `${eventLabel(event.type)} — ${player}`
  return eventLabel(event.type)
}

function zoneLabel(event: MatchEvent): string {
  if (!event.zoneX) return ''
  const zx: Record<string, string> = {
    DEFENSIVE_BOX: 'surface déf.',
    DEFENSIVE_HALF: 'défense',
    MIDFIELD: 'milieu',
    OFFENSIVE_HALF: 'attaque',
    OFFENSIVE_BOX: 'surface off.',
  }
  const zy: Record<string, string> = {
    LEFT_FLANK: 'aile gauche',
    CENTER: 'axe',
    RIGHT_FLANK: 'aile droite',
  }
  return [zx[event.zoneX], event.zoneY ? zy[event.zoneY] : ''].filter(Boolean).join(' · ')
}

const sortedEvents = computed(() =>
  [...props.events].sort((a, b) => {
    if (b.minute !== a.minute) return b.minute - a.minute
    return b.createdAt.localeCompare(a.createdAt)
  }),
)
</script>

<template>
  <div>
    <p v-if="sortedEvents.length === 0" class="bg-surface border border-line rounded-card px-4 py-[18px] text-center text-[13px] text-ink-meta leading-relaxed">
      Aucun événement — place le premier sur le terrain
    </p>

    <div v-else class="flex flex-col gap-1">
      <div v-for="event in sortedEvents" :key="event.id" class="bg-surface border border-line rounded-card overflow-hidden">
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-hover transition-colors"
          @click="toggleSelect(event.id)"
        >
          <span class="w-[9px] h-[9px] rounded-full flex-none" :style="{ background: eventColor(event.type) }" />
          <span class="font-score text-[13px] font-bold text-ink min-w-[30px]">{{ event.minute }}'</span>
          <span class="flex-1 text-sm text-ink-body truncate">{{ label(event) }}</span>
          <span class="text-[11px] text-ink-meta text-right shrink-0">{{ zoneLabel(event) }}</span>
        </button>

        <button
          v-if="selectedId === event.id && !readOnly"
          class="w-full h-11 border-0 border-t border-danger-line bg-danger-soft text-danger text-[13px] font-medium text-center"
          @click="handleDelete(event.id)"
        >
          Supprimer l'événement
        </button>
      </div>
    </div>
  </div>
</template>
