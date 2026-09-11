import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import type { ClubTeam } from '@/types/match.types'
import { extractErrorMessage } from '@/lib/errors'

function rowToTeam(row: Record<string, unknown>): ClubTeam {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    name: row.name as string,
    division: row.division as string | null,
    category: row.category as string | null,
    formation: row.formation as string | null,
    createdAt: row.created_at as string,
  }
}

export const useTeamsStore = defineStore('teams', () => {
  const teams = ref<ClubTeam[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTeams(clubId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('teams')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: true })
      if (sbError) throw sbError
      teams.value = (data ?? []).map(rowToTeam)
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Erreur lors du chargement des équipes.')
    } finally {
      loading.value = false
    }
  }

  interface TeamPayload {
    name: string
    division: string | null
    category: string | null
    formation: string | null
  }

  async function createTeam(clubId: string, payload: TeamPayload): Promise<ClubTeam> {
    const { data, error: sbError } = await supabase
      .from('teams')
      .insert({
        club_id: clubId,
        name: payload.name,
        division: payload.division,
        category: payload.category,
        formation: payload.formation,
      })
      .select()
      .single()
    if (sbError) throw sbError
    const team = rowToTeam(data)
    teams.value.push(team)
    return team
  }

  async function updateTeam(id: string, payload: TeamPayload) {
    const { error: sbError } = await supabase
      .from('teams')
      .update({
        name: payload.name,
        division: payload.division,
        category: payload.category,
        formation: payload.formation,
      })
      .eq('id', id)
    if (sbError) throw sbError
    const idx = teams.value.findIndex((t) => t.id === id)
    if (idx !== -1) teams.value[idx] = { ...teams.value[idx], ...payload }
  }

  // Supprime une équipe (les joueurs/matchs qui y étaient rattachés perdent juste la référence, ils ne sont pas supprimés)
  async function deleteTeam(id: string) {
    const { error: sbError } = await supabase.from('teams').delete().eq('id', id)
    if (sbError) throw sbError
    teams.value = teams.value.filter((t) => t.id !== id)
  }

  function reset() {
    teams.value = []
    error.value = null
  }

  return { teams, loading, error, fetchTeams, createTeam, updateTeam, deleteTeam, reset }
})
