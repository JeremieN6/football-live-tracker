import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import type { ClubTeam } from '@/types/match.types'

function rowToTeam(row: Record<string, unknown>): ClubTeam {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    name: row.name as string,
    division: row.division as string | null,
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
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement des équipes.'
    } finally {
      loading.value = false
    }
  }

  async function createTeam(clubId: string, payload: { name: string; division: string | null }): Promise<ClubTeam> {
    const { data, error: sbError } = await supabase
      .from('teams')
      .insert({ club_id: clubId, name: payload.name, division: payload.division })
      .select()
      .single()
    if (sbError) throw sbError
    const team = rowToTeam(data)
    teams.value.push(team)
    return team
  }

  async function updateTeam(id: string, payload: { name: string; division: string | null }) {
    const { error: sbError } = await supabase
      .from('teams')
      .update({ name: payload.name, division: payload.division })
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
