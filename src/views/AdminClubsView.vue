<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminClubsStore } from '@/stores/adminClubs.store'
import { extractErrorMessage } from '@/lib/errors'

const router = useRouter()
const adminStore = useAdminClubsStore()

const checking = ref(true)
const actioningId = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    const admin = await adminStore.checkAdmin()
    if (admin) {
      await adminStore.fetchPendingClubs()
    }
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement.')
  } finally {
    checking.value = false
  }
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function handleApprove(id: string) {
  actioningId.value = id
  errorMessage.value = null
  try {
    await adminStore.approveClub(id)
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de la validation.')
  } finally {
    actioningId.value = null
  }
}

async function handleReject(id: string, name: string) {
  if (!confirm(`Rejeter et supprimer définitivement le club "${name}" ?`)) return
  actioningId.value = id
  errorMessage.value = null
  try {
    await adminStore.rejectClub(id)
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du rejet.')
  } finally {
    actioningId.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white pb-20">

    <!-- Header -->
    <div class="sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center gap-3">
      <button
        class="text-neutral-500 hover:text-white transition-colors p-1 -ml-1"
        @click="router.push({ name: 'home' })"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 class="text-sm font-semibold text-white">Administration — Clubs en attente</h1>
    </div>

    <div class="px-4 pt-5 max-w-3xl mx-auto">

      <div v-if="checking" class="flex items-center justify-center py-10">
        <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>

      <p v-else-if="!adminStore.isAdmin" class="text-sm text-neutral-400 bg-white/5 border border-white/10 rounded-lg px-3 py-3">
        Accès réservé aux administrateurs de la plateforme.
      </p>

      <template v-else>
        <p v-if="errorMessage" class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4">
          {{ errorMessage }}
        </p>

        <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          Clubs en attente ({{ adminStore.pendingClubs.length }})
        </h2>

        <div v-if="adminStore.loading" class="flex items-center justify-center py-10">
          <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>

        <p v-else-if="adminStore.pendingClubs.length === 0" class="text-sm text-neutral-600 text-center py-8">
          Aucun club en attente de validation.
        </p>

        <div v-else class="space-y-1.5">
          <div
            v-for="c in adminStore.pendingClubs"
            :key="c.id"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white font-medium truncate">{{ c.name }}</p>
              <p class="text-xs text-neutral-500 truncate">
                Créé le {{ formatDate(c.createdAt) }} · owner {{ c.ownerId.slice(0, 8) }}…
              </p>
            </div>
            <button
              :disabled="actioningId === c.id"
              class="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
              @click="handleReject(c.id, c.name)"
            >
              Rejeter
            </button>
            <button
              :disabled="actioningId === c.id"
              class="text-xs text-neutral-900 bg-white hover:bg-neutral-100 px-3 py-1.5 rounded-md font-semibold transition-colors disabled:opacity-50"
              @click="handleApprove(c.id)"
            >
              Valider
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
