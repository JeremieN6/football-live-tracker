import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import type { Club } from '@/types/match.types'

function rowToClub(row: Record<string, unknown>): Club {
  return {
    id: row.id as string,
    name: row.name as string,
    ownerId: row.owner_id as string,
    createdAt: row.created_at as string,
  }
}

export const useClubsStore = defineStore('clubs', () => {
  const club = ref<Club | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Récupère le club de l'utilisateur, ou le crée automatiquement avec une première équipe
  // s'il n'en a pas encore (nouvel utilisateur, ou premier login après cette fonctionnalité).
  async function ensureClub(): Promise<Club> {
    loading.value = true
    error.value = null
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Non authentifié.')

      const { data: existing, error: fetchError } = await supabase
        .from('clubs')
        .select('*')
        .eq('owner_id', userData.user.id)
        .maybeSingle()
      if (fetchError) throw fetchError

      if (existing) {
        club.value = rowToClub(existing)
        return club.value
      }

      // Aucun club : premier login, on en crée un avec une équipe par défaut
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
      return club.value
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du club.'
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
    error.value = null
  }

  return { club, loading, error, ensureClub, renameClub, reset }
})
