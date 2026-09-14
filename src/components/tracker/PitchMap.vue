<script setup lang="ts">
import { computed } from 'vue'
import type { MatchEvent, ZoneX, ZoneY } from '@/types/match.types'
import { eventColor } from '@/lib/eventPalette'

const props = defineProps<{
  events: MatchEvent[]
  // Si une action est sélectionnée (et nécessite un tap terrain), on l'affiche en hint
  activeAction: string | null
  hint: string
}>()

const emit = defineEmits<{
  pitchClick: [{ pitchX: number; pitchY: number; zoneX: ZoneX; zoneY: ZoneY }]
}>()

// Les actions qui ne nécessitent pas de tap sur le terrain (elles s'enregistrent
// directement, éventuellement après un choix de joueur dans une modale à part)
const NO_PITCH_ACTIONS = new Set(['SUBSTITUTION', 'YELLOW_CARD', 'RED_CARD'])

const needsPitchClick = computed(
  () => props.activeAction !== null && !NO_PITCH_ACTIONS.has(props.activeAction),
)

// Terrain en portrait (but adverse en haut, but du club en bas — convention tableau
// tactique) : pitchY détermine la bande offensive/défensive, pitchX le couloir.
// C'est une rotation à 90° de l'ancienne convention (terrain horizontal, pitchX =
// bande, pitchY = couloir) — même structure de données (ZoneX/ZoneY, pitchX/pitchY
// 0..1 inchangés), juste réinterprétée pour matcher la nouvelle orientation.
function getZoneX(pitchY: number): ZoneX {
  if (pitchY < 0.18) return 'OFFENSIVE_BOX'
  if (pitchY < 0.40) return 'OFFENSIVE_HALF'
  if (pitchY < 0.60) return 'MIDFIELD'
  if (pitchY < 0.82) return 'DEFENSIVE_HALF'
  return 'DEFENSIVE_BOX'
}
function getZoneY(pitchX: number): ZoneY {
  if (pitchX < 0.33) return 'LEFT_FLANK'
  if (pitchX < 0.66) return 'CENTER'
  return 'RIGHT_FLANK'
}

function handleClick(e: MouseEvent) {
  if (!needsPitchClick.value) return

  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const pitchX = (e.clientX - rect.left) / rect.width
  const pitchY = (e.clientY - rect.top) / rect.height

  emit('pitchClick', {
    pitchX: Math.round(pitchX * 1000) / 1000,
    pitchY: Math.round(pitchY * 1000) / 1000,
    zoneX: getZoneX(pitchY),
    zoneY: getZoneY(pitchX),
  })
}

const pitchEvents = computed(() => props.events.filter((e) => e.pitchX !== null && e.pitchY !== null))
</script>

<template>
  <div
    class="relative h-[300px] bg-pitch overflow-hidden"
    :class="needsPitchClick ? 'cursor-crosshair' : 'cursor-default'"
    @click="handleClick"
  >
    <!-- Bandes de tonte -->
    <div
      class="absolute inset-0"
      style="background: repeating-linear-gradient(to bottom, rgba(255,255,255,.022) 0 33px, transparent 33px 66px)"
    />

    <!-- Lignes du terrain -->
    <svg viewBox="0 0 68 105" preserveAspectRatio="none" class="absolute inset-0 w-full h-full pointer-events-none" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="0.4">
      <rect x="2" y="2" width="64" height="101" />
      <line x1="2" y1="52.5" x2="66" y2="52.5" />
      <circle cx="34" cy="52.5" r="9" />
      <circle cx="34" cy="52.5" r="0.7" fill="rgba(255,255,255,.5)" stroke="none" />
      <rect x="14" y="2" width="40" height="16" />
      <rect x="25" y="2" width="18" height="6" />
      <rect x="14" y="87" width="40" height="16" />
      <rect x="25" y="97" width="18" height="6" />
      <circle cx="34" cy="13" r="0.7" fill="rgba(255,255,255,.5)" stroke="none" />
      <circle cx="34" cy="92" r="0.7" fill="rgba(255,255,255,.5)" stroke="none" />
    </svg>

    <!-- Marqueurs des événements -->
    <div
      v-for="event in pitchEvents"
      :key="event.id"
      class="absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2"
      :style="{ left: `${(event.pitchX ?? 0) * 100}%`, top: `${(event.pitchY ?? 0) * 100}%` }"
    >
      <span
        class="w-[11px] h-[11px] rounded-full border-[1.5px]"
        :style="{ background: eventColor(event.type), borderColor: 'rgba(15,25,35,.7)' }"
      />
      <span class="font-score text-[9px] font-bold text-ink" style="text-shadow: 0 1px 2px rgba(0,0,0,.8)">{{ event.minute }}'</span>
    </div>

    <!-- Barre d'indication — en HAUT (pas en bas comme sur le HTML brut de la
         maquette) et pointer-events:none : place en bas, elle interceptait les taps
         sur le gardien (bug documente explicitement dans le handoff design). -->
    <div
      class="absolute left-3 right-3 top-2.5 text-center px-2.5 py-[7px] rounded-input font-medium text-xs transition-opacity pointer-events-none"
      :style="{ background: 'rgba(15,25,35,.88)', border: '1px solid #374151', color: '#F9FAFB', opacity: hint ? 1 : 0 }"
    >
      {{ hint }}
    </div>
  </div>
</template>
