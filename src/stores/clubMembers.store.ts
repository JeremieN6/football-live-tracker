import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { extractErrorMessage } from '@/lib/errors'
import type { MemberRole } from '@/stores/clubs.store'

export interface ClubMember {
  id: string
  clubId: string
  userId: string | null
  teamIds: string[]
  role: MemberRole
  invitedEmail: string | null
  status: 'PENDING' | 'ACTIVE'
  createdAt: string
}

function rowToMember(row: Record<string, unknown>, teamIds: string[]): ClubMember {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    userId: row.user_id as string | null,
    teamIds,
    role: row.role as ClubMember['role'],
    invitedEmail: row.invited_email as string | null,
    status: row.status as ClubMember['status'],
    createdAt: row.created_at as string,
  }
}

export const useClubMembersStore = defineStore('clubMembers', () => {
  const members = ref<ClubMember[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMembers(clubId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('club_members')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: true })
      if (sbError) throw sbError

      const rows = data ?? []
      const memberIds = rows.map((r) => r.id as string)
      const teamsByMember = new Map<string, string[]>()
      if (memberIds.length > 0) {
        const { data: links, error: linksError } = await supabase
          .from('club_member_teams')
          .select('member_id, team_id')
          .in('member_id', memberIds)
        if (linksError) throw linksError
        for (const link of links ?? []) {
          const list = teamsByMember.get(link.member_id as string) ?? []
          list.push(link.team_id as string)
          teamsByMember.set(link.member_id as string, list)
        }
      }

      members.value = rows.map((row) => rowToMember(row, teamsByMember.get(row.id as string) ?? []))
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Erreur lors du chargement des membres.')
    } finally {
      loading.value = false
    }
  }

  // Invite un membre par email, avec un rôle (coach/joueur/autre) sur une ou plusieurs
  // équipes (status PENDING tant qu'il n'a pas de compte lié)
  async function inviteMember(clubId: string, payload: { email: string; role: Exclude<MemberRole, 'OWNER'>; teamIds: string[] }) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Non authentifié.')
    if (payload.teamIds.length === 0) throw new Error('Sélectionnez au moins une équipe.')

    const { data, error: sbError } = await supabase
      .from('club_members')
      .insert({
        club_id: clubId,
        role: payload.role,
        status: 'PENDING',
        invited_email: payload.email.trim().toLowerCase(),
        invited_by: userData.user.id,
      })
      .select()
      .single()
    if (sbError) throw sbError

    const { error: linksError } = await supabase
      .from('club_member_teams')
      .insert(payload.teamIds.map((teamId) => ({ member_id: data.id, team_id: teamId })))
    if (linksError) throw linksError

    members.value.push(rowToMember(data, payload.teamIds))
  }

  async function removeMember(id: string) {
    const { error: sbError } = await supabase.from('club_members').delete().eq('id', id)
    if (sbError) throw sbError
    members.value = members.value.filter((m) => m.id !== id)
  }

  function reset() {
    members.value = []
    error.value = null
  }

  return { members, loading, error, fetchMembers, inviteMember, removeMember, reset }
})
