import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { extractErrorMessage } from '@/lib/errors'

export interface ClubMember {
  id: string
  clubId: string
  userId: string | null
  teamId: string | null
  role: 'OWNER' | 'COACH'
  invitedEmail: string | null
  status: 'PENDING' | 'ACTIVE'
  createdAt: string
}

function rowToMember(row: Record<string, unknown>): ClubMember {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    userId: row.user_id as string | null,
    teamId: row.team_id as string | null,
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
      members.value = (data ?? []).map(rowToMember)
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Erreur lors du chargement des membres.')
    } finally {
      loading.value = false
    }
  }

  // Invite un coach par email sur une équipe précise (status PENDING tant qu'il n'a pas de compte lié)
  async function inviteMember(clubId: string, payload: { email: string; teamId: string }) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Non authentifié.')

    const { data, error: sbError } = await supabase
      .from('club_members')
      .insert({
        club_id: clubId,
        team_id: payload.teamId,
        role: 'COACH',
        status: 'PENDING',
        invited_email: payload.email.trim().toLowerCase(),
        invited_by: userData.user.id,
      })
      .select()
      .single()
    if (sbError) throw sbError
    members.value.push(rowToMember(data))
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
