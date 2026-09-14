<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Users, Shield, LogOut, Settings } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.store'
import { useClubsStore } from '@/stores/clubs.store'
import { useAdminClubsStore } from '@/stores/adminClubs.store'
import { deriveDisplayName, deriveInitials } from '@/lib/displayName'
import { ROLE_BADGES } from '@/lib/roleBadge'
import NrvLogo from '@/components/NrvLogo.vue'

// Header d'application commun à tout l'espace connecté : logo + menu avatar
// (Membres/Réglages/Admin/Déconnexion), identique partout (demande explicite
// de l'utilisateur — avant cette date, seule HomeView l'avait, les autres
// pages étaient des culs-de-sac sans moyen de naviguer ailleurs qu'"retour").
// `back` optionnel : affiche une flèche retour à gauche du logo pour les
// sous-pages (le logo seul seul ne permet pas de revenir en arrière).
const props = defineProps<{ back?: boolean }>()

const router = useRouter()
const authStore = useAuthStore()
const clubsStore = useClubsStore()
const adminStore = useAdminClubsStore()

const showMenu = ref(false)

onMounted(() => {
  adminStore.checkAdmin().catch(() => {})
})

const membershipBadge = computed(() =>
  clubsStore.membership ? ROLE_BADGES[clubsStore.membership.role] : null,
)

async function handleSignOut() {
  showMenu.value = false
  await authStore.signOut()
  router.push({ name: 'auth' })
}

function goTo(name: string, query?: Record<string, string>) {
  showMenu.value = false
  router.push(query ? { name, query } : { name })
}
</script>

<template>
  <header class="flex-none flex items-center justify-between gap-2.5 px-4 py-3 border-b border-line">
    <div class="flex items-center gap-2">
      <button
        v-if="props.back"
        class="p-1 -ml-1 text-ink-meta hover:text-ink transition-colors"
        @click="router.push({ name: 'home' })"
      >
        <ArrowLeft :size="18" :stroke-width="2" />
      </button>
      <NrvLogo :width="66" />
    </div>
    <div class="relative">
      <button class="flex items-center gap-2" @click="showMenu = !showMenu">
        <span class="text-[11px] text-ink-meta">{{ deriveDisplayName(authStore.user?.email) }}</span>
        <span
          v-if="membershipBadge"
          class="flex items-center justify-center w-[30px] h-[30px] rounded-full font-data text-[11px] font-bold border"
          :style="{ background: membershipBadge.bg, borderColor: membershipBadge.border, color: membershipBadge.fg }"
        >
          {{ deriveInitials(authStore.user?.email) }}
        </span>
      </button>

      <div
        v-if="showMenu"
        class="absolute right-0 top-[38px] z-50 min-w-[168px] py-1 bg-surface border border-line rounded-card"
        @click.self="showMenu = false"
      >
        <button
          class="w-full h-11 px-3 flex items-center gap-2.5 text-sm text-ink-body hover:bg-surface-hover transition-colors text-left"
          @click="goTo('club', { tab: 'members' })"
        >
          <Users :size="16" :stroke-width="2" class="text-ink-meta" /> Membres
        </button>
        <button
          v-if="clubsStore.isOwner"
          class="w-full h-11 px-3 flex items-center gap-2.5 text-sm text-ink-body hover:bg-surface-hover transition-colors text-left"
          @click="goTo('club-settings')"
        >
          <Settings :size="16" :stroke-width="2" class="text-ink-meta" /> Réglages du club
        </button>
        <button
          v-if="adminStore.isAdmin"
          class="w-full h-11 px-3 flex items-center gap-2.5 text-sm text-ink-body hover:bg-surface-hover transition-colors text-left"
          @click="goTo('admin-clubs')"
        >
          <Shield :size="16" :stroke-width="2" class="text-ink-meta" /> Administration
        </button>
        <button
          class="w-full h-11 px-3 flex items-center gap-2.5 text-sm text-danger hover:bg-surface-hover transition-colors text-left"
          @click="handleSignOut"
        >
          <LogOut :size="16" :stroke-width="2" /> Déconnexion
        </button>
      </div>
    </div>
  </header>
</template>
