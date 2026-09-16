import type { Component } from 'vue'
import {
  Goal,
  Sparkles,
  Target,
  CircleDot,
  CornerUpRight,
  CornerDownRight,
  Flag,
  ShieldAlert,
  ArrowLeftRight,
  RectangleVertical,
  Hand,
  ShieldCheck,
  ShieldX,
  Footprints,
  Radar,
  Crosshair,
  OctagonAlert,
} from 'lucide-vue-next'
import type { EventType } from '@/types/match.types'

export interface EventMeta {
  type: EventType
  label: string
  color: string
  bg: string
  border: string
  group: 'Offensif' | 'Défensif' | 'Disciplinaire'
  icon: Component
}

// Palette d'événements de la refonte (voir handoff design, 01-tokens.md + TrackerView
// mockup), étendue au fil des sessions (ballons récupérés/perdus, tacles, pénalties...).
// Icônes Lucide (jamais d'emoji, règle du design system) réintroduites sur demande
// explicite de l'utilisateur pour la chronologie (comme les apps de score en live).
export const EVENT_PALETTE: EventMeta[] = [
  { type: 'GOAL_FOR', label: 'But marqué', color: '#22C55E', bg: '#052e16', border: '#166534', group: 'Offensif', icon: Goal },
  { type: 'CHANCE_CLEAR', label: 'Occasion franche', color: '#FBBF24', bg: '#1c1917', border: '#78716c', group: 'Offensif', icon: Sparkles },
  { type: 'SHOT_ON_TARGET', label: 'Tir cadré', color: '#86EFAC', bg: '#052e16', border: '#166534', group: 'Offensif', icon: Target },
  { type: 'SHOT_OFF_TARGET', label: 'Tir non cadré', color: '#9CA3AF', bg: '#1c1917', border: '#374151', group: 'Offensif', icon: CircleDot },
  { type: 'CORNER_FOR', label: 'Corner', color: '#60A5FA', bg: '#172554', border: '#1e40af', group: 'Offensif', icon: CornerUpRight },
  { type: 'FREE_KICK_FOR', label: 'Coup franc', color: '#93C5FD', bg: '#172554', border: '#1e40af', group: 'Offensif', icon: Flag },
  { type: 'PENALTY_FOR', label: 'Pénalty obtenu', color: '#22C55E', bg: '#052e16', border: '#166534', group: 'Offensif', icon: Crosshair },
  { type: 'FOUL_SUFFERED', label: 'Faute subie', color: '#4ADE80', bg: '#052e16', border: '#166534', group: 'Offensif', icon: Hand },
  { type: 'GOAL_AGAINST', label: 'But concédé', color: '#F87171', bg: '#450a0a', border: '#7f1d1d', group: 'Défensif', icon: Goal },
  { type: 'DANGER_SUFFERED', label: 'Danger subi', color: '#F87171', bg: '#450a0a', border: '#7f1d1d', group: 'Défensif', icon: ShieldAlert },
  { type: 'CORNER_AGAINST', label: 'Corner concédé', color: '#FB923C', bg: '#431407', border: '#9a3412', group: 'Défensif', icon: CornerDownRight },
  { type: 'FREE_KICK_AGAINST', label: 'Coup franc concédé', color: '#F472B6', bg: '#500724', border: '#9d174d', group: 'Défensif', icon: Flag },
  { type: 'PENALTY_AGAINST', label: 'Pénalty concédé', color: '#EF4444', bg: '#450a0a', border: '#7f1d1d', group: 'Défensif', icon: OctagonAlert },
  { type: 'FOUL_COMMITTED', label: 'Faute commise', color: '#FB923C', bg: '#431407', border: '#9a3412', group: 'Défensif', icon: Hand },
  { type: 'BALL_WON', label: 'Ballon récupéré', color: '#4ADE80', bg: '#052e16', border: '#166534', group: 'Défensif', icon: ShieldCheck },
  { type: 'INTERCEPTION', label: 'Interception', color: '#38BDF8', bg: '#0c4a6e', border: '#075985', group: 'Défensif', icon: Radar },
  { type: 'TACKLE', label: 'Tacle', color: '#60A5FA', bg: '#172554', border: '#1e40af', group: 'Défensif', icon: Footprints },
  { type: 'BALL_LOST', label: 'Ballon perdu', color: '#F87171', bg: '#450a0a', border: '#7f1d1d', group: 'Offensif', icon: ShieldX },
  { type: 'SUBSTITUTION', label: 'Remplacement', color: '#A8A29E', bg: '#1c1917', border: '#78716c', group: 'Défensif', icon: ArrowLeftRight },
  { type: 'YELLOW_CARD', label: 'Carton jaune', color: '#FBBF24', bg: '#451a03', border: '#78716c', group: 'Disciplinaire', icon: RectangleVertical },
  { type: 'RED_CARD', label: 'Carton rouge', color: '#EF4444', bg: '#450a0a', border: '#7f1d1d', group: 'Disciplinaire', icon: RectangleVertical },
]

const BY_TYPE = new Map(EVENT_PALETTE.map((e) => [e.type, e]))
const FALLBACK: EventMeta = { type: 'GOAL_FOR', label: '', color: '#9CA3AF', bg: '#1c1917', border: '#374151', group: 'Offensif', icon: CircleDot }

export function eventMeta(type: EventType): EventMeta {
  return BY_TYPE.get(type) ?? { ...FALLBACK, type }
}

export function eventColor(type: EventType): string {
  return BY_TYPE.get(type)?.color ?? '#9CA3AF'
}

export function eventLabel(type: EventType): string {
  return BY_TYPE.get(type)?.label ?? type
}

export function eventsByGroup(group: EventMeta['group']): EventMeta[] {
  return EVENT_PALETTE.filter((e) => e.group === group)
}
