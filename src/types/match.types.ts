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
  // Buteur / passeur décisif (GOAL_FOR)
  scorerId: string | null
  assistId: string | null
  // Joueur sanctionné (YELLOW_CARD / RED_CARD)
  playerId: string | null
  // Remplacement (SUBSTITUTION)
  playerInId: string | null
  playerOutId: string | null
  createdBy: string
  createdAt: string
}

export interface Player {
  id: string
  name: string
  number: number | null
  position: string | null
  active: boolean
  // Équipe du club à laquelle le joueur est actuellement rattaché
  clubId: string | null
  teamId: string | null
  createdBy: string
  createdAt: string
}

export type ClubStatus = 'PENDING' | 'ACTIVE'

export interface Club {
  id: string
  name: string
  ownerId: string
  status: ClubStatus
  foundedYear: number | null
  location: string | null
  createdAt: string
}

// "ClubTeam" pour ne pas entrer en collision avec le type Team ('HOME'/'AWAY') des événements
export interface ClubTeam {
  id: string
  clubId: string
  name: string
  division: string | null
  category: string | null
  formation: string | null
  createdAt: string
}

export type LineupRole = 'STARTER' | 'SUB'

export interface LineupEntry {
  id: string
  matchId: string
  playerId: string
  role: LineupRole
  // Position tactique nommée (ex. "dg", "mcg") pour un STARTER placé sur le
  // terrain de composition — absente pour un SUB, ou un STARTER non encore
  // positionné (rétrocompatibilité avec l'ancienne saisie STARTER/SUB seule).
  slotId: string | null
  slotLabel: string | null
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
  // Durée de chaque mi-temps (minutes), renseignée à la fin du match — sert au calcul des minutes jouées
  firstHalfMinutes: number | null
  secondHalfMinutes: number | null
  // Équipe du club concernée par ce match (ex: Équipe 1, Équipe réserve)
  clubId: string | null
  teamId: string | null
  // Formation choisie pour la composition (ex. "4-4-2") — null tant qu'aucune n'a été enregistrée
  formation: string | null
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
