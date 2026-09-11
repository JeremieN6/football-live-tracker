import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import type { LineupEntry, LineupRole } from '@/types/match.types'

// Mapping snake_case BDD → camelCase TypeScript
function rowToEntry(row: Record<string, unknown>): LineupEntry {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    playerId: row.player_id as string,
    role: row.role as LineupRole,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  }
}

export const useLineupStore = defineStore('lineup', () => {
  const entries = ref<LineupEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Charge l'effectif sélectionné pour un match
  async function fetchLineup(matchId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('match_lineups')
        .select('*')
        .eq('match_id', matchId)

      if (sbError) throw sbError
      entries.value = (data ?? []).map(rowToEntry)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement de l\'effectif du match.'
    } finally {
      loading.value = false
    }
  }

  // Remplace l'effectif sélectionné pour un match (titulaires + remplaçants)
  async function saveLineup(matchId: string, selection: { playerId: string; role: LineupRole }[]) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Non authentifié.')

    const { error: deleteError } = await supabase.from('match_lineups').delete().eq('match_id', matchId)
    if (deleteError) throw deleteError

    if (selection.length === 0) {
      entries.value = []
      return
    }

    const { data, error: sbError } = await supabase
      .from('match_lineups')
      .insert(
        selection.map((s) => ({
          match_id: matchId,
          player_id: s.playerId,
          role: s.role,
          created_by: userData.user!.id,
        })),
      )
      .select()

    if (sbError) throw sbError
    entries.value = (data ?? []).map(rowToEntry)
  }

  function reset() {
    entries.value = []
    error.value = null
  }

  return { entries, loading, error, fetchLineup, saveLineup, reset }
})
