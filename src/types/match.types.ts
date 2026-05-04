// src/types/match.types.ts — Types centralisés du projet

export type EventType =
  // Offensif
  | 'GOAL_FOR'
  | 'SHOT_ON_TARGET'
  | 'SHOT_OFF_TARGET'
  | 'CHANCE_CLEAR'
  | 'CORNER_FOR'
  | 'FREE_KICK_FOR'
  // Défensif
  | 'GOAL_AGAINST'
  | 'DANGER_SUFFERED'
  | 'CORNER_AGAINST'
  | 'FREE_KICK_AGAINST'
  // Disciplinaire / Tactique
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'SUBSTITUTION'

export type ZoneX =
  | 'DEFENSIVE_BOX'    // pitchX < 0.18
  | 'DEFENSIVE_HALF'   // 0.18 → 0.40
  | 'MIDFIELD'         // 0.40 → 0.60
  | 'OFFENSIVE_HALF'   // 0.60 → 0.82
  | 'OFFENSIVE_BOX'    // pitchX > 0.82

export type ZoneY =
  | 'LEFT_FLANK'       // pitchY < 0.33
  | 'CENTER'           // 0.33 → 0.66
  | 'RIGHT_FLANK'      // pitchY > 0.66

export type Team = 'HOME' | 'AWAY'
export type MatchStatus = 'PENDING' | 'LIVE' | 'FINISHED'
export type Half = 1 | 2

export interface MatchEvent {
  id: string
  matchId: string
  type: EventType
  team: Team
  minute: number
  half: Half
  addedTime: boolean
  pitchX: number | null
  pitchY: number | null
  zoneX: ZoneX | null
  zoneY: ZoneY | null
  playerIn: string | null
  playerOut: string | null
  createdBy: string
  createdAt: string
}

export interface Match {
  id: string
  homeTeam: string
  awayTeam: string
  competition: string
  date: string
  status: MatchStatus
  scoreHome: number
  scoreAway: number
  createdBy: string
}

export interface MatchSummary {
  match: Match
  events: MatchEvent[]
  dangerZones: Record<string, number>
  offensiveZones: Record<string, number>
  temporalDanger: Record<string, number>
  temporalOffensive: Record<string, number>
  totalShots: number
  shotsOnTarget: number
  goalsFor: number
  goalsAgainst: number
  clearChances: number
  cornersFor: number
  cornersAgainst: number
  yellowCards: number
  redCards: number
  substitutions: string[]
}
