import { supabase } from '@/services/supabase'
import { deriveDisplayName } from '@/lib/displayName'
import type { Player } from '@/types/match.types'

export interface EligibleTracker {
  memberId: string
  label: string
}

/**
 * Membres rattachés à une équipe, éligibles pour être désignés "live tracker"
 * d'un match (délégation ponctuelle d'écriture sur CE match précis, pas les
 * droits COACH/ADJOINT complets — cf. matches.designated_tracker_member_id).
 * Affiche le nom du joueur lié si sa fiche effectif est reliée au compte
 * (players.member_id), sinon un nom dérivé de son email.
 *
 * Extrait de CreateMatchModal.vue pour être réutilisé partout où on peut
 * désigner/changer le tracker d'un match (création ET après coup).
 */
export async function fetchEligibleTrackers(teamId: string, players: Player[]): Promise<EligibleTracker[]> {
  const { data, error } = await supabase
    .from('club_member_teams')
    .select('member_id, club_members!inner(id, invited_email, status)')
    .eq('team_id', teamId)
    .eq('club_members.status', 'ACTIVE')
  if (error) throw error

  return (data ?? []).map((row) => {
    const memberId = row.member_id as string
    const player = players.find((p) => p.memberId === memberId)
    const member = row.club_members as unknown as { invited_email: string | null }
    return { memberId, label: player?.name ?? deriveDisplayName(member?.invited_email) }
  })
}
