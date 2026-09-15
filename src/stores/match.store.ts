import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import type { Match, MatchStatus } from '@/types/match.types'
import { extractErrorMessage } from '@/lib/errors'

// Mapping snake_case BDD → camelCase TypeScript
function rowToMatch(row: Record<string, unknown>): Match {
  return {
    id: row.id as string,
    homeTeam: row.home_team as string,
    awayTeam: row.away_team as string,
    competition: row.competition as string,
    date: row.date as string,
    status: row.status as MatchStatus,
    scoreHome: row.score_home as number,
    scoreAway: row.score_away as number,
    firstHalfMinutes: row.first_half_minutes as number | null,
    secondHalfMinutes: row.second_half_minutes as number | null,
    clubId: row.club_id as string | null,
    teamId: row.team_id as string | null,
    formation: (row.formation as string | null) ?? null,
    designatedTrackerMemberId: (row.designated_tracker_member_id as string | null) ?? null,
    createdBy: row.created_by as string,
  }
}

export const useMatchStore = defineStore('match', () => {
  const matches = ref<Match[]>([])
  const currentMatch = ref<Match | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Récupère tous les matchs de l'utilisateur connecté
  async function fetchMatches() {
    loading.value = true
    error.value = null

    try {
      const { data, error: sbError } = await supabase
        .from('matches')
        .select('*')
        .order('date', { ascending: false })

      if (sbError) throw sbError
      matches.value = (data ?? []).map(rowToMatch)
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Erreur lors du chargement des matchs.')
    } finally {
      loading.value = false
    }
  }

  // Récupère un match par son ID
  async function fetchMatch(id: string) {
    loading.value = true
    error.value = null

    try {
      const { data, error: sbError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', id)
        .single()

      if (sbError) throw sbError
      currentMatch.value = rowToMatch(data)
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Match introuvable.')
    } finally {
      loading.value = false
    }
  }

  // Crée un nouveau match et le retourne
  async function createMatch(payload: {
    homeTeam: string
    awayTeam: string
    competition: string
    date: string
    clubId: string
    teamId: string | null
    designatedTrackerMemberId?: string | null
  }): Promise<Match> {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Non authentifié.')

    const { data, error: sbError } = await supabase
      .from('matches')
      .insert({
        home_team: payload.homeTeam,
        away_team: payload.awayTeam,
        competition: payload.competition,
        date: payload.date,
        club_id: payload.clubId,
        team_id: payload.teamId,
        designated_tracker_member_id: payload.designatedTrackerMemberId ?? null,
        created_by: userData.user.id,
      })
      .select()
      .single()

    if (sbError) throw sbError

    const match = rowToMatch(data)
    matches.value.unshift(match)
    currentMatch.value = match
    return match
  }

  // Met à jour le statut d'un match (ex. LIVE → FINISHED)
  async function updateMatchStatus(id: string, status: MatchStatus) {
    const { error: sbError } = await supabase
      .from('matches')
      .update({ status })
      .eq('id', id)

    if (sbError) throw sbError

    // Mise à jour locale
    const idx = matches.value.findIndex((m) => m.id === id)
    if (idx !== -1) matches.value[idx].status = status
    if (currentMatch.value?.id === id) currentMatch.value.status = status
  }

  // Termine un match en enregistrant la durée de chaque mi-temps (pour le calcul des minutes jouées)
  async function finishMatch(id: string, durations: { firstHalfMinutes: number; secondHalfMinutes: number }) {
    const { error: sbError } = await supabase
      .from('matches')
      .update({
        status: 'FINISHED',
        first_half_minutes: durations.firstHalfMinutes,
        second_half_minutes: durations.secondHalfMinutes,
      })
      .eq('id', id)

    if (sbError) throw sbError

    const idx = matches.value.findIndex((m) => m.id === id)
    if (idx !== -1) Object.assign(matches.value[idx], { status: 'FINISHED', ...durations })
    if (currentMatch.value?.id === id) Object.assign(currentMatch.value, { status: 'FINISHED', ...durations })
  }

  // Enregistre la formation choisie pour la composition (ex. "4-4-2")
  async function updateFormation(id: string, formation: string) {
    const { error: sbError } = await supabase.from('matches').update({ formation }).eq('id', id)
    if (sbError) throw sbError

    const idx = matches.value.findIndex((m) => m.id === id)
    if (idx !== -1) matches.value[idx].formation = formation
    if (currentMatch.value?.id === id) currentMatch.value.formation = formation
  }

  // Désigne (ou retire) le joueur autorisé à tracker CE match précis — utilisable
  // aussi bien à la création qu'après coup (ex. le coach s'aperçoit après coup
  // qu'il veut déléguer la saisie). RLS : matches_update_team_access exige déjà
  // can_write_team(), donc aucune policy supplémentaire n'était nécessaire.
  async function updateDesignatedTracker(id: string, memberId: string | null) {
    const { error: sbError } = await supabase
      .from('matches')
      .update({ designated_tracker_member_id: memberId })
      .eq('id', id)
    if (sbError) throw sbError

    const idx = matches.value.findIndex((m) => m.id === id)
    if (idx !== -1) matches.value[idx].designatedTrackerMemberId = memberId
    if (currentMatch.value?.id === id) currentMatch.value.designatedTrackerMemberId = memberId
  }

  // Supprime un match (et tout ce qui en dépend : events/match_lineups en
  // cascade côté BDD, reports pas en cascade donc supprimé explicitement
  // d'abord — cf. incident constaté avec le nettoyage du test e2e). RLS :
  // matches_delete_team_access exige can_write_team(), donc en pratique
  // réservé à OWNER/COACH/ADJOINT/CATEGORY_MANAGER — l'UI ne l'expose qu'au
  // OWNER à la demande explicite de l'utilisateur.
  async function deleteMatch(id: string) {
    await supabase.from('reports').delete().eq('match_id', id)
    const { error: sbError } = await supabase.from('matches').delete().eq('id', id)
    if (sbError) throw sbError

    matches.value = matches.value.filter((m) => m.id !== id)
    if (currentMatch.value?.id === id) currentMatch.value = null
  }

  return { matches, currentMatch, loading, error, fetchMatches, fetchMatch, createMatch, updateMatchStatus, finishMatch, updateFormation, updateDesignatedTracker, deleteMatch }
})
