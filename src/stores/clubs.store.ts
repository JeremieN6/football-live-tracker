import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import type { Club } from '@/types/match.types'
import { extractErrorMessage } from '@/lib/errors'

function rowToClub(row: Record<string, unknown>): Club {
  return {
    id: row.id as string,
    name: row.name as string,
    ownerId: row.owner_id as string,
    status: row.status as Club['status'],
    createdAt: row.created_at as string,
  }
}

export type MemberRole = 'OWNER' | 'COACH' | 'PLAYER' | 'OTHER'

export interface Membership {
  role: MemberRole
  teamIds: string[]
}

export const useClubsStore = defineStore('clubs', () => {
  const club = ref<Club | null>(null)
  const membership = ref<Membership | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isOwner = computed(() => membership.value?.role === 'OWNER')
  // Droit d'écriture (créer/modifier/supprimer) sur les équipes du membre :
  // le OWNER (admin/futur président) et le COACH l'ont, PLAYER/OTHER sont en lecture seule.
  const canWrite = computed(() => membership.value?.role === 'OWNER' || membership.value?.role === 'COACH')

  // Récupère le club de l'utilisateur :
  // - s'il est propriétaire d'un club, le renvoie (et le crée avec une équipe
  //   par défaut si c'est son tout premier login)
  // - sinon, s'il a été invité en tant que coach sur un club, renvoie ce club
  async function ensureClub(): Promise<Club> {
    loading.value = true
    error.value = null
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Non authentifié.')

      // Relie automatiquement toute invitation en attente à ce compte
      await supabase.rpc('accept_pending_invites')

      const { data: existing, error: fetchError } = await supabase
        .from('clubs')
        .select('*')
        .eq('owner_id', userData.user.id)
        .maybeSingle()
      if (fetchError) throw fetchError

      if (existing) {
        club.value = rowToClub(existing)
        membership.value = { role: 'OWNER', teamIds: [] }
        // Auto-réparation : un club sans aucune équipe (ex. suite à une migration ou un aléa)
        // ne doit pas rester bloqué sans équipe par défaut.
        const { count: teamCount, error: countError } = await supabase
          .from('teams')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', existing.id)
        if (countError) throw countError
        if (!teamCount) {
          const { error: teamError } = await supabase
            .from('teams')
            .insert({ club_id: existing.id, name: 'Équipe 1' })
          if (teamError) throw teamError
        }
        return club.value
      }

      // Pas propriétaire : peut-être coach invité sur le club de quelqu'un d'autre
      const { data: memberRow, error: memberFetchError } = await supabase
        .from('club_members')
        .select('id, club_id, role')
        .eq('user_id', userData.user.id)
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle()
      if (memberFetchError) throw memberFetchError

      if (memberRow) {
        const { data: memberClub, error: clubFetchError } = await supabase
          .from('clubs')
          .select('*')
          .eq('id', memberRow.club_id)
          .single()
        if (clubFetchError) throw clubFetchError

        const { data: teamLinks, error: teamLinksError } = await supabase
          .from('club_member_teams')
          .select('team_id')
          .eq('member_id', memberRow.id)
        if (teamLinksError) throw teamLinksError

        club.value = rowToClub(memberClub)
        membership.value = {
          role: memberRow.role as Membership['role'],
          teamIds: (teamLinks ?? []).map((row) => row.team_id as string),
        }
        return club.value
      }

      // Aucun club, aucune invitation acceptée : premier login, on en crée un avec une équipe par défaut
      const { data: newClub, error: createError } = await supabase
        .from('clubs')
        .insert({ name: 'Mon club', owner_id: userData.user.id })
        .select()
        .single()
      if (createError) throw createError

      const { error: teamError } = await supabase
        .from('teams')
        .insert({ club_id: newClub.id, name: 'Équipe 1' })
      if (teamError) throw teamError

      const { error: memberError } = await supabase
        .from('club_members')
        .insert({ club_id: newClub.id, user_id: userData.user.id, role: 'OWNER', status: 'ACTIVE' })
      if (memberError) throw memberError

      club.value = rowToClub(newClub)
      membership.value = { role: 'OWNER', teamIds: [] }
      return club.value
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Erreur lors du chargement du club.')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function renameClub(name: string) {
    if (!club.value) return
    const { error: sbError } = await supabase.from('clubs').update({ name }).eq('id', club.value.id)
    if (sbError) throw sbError
    club.value.name = name
  }

  function reset() {
    club.value = null
    membership.value = null
    error.value = null
  }

  return { club, membership, isOwner, canWrite, loading, error, ensureClub, renameClub, reset }
})
