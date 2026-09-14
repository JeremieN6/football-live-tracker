<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Clock } from 'lucide-vue-next'
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
  <div class="min-h-screen bg-app text-ink flex items-center justify-center px-4">
    <div class="max-w-sm text-center">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-line mb-4 mx-auto">
        <Clock :size="26" :stroke-width="1.5" class="text-warning" />
      </div>
      <h1 class="text-lg font-semibold text-ink mb-2">Club en attente de validation</h1>
      <p class="text-sm text-ink-meta mb-6">
        Votre club a bien été créé, mais doit être validé avant que vous puissiez l'utiliser. Vous serez prévenu dès que ce sera fait.
      </p>
      <p v-if="errorMessage" class="text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2 mb-4">
        {{ errorMessage }}
      </p>
      <div class="flex gap-3 justify-center">
        <button
          class="h-10 px-4 rounded-btn border border-line text-ink-secondary text-sm font-medium hover:border-line-strong hover:text-ink transition-colors"
          @click="handleSignOut"
        >
          Déconnexion
        </button>
        <button
          :disabled="checking"
          class="h-10 px-4 rounded-btn bg-brand text-brand-soft text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors"
          @click="recheck"
        >
          {{ checking ? 'Vérification…' : 'Vérifier à nouveau' }}
        </button>
      </div>
    </div>
  </div>
</template>
