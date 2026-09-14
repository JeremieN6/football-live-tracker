<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
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
  <div class="min-h-screen bg-app flex flex-col text-ink">

    <div class="flex-none flex items-center gap-1 px-4 pt-3.5 pb-2">
      <button class="p-1 -ml-1 text-ink-meta hover:text-ink transition-colors" @click="router.push({ name: 'home' })">
        <ArrowLeft :size="18" :stroke-width="2" />
      </button>
      <h1 class="text-[20px] font-semibold text-ink">Administration</h1>
    </div>

    <main class="flex-1 px-4 pb-8 max-w-2xl w-full mx-auto">

      <div v-if="checking" class="flex items-center justify-center py-10">
        <div class="w-6 h-6 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
      </div>

      <p v-else-if="!adminStore.isAdmin" class="text-sm text-ink-secondary bg-surface border border-line rounded-card px-3 py-3">
        Accès réservé aux administrateurs de la plateforme.
      </p>

      <template v-else>
        <p v-if="errorMessage" class="text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2 mb-4">
          {{ errorMessage }}
        </p>

        <div class="flex items-baseline justify-between mb-3 mt-2">
          <h2 class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Clubs en attente</h2>
          <span class="font-data text-[11px] text-ink-disabled">{{ adminStore.pendingClubs.length }}</span>
        </div>

        <div v-if="adminStore.loading" class="flex items-center justify-center py-10">
          <div class="w-6 h-6 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
        </div>

        <p v-else-if="adminStore.pendingClubs.length === 0" class="text-sm text-ink-meta text-center py-8">
          Aucun club en attente de validation.
        </p>

        <div v-else class="flex flex-col gap-1.5">
          <div
            v-for="c in adminStore.pendingClubs"
            :key="c.id"
            class="flex items-center gap-3 px-3.5 py-3 rounded-card bg-surface border border-line"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm text-ink font-medium truncate">{{ c.name }}</p>
              <p class="text-[11px] text-ink-meta truncate mt-0.5">
                Créé le {{ formatDate(c.createdAt) }} · owner {{ c.ownerId.slice(0, 8) }}…
              </p>
            </div>
            <button
              :disabled="actioningId === c.id"
              class="text-xs text-danger hover:bg-danger-soft px-2.5 py-1.5 rounded-input transition-colors disabled:opacity-50"
              @click="handleReject(c.id, c.name)"
            >
              Rejeter
            </button>
            <button
              :disabled="actioningId === c.id"
              class="text-xs text-brand-soft bg-brand hover:bg-brand-hover px-3 py-1.5 rounded-input font-semibold transition-colors disabled:opacity-50"
              @click="handleApprove(c.id)"
            >
              Valider
            </button>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
