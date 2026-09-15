import type { User } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useClubsStore } from '@/stores/clubs.store'
import { useClubMembersStore } from '@/stores/clubMembers.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { usePlayerProfileStore } from '@/stores/playerProfile.store'
import { useMatchStore } from '@/stores/match.store'
import { useEventsStore } from '@/stores/events.store'
import { useLineupStore } from '@/stores/lineup.store'
import { useReportStore } from '@/stores/report.store'

// Vide tous les stores qui contiennent des données propres à un club/utilisateur,
// pour qu'un changement de compte dans le même onglet (déconnexion puis connexion
// avec un autre compte, sans rechargement complet de page) ne laisse jamais
// traîner en mémoire les données du compte précédent (ex: clubsStore.club encore
// rempli, ce qui faisait sauter la garde de validation du club pending).
function resetUserScopedStores() {
  useClubsStore().reset()
  useClubMembersStore().reset()
  useTeamsStore().reset()
  usePlayersStore().reset()
  usePlayerProfileStore().reset()
  useEventsStore().reset()
  useLineupStore().reset()
  useReportStore().reset()
  // match.store.ts n'a pas de reset() dédié : on vide directement son état.
  const matchStore = useMatchStore()
  matchStore.matches = []
  matchStore.currentMatch = null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  let currentUserId: string | null = null

  // Initialise la session depuis Supabase au démarrage de l'app
  async function init() {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    currentUserId = user.value?.id ?? null
    loading.value = false

    // Écoute les changements d'état d'authentification
    supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null
      if (newUser?.id !== currentUserId) {
        resetUserScopedStores()
      }
      currentUserId = newUser?.id ?? null
      user.value = newUser
    })
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string): Promise<boolean> {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    // Retourne true si la confirmation email est requise (pas de session immédiate)
    return data.session === null
  }

  // Connexion sans mot de passe : envoie un lien magique par email. Utilisé
  // pour le parcours d'auto-inscription des joueurs invités (le joueur n'a
  // rien à retenir — il clique le lien reçu, la session se crée toute seule
  // au retour sur l'app via detectSessionInUrl).
  async function signInWithMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    user.value = null
  }

  return { user, loading, init, signIn, signUp, signInWithMagicLink, signOut }
})
