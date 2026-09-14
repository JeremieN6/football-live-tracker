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
  <div class="min-h-screen bg-app text-ink flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <h1 class="text-lg font-semibold text-ink mb-2 text-center">Créer votre club</h1>
      <p class="text-sm text-ink-meta mb-6 text-center">
        Aucun club ne vous est encore rattaché. Donnez un nom à votre club pour continuer —
        il sera ensuite validé par un administrateur avant de devenir utilisable.
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Nom du club</label>
          <input
            v-model="name"
            type="text"
            required
            autofocus
            placeholder="Ex: FC Tourcoing"
            maxlength="60"
            class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                   text-sm outline-none focus:border-brand transition-colors"
          />
        </div>

        <p v-if="errorMessage" class="text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2">
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          :disabled="saving || !name.trim()"
          class="w-full h-11 rounded-btn bg-brand text-brand-soft text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ saving ? 'Création…' : 'Créer le club' }}
        </button>
        <button
          type="button"
          class="w-full h-10 text-ink-meta hover:text-ink text-sm transition-colors"
          @click="handleSignOut"
        >
          Déconnexion
        </button>
      </form>
    </div>
  </div>
</template>
