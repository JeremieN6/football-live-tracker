import type { EventType } from '@/types/match.types'

export interface EventMeta {
  type: EventType
  label: string
  color: string
  bg: string
  border: string
  group: 'Offensif' | 'Défensif' | 'Disciplinaire'
}

// Palette d'événements de la refonte (voir handoff design, 01-tokens.md + TrackerView
// mockup). Volontairement plus restreinte que l'enum EventType complet : la maquette
// ne propose plus CORNER_AGAINST/FREE_KICK_AGAINST comme boutons de saisie (11 chips
// au lieu de 13) — un choix du design non documenté comme un ecart assume dans le
// README, mais reproduit tel quel depuis la maquette + 01-tokens.md (qui omet aussi
// ces deux types de sa table de couleurs). Les types retires restent des valeurs
// EventType valides (aucun changement de schema) : un evenement historique de ce
// type s'affiche toujours normalement (EventLog, Report), juste plus creable depuis
// le Tracker redessine.
export const EVENT_PALETTE: EventMeta[] = [
  { type: 'GOAL_FOR', label: 'But marqué', color: '#22C55E', bg: '#052e16', border: '#166534', group: 'Offensif' },
  { type: 'CHANCE_CLEAR', label: 'Occasion franche', color: '#FBBF24', bg: '#1c1917', border: '#78716c', group: 'Offensif' },
  { type: 'SHOT_ON_TARGET', label: 'Tir cadré', color: '#86EFAC', bg: '#052e16', border: '#166534', group: 'Offensif' },
  { type: 'SHOT_OFF_TARGET', label: 'Tir non cadré', color: '#9CA3AF', bg: '#1c1917', border: '#374151', group: 'Offensif' },
  { type: 'CORNER_FOR', label: 'Corner', color: '#60A5FA', bg: '#172554', border: '#1e40af', group: 'Offensif' },
  { type: 'FREE_KICK_FOR', label: 'Coup franc', color: '#93C5FD', bg: '#172554', border: '#1e40af', group: 'Offensif' },
  { type: 'GOAL_AGAINST', label: 'But concédé', color: '#F87171', bg: '#450a0a', border: '#7f1d1d', group: 'Défensif' },
  { type: 'DANGER_SUFFERED', label: 'Danger subi', color: '#F87171', bg: '#450a0a', border: '#7f1d1d', group: 'Défensif' },
  { type: 'SUBSTITUTION', label: 'Remplacement', color: '#A8A29E', bg: '#1c1917', border: '#78716c', group: 'Défensif' },
  { type: 'YELLOW_CARD', label: 'Carton jaune', color: '#FBBF24', bg: '#451a03', border: '#78716c', group: 'Disciplinaire' },
  { type: 'RED_CARD', label: 'Carton rouge', color: '#EF4444', bg: '#450a0a', border: '#7f1d1d', group: 'Disciplinaire' },
]

// Couleur de secours pour les 2 types retirés de la palette (au cas où un événement
// historique de ce type existe déjà en base).
const LEGACY_COLORS: Partial<Record<EventType, string>> = {
  CORNER_AGAINST: '#f97316',
  FREE_KICK_AGAINST: '#ec4899',
}

const BY_TYPE = new Map(EVENT_PALETTE.map((e) => [e.type, e]))

export function eventMeta(type: EventType): EventMeta | undefined {
  return BY_TYPE.get(type)
}

export function eventColor(type: EventType): string {
  return BY_TYPE.get(type)?.color ?? LEGACY_COLORS[type] ?? '#9CA3AF'
}

export function eventLabel(type: EventType): string {
  return BY_TYPE.get(type)?.label ?? type
}

export function eventsByGroup(group: EventMeta['group']): EventMeta[] {
  return EVENT_PALETTE.filter((e) => e.group === group)
}
