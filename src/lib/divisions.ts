// Pyramide des divisions du football amateur/professionnel francais, telle que
// communiquee par l'utilisateur (du plus bas au plus haut) :
// Departemental D5->D1, Regional R3->R1, National N2->N1, Ligue 3->Ligue 1.
// Sert a la fois de liste fermee pour le select "Division" du formulaire equipe
// et de classement implicite (index = niveau) pour distinguer une Promotion
// d'un Renfort quand un joueur joue avec une autre equipe du club — plus besoin
// de champ "niveau" saisi a la main, la division suffit et est deja une donnee
// que le coach connait et renseigne de toute facon.
export interface DivisionGroup {
  label: string
  divisions: string[]
}

// Du plus bas (index 0) au plus haut.
export const DIVISION_GROUPS: DivisionGroup[] = [
  { label: 'Départemental', divisions: ['D5', 'D4', 'D3', 'D2', 'D1'] },
  { label: 'Régional', divisions: ['R3', 'R2', 'R1'] },
  { label: 'National', divisions: ['N2', 'N1'] },
  { label: 'Ligue', divisions: ['Ligue 3', 'Ligue 2', 'Ligue 1'] },
]

// Ordre du plus bas au plus haut, index croissant = niveau croissant.
export const DIVISIONS: string[] = DIVISION_GROUPS.flatMap((g) => g.divisions)

const RANK_BY_DIVISION = new Map(DIVISIONS.map((d, i) => [d, i]))

// Rang de la division (plus haut = meilleure equipe). Null si la division n'est
// pas dans la liste fermee (donnee ancienne saisie en texte libre avant ce
// changement, ou equipe sans division renseignee) — aucune distinction
// Promotion/Renfort n'est alors calculee pour cette equipe, par prudence.
export function divisionRank(division: string | null | undefined): number | null {
  if (!division) return null
  return RANK_BY_DIVISION.get(division) ?? null
}
