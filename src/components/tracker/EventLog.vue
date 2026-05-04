<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MatchEvent } from '@/types/match.types'

const props = defineProps<{
  events: MatchEvent[]
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

// ID de l'événement sélectionné pour afficher la barre de suppression
const selectedId = ref<string | null>(null)

function toggleSelect(id: string) {
  selectedId.value = selectedId.value === id ? null : id
}

function handleDelete(id: string) {
  emit('delete', id)
  selectedId.value = null
}

// Labels lisibles par type d'événement
const eventLabels: Record<string, string> = {
  GOAL_FOR: '⚽ But',
  GOAL_AGAINST: '⚽ But encaissé',
  SHOT_ON_TARGET: 'Tir cadré',
  SHOT_OFF_TARGET: 'Tir raté',
  CHANCE_CLEAR: 'Occasion nette',
  CORNER_FOR: 'Corner',
  CORNER_AGAINST: 'Corner concédé',
  FREE_KICK_FOR: 'Coup franc',
  FREE_KICK_AGAINST: 'Coup franc concédé',
  DANGER_SUFFERED: 'Danger subi',
  YELLOW_CARD: '🟨 Carton jaune',
  RED_CARD: '🟥 Carton rouge',
  SUBSTITUTION: '🔄 Remplacement',
}

// Couleur du point selon le type
const dotColors: Record<string, string> = {
  GOAL_FOR: 'bg-green-400',
  GOAL_AGAINST: 'bg-red-400',
  SHOT_ON_TARGET: 'bg-blue-400',
  SHOT_OFF_TARGET: 'bg-indigo-400',
  CHANCE_CLEAR: 'bg-amber-400',
  CORNER_FOR: 'bg-cyan-400',
  CORNER_AGAINST: 'bg-orange-400',
  FREE_KICK_FOR: 'bg-violet-400',
  FREE_KICK_AGAINST: 'bg-pink-400',
  DANGER_SUFFERED: 'bg-red-500',
  YELLOW_CARD: 'bg-yellow-400',
  RED_CARD: 'bg-red-500',
  SUBSTITUTION: 'bg-neutral-400',
}

function dotColor(type: string): string {
  return dotColors[type] ?? 'bg-neutral-500'
}

function label(event: MatchEvent): string {
  if (event.type === 'SUBSTITUTION' && event.playerIn && event.playerOut) {
    return `🔄 ${event.playerIn} ↔ ${event.playerOut}`
  }
  return eventLabels[event.type] ?? event.type
}

function zoneLabel(event: MatchEvent): string {
  if (!event.zoneX) return ''
  const zx: Record<string, string> = {
    DEFENSIVE_BOX: 'Srt. déf.',
    DEFENSIVE_HALF: 'Camp déf.',
    MIDFIELD: 'Milieu',
    OFFENSIVE_HALF: 'Camp off.',
    OFFENSIVE_BOX: 'Srt. off.',
  }
  const zy: Record<string, string> = {
    LEFT_FLANK: 'gauche',
    CENTER: 'centre',
    RIGHT_FLANK: 'droite',
  }
  return [zx[event.zoneX], event.zoneY ? zy[event.zoneY] : ''].filter(Boolean).join(' · ')
}

// Tri inverse : dernier événement en haut
const sortedEvents = computed(() =>
  [...props.events].sort((a, b) => {
    if (b.minute !== a.minute) return b.minute - a.minute
    return b.createdAt.localeCompare(a.createdAt)
  }),
)
</script>

<template>
  <div class="px-4">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
      Événements ({{ props.events.length }})
    </h3>

    <!-- Liste vide -->
    <p v-if="sortedEvents.length === 0" class="text-sm text-neutral-600 text-center py-6">
      Aucun événement enregistré
    </p>

    <!-- Liste des événements -->
    <div v-else class="space-y-1">
      <div
        v-for="event in sortedEvents"
        :key="event.id"
        class="rounded-xl overflow-hidden"
      >
        <!-- Ligne principale -->
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all rounded-xl"
          :class="selectedId === event.id ? 'bg-white/10' : 'hover:bg-white/5'"
          @click="toggleSelect(event.id)"
        >
          <!-- Point coloré -->
          <div class="w-2.5 h-2.5 rounded-full shrink-0" :class="dotColor(event.type)" />

          <!-- Contenu -->
          <div class="flex-1 min-w-0">
            <span class="text-sm text-white font-medium">{{ label(event) }}</span>
            <span v-if="zoneLabel(event)" class="text-xs text-neutral-500 ml-2">{{ zoneLabel(event) }}</span>
          </div>

          <!-- Minute -->
          <span class="text-xs font-semibold text-neutral-400 tabular-nums shrink-0">{{ event.minute }}'</span>
        </button>

        <!-- Barre de suppression (slide down) -->
        <div v-if="selectedId === event.id" class="px-3 pb-2">
          <button
            class="w-full h-9 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium
                   hover:bg-red-500/25 transition-all"
            @click="handleDelete(event.id)"
          >
            Supprimer cet événement
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
