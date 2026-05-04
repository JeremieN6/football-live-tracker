import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import type { Match, MatchStatus } from '@/types/match.types'

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
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement des matchs.'
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
      error.value = err instanceof Error ? err.message : 'Match introuvable.'
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

  return { matches, currentMatch, loading, error, fetchMatches, fetchMatch, createMatch, updateMatchStatus }
})
