// Aucun champ "nom affiché" n'existe dans le modèle (seul `auth.users.email` est connu
// côté client) — on dérive un libellé et des initiales lisibles depuis l'email plutôt
// que d'ajouter une colonne de profil pour cette passe de refonte, qui est censée
// rester visuelle. À remplacer si un vrai champ "nom" est ajouté un jour.

function localParts(email: string): string[] {
  const local = email.split('@')[0] ?? ''
  return local.split(/[._-]+/).filter(Boolean)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function deriveDisplayName(email: string | null | undefined): string {
  if (!email) return '—'
  const parts = localParts(email)
  if (parts.length === 0) return email
  if (parts.length === 1) return capitalize(parts[0])
  return `${capitalize(parts[0])} ${parts[1].charAt(0).toUpperCase()}.`
}

export function deriveInitials(email: string | null | undefined): string {
  if (!email) return '?'
  const parts = localParts(email)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return '?'
}
