import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import type { LineupRole, Match, MatchEvent } from '@/types/match.types'
import { extractErrorMessage } from '@/lib/errors'

interface MatchAppearance {
  match: Match
  role: LineupRole
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  enteredAsSub: boolean
  minutesPlayed: number | null
  // true si ce match appartient à une autre équipe du club que l'équipe actuelle du joueur (renfort/promotion ponctuelle)
  calledUp: boolean
}

// Mapping snake_case BDD → camelCase (identique à match.store)
function rowToMatch(row: Record<string, unknown>): Match {
  return {
    id: row.id as string,
    homeTeam: row.home_team as string,
    awayTeam: row.away_team as string,
    competition: row.competition as string,
    date: row.date as string,
    status: row.status as Match['status'],
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

function rowToEvent(row: Record<string, unknown>): MatchEvent {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    type: row.type as MatchEvent['type'],
    team: row.team as MatchEvent['team'],
    minute: row.minute as number,
    half: row.half as MatchEvent['half'],
    addedTime: row.added_time as boolean,
    pitchX: row.pitch_x as number | null,
    pitchY: row.pitch_y as number | null,
    zoneX: row.zone_x as MatchEvent['zoneX'],
    zoneY: row.zone_y as MatchEvent['zoneY'],
    scorerId: row.scorer_id as string | null,
    assistId: row.assist_id as string | null,
    playerId: row.player_id as string | null,
    playerInId: row.player_in_id as string | null,
    playerOutId: row.player_out_id as string | null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  }
}

// Minutes jouées pour ce joueur sur ce match, à partir de son rôle et des événements de remplacement.
// Retourne null si la durée du match n'a pas été enregistrée (matchs terminés avant cette fonctionnalité).
function computeMinutesPlayed(
  match: Match,
  role: LineupRole,
  events: MatchEvent[],
  playerId: string,
): { minutes: number | null; enteredAsSub: boolean } {
  if (match.firstHalfMinutes == null || match.secondHalfMinutes == null) {
    return { minutes: null, enteredAsSub: false }
  }
  const total = match.firstHalfMinutes + match.secondHalfMinutes
  const toAbsoluteMinute = (e: MatchEvent) => (e.half === 1 ? e.minute : match.firstHalfMinutes! + e.minute)

  if (role === 'STARTER') {
    const subOut = events.find((e) => e.type === 'SUBSTITUTION' && e.playerOutId === playerId)
    return { minutes: subOut ? toAbsoluteMinute(subOut) : total, enteredAsSub: false }
  }

  const subIn = events.find((e) => e.type === 'SUBSTITUTION' && e.playerInId === playerId)
  if (!subIn) return { minutes: 0, enteredAsSub: false }
  return { minutes: total - toAbsoluteMinute(subIn), enteredAsSub: true }
}

export const usePlayerProfileStore = defineStore('playerProfile', () => {
  const appearances = ref<MatchAppearance[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProfile(playerId: string, currentTeamId: string | null) {
    loading.value = true
    error.value = null
    appearances.value = []
    try {
      const { data: lineupRows, error: lineupError } = await supabase
        .from('match_lineups')
        .select('role, matches(*)')
        .eq('player_id', playerId)
      if (lineupError) throw lineupError

      const entries = (lineupRows ?? []) as unknown as { role: LineupRole; matches: Record<string, unknown> | null }[]
      const matches = entries
        .filter((e) => e.matches)
        .map((e) => ({ role: e.role, match: rowToMatch(e.matches as Record<string, unknown>) }))

      if (matches.length === 0) {
        appearances.value = []
        return
      }

      const matchIds = matches.map((m) => m.match.id)
      const { data: eventRows, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .in('match_id', matchIds)
        .or(
          [
            `scorer_id.eq.${playerId}`,
            `assist_id.eq.${playerId}`,
            `player_id.eq.${playerId}`,
            `player_in_id.eq.${playerId}`,
            `player_out_id.eq.${playerId}`,
          ].join(','),
        )
      if (eventsError) throw eventsError

      const allEvents = (eventRows ?? []).map(rowToEvent)

      appearances.value = matches
        .map(({ role, match }) => {
          const matchEvents = allEvents.filter((e) => e.matchId === match.id)
          const { minutes, enteredAsSub } = computeMinutesPlayed(match, role, matchEvents, playerId)
          return {
            match,
            role,
            goals: matchEvents.filter((e) => e.type === 'GOAL_FOR' && e.scorerId === playerId).length,
            assists: matchEvents.filter((e) => e.type === 'GOAL_FOR' && e.assistId === playerId).length,
            yellowCards: matchEvents.filter((e) => e.type === 'YELLOW_CARD' && e.playerId === playerId).length,
            redCards: matchEvents.filter((e) => e.type === 'RED_CARD' && e.playerId === playerId).length,
            enteredAsSub,
            minutesPlayed: minutes,
            calledUp: currentTeamId != null && match.teamId != null && match.teamId !== currentTeamId,
          }
        })
        .sort((a, b) => b.match.date.localeCompare(a.match.date))
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Erreur lors du chargement du profil joueur.')
    } finally {
      loading.value = false
    }
  }

  // N'agrège que les matchs terminés : un match LIVE/PENDING n'a pas de stats définitives
  const finishedAppearances = computed(() => appearances.value.filter((a) => a.match.status === 'FINISHED'))

  const totals = computed(() => {
    const list = finishedAppearances.value
    const played = list.filter((a) => a.role === 'STARTER' || a.enteredAsSub)
    const minutesKnown = played.filter((a) => a.minutesPlayed != null)
    const totalMinutes = minutesKnown.reduce((sum, a) => sum + (a.minutesPlayed ?? 0), 0)

    return {
      matchesPlayed: played.length,
      starts: list.filter((a) => a.role === 'STARTER').length,
      subAppearances: played.filter((a) => a.enteredAsSub).length,
      unusedBench: list.filter((a) => a.role === 'SUB' && !a.enteredAsSub).length,
      goals: list.reduce((sum, a) => sum + a.goals, 0),
      assists: list.reduce((sum, a) => sum + a.assists, 0),
      yellowCards: list.reduce((sum, a) => sum + a.yellowCards, 0),
      redCards: list.reduce((sum, a) => sum + a.redCards, 0),
      totalMinutes,
      averageMinutes: minutesKnown.length > 0 ? Math.round(totalMinutes / minutesKnown.length) : null,
      minutesKnownForAll: minutesKnown.length === played.length,
      calledUpCount: played.filter((a) => a.calledUp).length,
    }
  })

  function reset() {
    appearances.value = []
    error.value = null
  }

  return { appearances, loading, error, fetchProfile, totals, reset }
})
