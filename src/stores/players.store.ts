import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import type { Player } from '@/types/match.types'
import { extractErrorMessage } from '@/lib/errors'

// Mapping snake_case BDD → camelCase TypeScript
function rowToPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    name: row.name as string,
    number: row.number as number | null,
    position: row.position as string | null,
    active: row.active as boolean,
    clubId: row.club_id as string | null,
    teamId: row.team_id as string | null,
    memberId: (row.member_id as string | null) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  }
}

export const usePlayersStore = defineStore('players', () => {
  const players = ref<Player[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Charge l'effectif du club (actifs + archivés), trié par numéro
  async function fetchPlayers() {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('players')
        .select('*')
        .order('number', { ascending: true, nullsFirst: false })

      if (sbError) throw sbError
      players.value = (data ?? []).map(rowToPlayer)
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Erreur lors du chargement de l\'effectif.')
    } finally {
      loading.value = false
    }
  }

  // Ajoute un joueur à l'effectif du club, rattaché à une équipe
  async function createPlayer(payload: {
    name: string
    number: number | null
    position: string | null
    clubId: string
    teamId: string | null
    memberId?: string | null
  }): Promise<Player> {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Non authentifié.')

    const { data, error: sbError } = await supabase
      .from('players')
      .insert({
        name: payload.name,
        number: payload.number,
        position: payload.position,
        club_id: payload.clubId,
        team_id: payload.teamId,
        member_id: payload.memberId ?? null,
        created_by: userData.user.id,
      })
      .select()
      .single()

    if (sbError) throw sbError

    const player = rowToPlayer(data)
    players.value.push(player)
    return player
  }

  // Modifie un joueur (nom, numéro, poste, équipe, compte lié)
  async function updatePlayer(
    id: string,
    payload: { name: string; number: number | null; position: string | null; teamId: string | null; memberId?: string | null },
  ) {
    const { error: sbError } = await supabase
      .from('players')
      .update({
        name: payload.name,
        number: payload.number,
        position: payload.position,
        team_id: payload.teamId,
        member_id: payload.memberId ?? null,
      })
      .eq('id', id)

    if (sbError) throw sbError

    const idx = players.value.findIndex((p) => p.id === id)
    if (idx !== -1) players.value[idx] = { ...players.value[idx], ...payload, memberId: payload.memberId ?? null }
  }

  // Archive / réactive un joueur (ne le supprime pas : il reste attaché à l'historique des matchs)
  async function setActive(id: string, active: boolean) {
    const { error: sbError } = await supabase
      .from('players')
      .update({ active })
      .eq('id', id)

    if (sbError) throw sbError

    const idx = players.value.findIndex((p) => p.id === id)
    if (idx !== -1) players.value[idx].active = active
  }

  function reset() {
    players.value = []
    error.value = null
  }

  return { players, loading, error, fetchPlayers, createPlayer, updatePlayer, setActive, reset }
})
