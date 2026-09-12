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
  categories: string[]
  role: MemberRole
  invitedEmail: string | null
  status: 'PENDING' | 'ACTIVE'
  createdAt: string
}

function rowToMember(row: Record<string, unknown>, teamIds: string[], categories: string[]): ClubMember {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    userId: row.user_id as string | null,
    teamIds,
    categories,
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
      const categoriesByMember = new Map<string, string[]>()
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

        const { data: categoryLinks, error: categoryLinksError } = await supabase
          .from('club_member_categories')
          .select('member_id, category')
          .in('member_id', memberIds)
        if (categoryLinksError) throw categoryLinksError
        for (const link of categoryLinks ?? []) {
          const list = categoriesByMember.get(link.member_id as string) ?? []
          list.push(link.category as string)
          categoriesByMember.set(link.member_id as string, list)
        }
      }

      members.value = rows.map((row) =>
        rowToMember(row, teamsByMember.get(row.id as string) ?? [], categoriesByMember.get(row.id as string) ?? []),
      )
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Erreur lors du chargement des membres.')
    } finally {
      loading.value = false
    }
  }

  // Invite un membre par email avec un rôle, sur une ou plusieurs équipes
  // (COACH/PLAYER/OTHER/ADJOINT) ou catégories (CATEGORY_MANAGER, accès
  // automatique à toute équipe de cette catégorie) -- le PRESIDENT n'a
  // besoin ni de l'un ni de l'autre (accès club-wide en lecture). Status
  // PENDING tant que la personne invitée n'a pas de compte lié.
  async function inviteMember(
    clubId: string,
    payload: { email: string; role: Exclude<MemberRole, 'OWNER'>; teamIds: string[]; categories: string[] },
  ) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Non authentifié.')
    if (payload.role === 'CATEGORY_MANAGER') {
      if (payload.categories.length === 0) throw new Error('Sélectionnez au moins une catégorie.')
    } else if (payload.role !== 'PRESIDENT' && payload.teamIds.length === 0) {
      throw new Error('Sélectionnez au moins une équipe.')
    }

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

    if (payload.role === 'CATEGORY_MANAGER') {
      const { error: categoriesError } = await supabase
        .from('club_member_categories')
        .insert(payload.categories.map((category) => ({ member_id: data.id, category })))
      if (categoriesError) throw categoriesError
    } else if (payload.teamIds.length > 0) {
      const { error: linksError } = await supabase
        .from('club_member_teams')
        .insert(payload.teamIds.map((teamId) => ({ member_id: data.id, team_id: teamId })))
      if (linksError) throw linksError
    }

    members.value.push(
      rowToMember(data, payload.role === 'CATEGORY_MANAGER' ? [] : payload.teamIds, payload.role === 'CATEGORY_MANAGER' ? payload.categories : []),
    )
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
