<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useClubsStore } from '@/stores/clubs.store'
import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/lib/errors'

const router = useRouter()
const clubsStore = useClubsStore()
const authStore = useAuthStore()

const checking = ref(false)
const errorMessage = ref<string | null>(null)

async function recheck() {
  checking.value = true
  errorMessage.value = null
  try {
    clubsStore.reset()
    const club = await clubsStore.ensureClub()
    if (club.status === 'ACTIVE') {
      router.push({ name: 'home' })
    }
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de la vérification.')
  } finally {
    checking.value = false
  }
}

async function handleSignOut() {
  await authStore.signOut()
  router.push({ name: 'auth' })
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
    <div class="max-w-sm text-center">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 mb-4 mx-auto">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-7 h-7 text-amber-400">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 7v5l3 3" />
        </svg>
      </div>
      <h1 class="text-lg font-semibold mb-2">Club en attente de validation</h1>
      <p class="text-sm text-neutral-500 mb-6">
        Votre club a bien été créé, mais doit être validé avant que vous puissiez l'utiliser. Vous serez prévenu dès que ce sera fait.
      </p>
      <p v-if="errorMessage" class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4">
        {{ errorMessage }}
      </p>
      <div class="flex gap-3 justify-center">
        <button
          class="h-10 px-4 rounded-lg border border-white/10 text-neutral-400 text-sm font-medium
                 hover:border-white/20 hover:text-white transition-all"
          @click="handleSignOut"
        >
          Déconnexion
        </button>
        <button
          :disabled="checking"
          class="h-10 px-4 rounded-lg bg-white text-neutral-900 text-sm font-semibold
                 hover:bg-neutral-100 disabled:opacity-50 transition-all"
          @click="recheck"
        >
          {{ checking ? 'Vérification...' : 'Vérifier à nouveau' }}
        </button>
      </div>
    </div>
  </div>
</template>
