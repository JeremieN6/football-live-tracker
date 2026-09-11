<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useClubsStore } from '@/stores/clubs.store'
import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/lib/errors'

const router = useRouter()
const clubsStore = useClubsStore()
const authStore = useAuthStore()

const name = ref('')
const saving = ref(false)
const errorMessage = ref<string | null>(null)

async function handleSubmit() {
  if (!name.value.trim()) return
  errorMessage.value = null
  saving.value = true
  try {
    await clubsStore.createClub(name.value.trim())
    router.push({ name: 'pending' })
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de la création du club.')
  } finally {
    saving.value = false
  }
}

async function handleSignOut() {
  await authStore.signOut()
  router.push({ name: 'auth' })
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <h1 class="text-lg font-semibold mb-2 text-center">Créer votre club</h1>
      <p class="text-sm text-neutral-500 mb-6 text-center">
        Aucun club ne vous est encore rattaché. Donnez un nom à votre club pour continuer —
        il sera ensuite validé par un administrateur avant de devenir utilisable.
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Nom du club</label>
          <input
            v-model="name"
            type="text"
            required
            autofocus
            placeholder="Ex: FC Tourcoing"
            maxlength="60"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          />
        </div>

        <p v-if="errorMessage" class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          :disabled="saving || !name.trim()"
          class="w-full h-11 rounded-lg bg-white text-neutral-900 text-sm font-semibold
                 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {{ saving ? 'Création...' : 'Créer le club' }}
        </button>
        <button
          type="button"
          class="w-full h-10 text-neutral-500 hover:text-white text-sm transition-colors"
          @click="handleSignOut"
        >
          Déconnexion
        </button>
      </form>
    </div>
  </div>
</template>
