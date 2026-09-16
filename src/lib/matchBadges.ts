// Styles des badges match (voir handoff design, 01-tokens.md) — réutilisés sur
// Home, History et Report.

export const OUTCOME_BADGES: Record<'V' | 'N' | 'D', { bg: string; border: string; fg: string }> = {
  V: { bg: '#052e16', border: '#166534', fg: '#4ADE80' },
  N: { bg: '#1c1917', border: '#78716c', fg: '#d6d3d1' },
  D: { bg: '#450a0a', border: '#7f1d1d', fg: '#F87171' },
}

export const MATCH_STATUS_BADGES: Record<
  'PENDING' | 'LIVE' | 'FINISHED',
  { label: string; bg: string; border: string; fg: string; dot: string }
> = {
  PENDING: { label: 'À venir', bg: '#1F2937', border: '#4B5563', fg: '#9CA3AF', dot: '#6B7280' },
  LIVE: { label: 'En cours', bg: '#052e16', border: '#166534', fg: '#4ADE80', dot: '#22C55E' },
  FINISHED: { label: 'Terminé', bg: '#161f2c', border: '#374151', fg: '#6B7280', dot: '#4B5563' },
}

export function outcomeFor(scoreHome: number, scoreAway: number): 'V' | 'N' | 'D' {
  if (scoreHome > scoreAway) return 'V'
  if (scoreHome < scoreAway) return 'D'
  return 'N'
}

// matches.scoreHome/scoreAway représentent toujours "nos buts"/"buts encaissés"
// (GOAL_FOR/GOAL_AGAINST), indépendamment de qui est home_team/away_team en texte
// libre (cf. Decisions Prises 11/09/2026). Les écrans qui affichent le score À
// CÔTÉ des libellés homeTeam/awayTeam (Tracker, Rapport, liste des matchs) doivent
// donc reproduire l'ordre home/away réel selon matches.is_home, sous peine
// d'afficher le score sous le mauvais nom d'équipe quand le club est à l'extérieur.
export function displayScore(ourGoals: number, conceded: number, isHome: boolean): { home: number; away: number } {
  return isHome ? { home: ourGoals, away: conceded } : { home: conceded, away: ourGoals }
}
