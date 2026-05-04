import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import type { MatchEvent, EventType, Team, Half, ZoneX, ZoneY } from '@/types/match.types'

// Mapping snake_case BDD → camelCase TypeScript
function rowToEvent(row: Record<string, unknown>): MatchEvent {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    type: row.type as EventType,
    team: row.team as Team,
    minute: row.minute as number,
    half: row.half as Half,
    addedTime: row.added_time as boolean,
    pitchX: row.pitch_x as number | null,
    pitchY: row.pitch_y as number | null,
    zoneX: row.zone_x as ZoneX | null,
    zoneY: row.zone_y as ZoneY | null,
    playerIn: row.player_in as string | null,
    playerOut: row.player_out as string | null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  }
}

export const useEventsStore = defineStore('events', () => {
  const events = ref<MatchEvent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Vérifie si un événement est déjà dans le store (pour le Realtime)
  function has(id: string): boolean {
    return events.value.some((e) => e.id === id)
  }

  // Charge tous les événements d'un match depuis Supabase
  async function fetchEvents(matchId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('events')
        .select('*')
        .eq('match_id', matchId)
        .order('minute', { ascending: true })

      if (sbError) throw sbError
      events.value = (data ?? []).map(rowToEvent)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement des événements.'
    } finally {
      loading.value = false
    }
  }

  // Ajoute un événement : optimiste d'abord, puis INSERT Supabase
  async function addEvent(event: MatchEvent) {
    // Ajout optimiste immédiat dans le store
    if (!has(event.id)) {
      events.value.push(event)
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Non authentifié.')

    const { error: sbError } = await supabase.from('events').insert({
      id: event.id,
      match_id: event.matchId,
      type: event.type,
      team: event.team,
      minute: event.minute,
      half: event.half,
      added_time: event.addedTime,
      pitch_x: event.pitchX,
      pitch_y: event.pitchY,
      zone_x: event.zoneX,
      zone_y: event.zoneY,
      player_in: event.playerIn,
      player_out: event.playerOut,
      created_by: userData.user.id,
    })

    if (sbError) {
      // En cas d'échec Supabase, l'offline queue prendra le relais
      throw sbError
    }
  }

  // Supprime un événement du store et de Supabase
  async function deleteEvent(id: string) {
    // Suppression optimiste
    events.value = events.value.filter((e) => e.id !== id)

    const { error: sbError } = await supabase.from('events').delete().eq('id', id)
    if (sbError) throw sbError
  }

  // Réinitialise le store (changement de match)
  function reset() {
    events.value = []
    error.value = null
  }

  return { events, loading, error, has, fetchEvents, addEvent, deleteEvent, reset }
})
