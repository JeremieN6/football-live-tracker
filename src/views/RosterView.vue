<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players.store'

const router = useRouter()
const playersStore = usePlayersStore()

const name = ref('')
const number = ref('')
const position = ref('')
const editingId = ref<string | null>(null)
const showArchived = ref(false)
const saving = ref(false)
const errorMessage = ref<string | null>(null)

onMounted(() => {
  playersStore.fetchPlayers()
})

const visiblePlayers = computed(() =>
  playersStore.players.filter((p) => showArchived.value || p.active),
)

function startEdit(id: string) {
  const player = playersStore.players.find((p) => p.id === id)
  if (!player) return
  editingId.value = id
  name.value = player.name
  number.value = player.number != null ? String(player.number) : ''
  position.value = player.position ?? ''
}

function resetForm() {
  editingId.value = null
  name.value = ''
  number.value = ''
  position.value = ''
  errorMessage.value = null
}

async function handleSubmit() {
  if (!name.value.trim()) return
  errorMessage.value = null
  saving.value = true
  try {
    const payload = {
      name: name.value.trim(),
      number: number.value.trim() ? Number(number.value.trim()) : null,
      position: position.value.trim() || null,
    }
    if (editingId.value) {
      await playersStore.updatePlayer(editingId.value, payload)
    } else {
      await playersStore.createPlayer(payload)
    }
    resetForm()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.'
  } finally {
    saving.value = false
  }
}

async function toggleActive(id: string, active: boolean) {
  await playersStore.setActive(id, !active)
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white pb-20">

    <!-- Header -->
    <div class="sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center gap-3">
      <button
        class="text-neutral-500 hover:text-white transition-colors p-1 -ml-1"
        @click="router.push({ name: 'history' })"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 class="text-sm font-semibold text-white">Effectif du club</h1>
    </div>

    <div class="px-4 pt-5 max-w-2xl mx-auto">

      <!-- Formulaire ajout / édition -->
      <form class="bg-white/5 border border-white/8 rounded-2xl p-4 mb-6 space-y-3" @submit.prevent="handleSubmit">
        <div class="grid grid-cols-[1fr_auto] gap-3">
          <div class="space-y-1">
            <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Nom</label>
            <input
              v-model="name"
              type="text"
              required
              placeholder="Ex: Karim B."
              maxlength="50"
              class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                     text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>
          <div class="space-y-1 w-20">
            <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">N°</label>
            <input
              v-model="number"
              type="number"
              min="1"
              max="99"
              placeholder="9"
              class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                     text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Poste (optionnel)</label>
          <input
            v-model="position"
            type="text"
            placeholder="Ex: Attaquant, Milieu, Défenseur..."
            maxlength="40"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          />
        </div>

        <p v-if="errorMessage" class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {{ errorMessage }}
        </p>

        <div class="flex gap-3 pt-1">
          <button
            v-if="editingId"
            type="button"
            class="flex-1 h-11 rounded-lg border border-white/10 text-neutral-400 text-sm font-medium
                   hover:border-white/20 hover:text-white transition-all"
            @click="resetForm"
          >
            Annuler
          </button>
          <button
            type="submit"
            :disabled="saving || !name.trim()"
            class="flex-1 h-11 rounded-lg bg-white text-neutral-900 text-sm font-semibold
                   hover:bg-neutral-100 disabled:opacity-50 transition-all"
          >
            <span v-if="saving">Enregistrement...</span>
            <span v-else-if="editingId">Mettre à jour</span>
            <span v-else>Ajouter au club</span>
          </button>
        </div>
      </form>

      <!-- Liste effectif -->
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Joueurs ({{ visiblePlayers.length }})
        </h2>
        <button
          class="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
          @click="showArchived = !showArchived"
        >
          {{ showArchived ? 'Masquer les archivés' : 'Voir les archivés' }}
        </button>
      </div>

      <div v-if="playersStore.loading" class="flex items-center justify-center py-10">
        <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>

      <p v-else-if="visiblePlayers.length === 0" class="text-sm text-neutral-600 text-center py-8">
        Aucun joueur pour le moment. Ajoutez votre effectif ci-dessus.
      </p>

      <div v-else class="space-y-1.5">
        <div
          v-for="player in visiblePlayers"
          :key="player.id"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8"
          :class="{ 'opacity-50': !player.active }"
        >
          <span class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
            {{ player.number ?? '—' }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white font-medium truncate">{{ player.name }}</p>
            <p v-if="player.position" class="text-xs text-neutral-500">{{ player.position }}</p>
          </div>
          <button
            class="text-xs text-neutral-500 hover:text-white transition-colors px-2 py-1"
            @click="startEdit(player.id)"
          >
            Modifier
          </button>
          <button
            class="text-xs px-2 py-1 rounded-md transition-colors"
            :class="player.active ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'"
            @click="toggleActive(player.id, player.active)"
          >
            {{ player.active ? 'Archiver' : 'Réactiver' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
