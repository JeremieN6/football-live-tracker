import { onUnmounted } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { useEventsStore } from '@/stores/events.store'
import type { EventType, Team, Half, ZoneX, ZoneY, MatchEvent } from '@/types/match.types'

// Mapping snake_case BDD → camelCase (identique à events.store)
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

export function useMatchSync(matchId: string) {
  const eventsStore = useEventsStore()
  let channel: RealtimeChannel | null = null

  function subscribe() {
    // S'abonner aux changements sur la table `events` filtrés par match_id
    channel = supabase
      .channel(`match-events-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const event = rowToEvent(payload.new as Record<string, unknown>)
          // Déduplication : si l'événement existe déjà (ajout optimiste local), on ne l'ajoute pas
          if (!eventsStore.has(event.id)) {
            eventsStore.events.push(event)
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'events',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const deletedId = (payload.old as Record<string, unknown>).id as string
          eventsStore.events = eventsStore.events.filter((e) => e.id !== deletedId)
        },
      )
      .subscribe()
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  onUnmounted(() => {
    unsubscribe()
  })

  return { subscribe, unsubscribe }
}
