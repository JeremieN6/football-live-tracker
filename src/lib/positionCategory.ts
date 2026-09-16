// Le poste (players.position) est du texte libre saisi par le coach — pas d'enum
// en base. Classification par mots-clés pour savoir quelles stats sont pertinentes
// à afficher sur le profil joueur (ex: pas de "buts" pour un gardien).
export type PositionCategory = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD' | null

const KEYWORDS: [RegExp, PositionCategory][] = [
  [/gardien|goal|keeper/i, 'GOALKEEPER'],
  [/d[ée]fenseur|arri[èe]re|lat[ée]ral|libéro/i, 'DEFENDER'],
  [/milieu|relayeur/i, 'MIDFIELDER'],
  [/attaquant|avant[- ]?centre|ailier|buteur/i, 'FORWARD'],
]

export function positionCategory(position: string | null | undefined): PositionCategory {
  if (!position) return null
  for (const [pattern, category] of KEYWORDS) {
    if (pattern.test(position)) return category
  }
  return null
}
