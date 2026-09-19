// Type de match (championnat / coupe / amical) — champ ferme, distinct du
// libelle libre `matches.competition` (ex: "Championnat D2", "Coupe Regionale").
// Sert a filtrer les stats equipe/joueur par type de match.

export type MatchType = 'CHAMPIONSHIP' | 'CUP' | 'FRIENDLY'

export const MATCH_TYPES: MatchType[] = ['CHAMPIONSHIP', 'CUP', 'FRIENDLY']

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  CHAMPIONSHIP: 'Championnat',
  CUP: 'Coupe',
  FRIENDLY: 'Amical',
}

export type MatchTypeFilter = 'ALL' | MatchType

export const MATCH_TYPE_FILTER_LABELS: Record<MatchTypeFilter, string> = {
  ALL: 'Tous',
  ...MATCH_TYPE_LABELS,
}
