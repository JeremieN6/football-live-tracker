<script setup lang="ts">
import { computed } from 'vue'
import type { MatchEvent, ZoneX, ZoneY } from '@/types/match.types'

const props = defineProps<{
  events: MatchEvent[]
  // Si une action est sélectionnée (et nécessite un clic terrain), on l'affiche en hover
  activeAction: string | null
}>()

const emit = defineEmits<{
  pitchClick: [{ pitchX: number; pitchY: number; zoneX: ZoneX; zoneY: ZoneY }]
}>()

// Les actions qui ne nécessitent pas de clic sur le terrain
const NO_PITCH_ACTIONS = new Set(['SUBSTITUTION', 'YELLOW_CARD', 'RED_CARD'])

const needsPitchClick = computed(
  () => props.activeAction !== null && !NO_PITCH_ACTIONS.has(props.activeAction),
)

// Détermine la zone X selon la position relative (0→1)
function getZoneX(px: number): ZoneX {
  if (px < 0.18) return 'DEFENSIVE_BOX'
  if (px < 0.40) return 'DEFENSIVE_HALF'
  if (px < 0.60) return 'MIDFIELD'
  if (px < 0.82) return 'OFFENSIVE_HALF'
  return 'OFFENSIVE_BOX'
}

// Détermine la zone Y selon la position relative (0→1)
function getZoneY(py: number): ZoneY {
  if (py < 0.33) return 'LEFT_FLANK'
  if (py < 0.66) return 'CENTER'
  return 'RIGHT_FLANK'
}

function handleClick(e: MouseEvent) {
  if (!needsPitchClick.value) return

  const svg = (e.currentTarget as SVGSVGElement)
  const rect = svg.getBoundingClientRect()
  const pitchX = (e.clientX - rect.left) / rect.width
  const pitchY = (e.clientY - rect.top) / rect.height

  emit('pitchClick', {
    pitchX: Math.round(pitchX * 1000) / 1000,
    pitchY: Math.round(pitchY * 1000) / 1000,
    zoneX: getZoneX(pitchX),
    zoneY: getZoneY(pitchY),
  })
}

// Couleur du marqueur selon le type d'événement
const markerColors: Record<string, string> = {
  GOAL_FOR: '#22c55e',
  GOAL_AGAINST: '#ef4444',
  SHOT_ON_TARGET: '#3b82f6',
  SHOT_OFF_TARGET: '#6366f1',
  CHANCE_CLEAR: '#f59e0b',
  CORNER_FOR: '#06b6d4',
  CORNER_AGAINST: '#f97316',
  FREE_KICK_FOR: '#8b5cf6',
  FREE_KICK_AGAINST: '#ec4899',
  DANGER_SUFFERED: '#ef4444',
  YELLOW_CARD: '#eab308',
  RED_CARD: '#ef4444',
}

function markerColor(type: string): string {
  return markerColors[type] ?? '#94a3b8'
}

// Filtre les événements avec position sur le terrain
const pitchEvents = computed(() =>
  props.events.filter((e) => e.pitchX !== null && e.pitchY !== null),
)
</script>

<template>
  <div class="w-full px-4">
    <div class="relative w-full" style="aspect-ratio: 440/290;">
      <svg
        viewBox="0 0 440 290"
        class="w-full h-full rounded-xl"
        :class="needsPitchClick ? 'cursor-crosshair' : 'cursor-default'"
        @click="handleClick"
      >
        <!-- Pelouse -->
        <rect x="0" y="0" width="440" height="290" rx="10" fill="#166534" />

        <!-- Bandes de gazon alternées -->
        <rect x="0" y="0" width="55" height="290" fill="#15803d" opacity="0.4" />
        <rect x="110" y="0" width="55" height="290" fill="#15803d" opacity="0.4" />
        <rect x="220" y="0" width="55" height="290" fill="#15803d" opacity="0.4" />
        <rect x="330" y="0" width="55" height="290" fill="#15803d" opacity="0.4" />

        <!-- Lignes du terrain -->
        <!-- Bordure -->
        <rect x="8" y="8" width="424" height="274" rx="4" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" />

        <!-- Ligne médiane -->
        <line x1="220" y1="8" x2="220" y2="282" stroke="rgba(255,255,255,0.6)" stroke-width="2" />

        <!-- Cercle central -->
        <circle cx="220" cy="145" r="46" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" />
        <circle cx="220" cy="145" r="3" fill="rgba(255,255,255,0.6)" />

        <!-- Surface de réparation gauche (défensive) -->
        <rect x="8" y="76" width="66" height="138" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" />
        <!-- Surface de but gauche -->
        <rect x="8" y="112" width="24" height="66" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" />
        <!-- Point de penalty gauche -->
        <circle cx="52" cy="145" r="2.5" fill="rgba(255,255,255,0.6)" />

        <!-- Surface de réparation droite (offensive) -->
        <rect x="366" y="76" width="66" height="138" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" />
        <!-- Surface de but droite -->
        <rect x="408" y="112" width="24" height="66" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" />
        <!-- Point de penalty droit -->
        <circle cx="388" cy="145" r="2.5" fill="rgba(255,255,255,0.6)" />

        <!-- Cages -->
        <rect x="2" y="119" width="6" height="52" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2" />
        <rect x="432" y="119" width="6" height="52" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2" />

        <!-- Overlay hover si action sélectionnée -->
        <rect
          v-if="needsPitchClick"
          x="0" y="0" width="440" height="290"
          rx="10"
          fill="rgba(255,255,255,0.04)"
        />

        <!-- Marqueurs des événements -->
        <g v-for="event in pitchEvents" :key="event.id">
          <circle
            :cx="(event.pitchX ?? 0) * 440"
            :cy="(event.pitchY ?? 0) * 290"
            r="7"
            :fill="markerColor(event.type)"
            opacity="0.85"
          />
          <text
            :x="(event.pitchX ?? 0) * 440"
            :y="(event.pitchY ?? 0) * 290 - 10"
            text-anchor="middle"
            font-size="9"
            font-weight="600"
            fill="white"
            opacity="0.9"
          >{{ event.minute }}'</text>
        </g>
      </svg>

      <!-- Label directionnel -->
      <div class="flex justify-between px-1 mt-1">
        <span class="text-xs text-neutral-600">◀ Défense</span>
        <span class="text-xs text-neutral-600">Attaque ▶</span>
      </div>
    </div>
  </div>
</template>
