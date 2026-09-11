import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { rowToClub } from '@/stores/clubs.store'
import type { Club } from '@/types/match.types'
import { extractErrorMessage } from '@/lib/errors'

export const useAdminClubsStore = defineStore('adminClubs', () => {
  const isAdmin = ref(false)
  const pendingClubs = ref<Club[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Un admin n'a qu'une ligne visible dans platform_admins : la sienne (RLS).
  // Si la requête renvoie quelque chose, l'utilisateur courant est admin.
  async function checkAdmin(): Promise<boolean> {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      isAdmin.value = false
      return false
    }
    const { data, error: sbError } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (sbError) throw sbError
    isAdmin.value = !!data
    return isAdmin.value
  }

  async function fetchPendingClubs() {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('clubs')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true })
      if (sbError) throw sbError
      pendingClubs.value = (data ?? []).map(rowToClub)
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Erreur lors du chargement des clubs en attente.')
    } finally {
      loading.value = false
    }
  }

  async function approveClub(id: string) {
    const { error: sbError } = await supabase.from('clubs').update({ status: 'ACTIVE' }).eq('id', id)
    if (sbError) throw sbError
    pendingClubs.value = pendingClubs.value.filter((c) => c.id !== id)
  }

  // Supprime le club (et tout ce qui en dépend, via les foreign keys en cascade) —
  // utile pour un doublon ou une création manifestement fictive.
  async function rejectClub(id: string) {
    const { error: sbError } = await supabase.from('clubs').delete().eq('id', id)
    if (sbError) throw sbError
    pendingClubs.value = pendingClubs.value.filter((c) => c.id !== id)
  }

  return { isAdmin, pendingClubs, loading, error, checkAdmin, fetchPendingClubs, approveClub, rejectClub }
})
