<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { extractErrorMessage } from '@/lib/errors'

const router = useRouter()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()

const name = ref('')
const division = ref('')
const category = ref('')
const formation = ref('')
const editingId = ref<string | null>(null)
const showForm = ref(false)
const saving = ref(false)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub()
    await Promise.all([teamsStore.fetchTeams(club.id), playersStore.fetchPlayers()])
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement du club.')
  }
})

// Nombre de joueurs actifs par équipe, calculé depuis l'effectif (pas stocké)
const playerCount = computed(() => {
  const counts = new Map<string, number>()
  for (const p of playersStore.players) {
    if (!p.active || !p.teamId) continue
    counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1)
  }
  return counts
})

function startEdit(id: string) {
  const team = teamsStore.teams.find((t) => t.id === id)
  if (!team) return
  editingId.value = id
  name.value = team.name
  division.value = team.division ?? ''
  category.value = team.category ?? ''
  formation.value = team.formation ?? ''
  showForm.value = true
}

function resetForm() {
  editingId.value = null
  name.value = ''
  division.value = ''
  category.value = ''
  formation.value = ''
  errorMessage.value = null
  showForm.value = false
}

async function handleSubmit() {
  if (!name.value.trim() || !clubsStore.club) return
  errorMessage.value = null
  saving.value = true
  try {
    const payload = {
      name: name.value.trim(),
      division: division.value.trim() || null,
      category: category.value.trim() || null,
      formation: formation.value.trim() || null,
    }
    if (editingId.value) {
      await teamsStore.updateTeam(editingId.value, payload)
    } else {
      await teamsStore.createTeam(clubsStore.club.id, payload)
    }
    resetForm()
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de l\'enregistrement.')
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: string) {
  if (!confirm('Supprimer cette équipe ? Les joueurs et matchs qui y sont rattachés ne seront plus classés dans aucune équipe.')) return
  await teamsStore.deleteTeam(id)
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
      <h1 class="text-sm font-semibold text-white">{{ clubsStore.club?.name ?? 'Équipes du club' }}</h1>
    </div>

    <div class="px-4 pt-5 max-w-2xl mx-auto">

      <!-- Bouton d'ouverture du formulaire -->
      <button
        class="w-full h-11 mb-6 rounded-xl border border-dashed border-white/15 text-neutral-400 text-sm font-medium
               hover:border-white/30 hover:text-white transition-all flex items-center justify-center gap-2"
        @click="showForm = true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Créer une équipe
      </button>

      <!-- Liste équipes -->
      <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
        Équipes ({{ teamsStore.teams.length }})
      </h2>

      <div v-if="teamsStore.loading" class="flex items-center justify-center py-10">
        <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>

      <p v-else-if="teamsStore.teams.length === 0" class="text-sm text-neutral-600 text-center py-8">
        Aucune équipe pour le moment.
      </p>

      <div v-else class="space-y-1.5">
        <div
          v-for="team in teamsStore.teams"
          :key="team.id"
          class="px-3 py-2.5 rounded-xl bg-white/5 border border-white/8"
        >
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white font-medium truncate">
                {{ team.name }}
                <span v-if="team.category" class="text-neutral-500 font-normal">· {{ team.category }}</span>
              </p>
              <p v-if="team.division" class="text-xs text-neutral-500">{{ team.division }}</p>
            </div>
            <button
              class="text-xs text-neutral-500 hover:text-white transition-colors px-2 py-1"
              @click="startEdit(team.id)"
            >
              Modifier
            </button>
            <button
              class="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors"
              @click="handleDelete(team.id)"
            >
              Supprimer
            </button>
          </div>
          <div class="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
            <span class="text-xs text-neutral-400">
              👤 {{ playerCount.get(team.id) ?? 0 }} joueur{{ (playerCount.get(team.id) ?? 0) > 1 ? 's' : '' }}
            </span>
            <span v-if="team.formation" class="text-xs text-neutral-400">⚽ {{ team.formation }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Popup ajout / édition -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="resetForm"
    >
      <div class="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-white">{{ editingId ? 'Modifier l\'équipe' : 'Nouvelle équipe' }}</h2>
          <button
            class="text-neutral-500 hover:text-white transition-colors p-1"
            @click="resetForm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="space-y-1">
            <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Nom de l'équipe</label>
            <input
              v-model="name"
              type="text"
              required
              placeholder="Ex: Équipe 1, Équipe réserve..."
              maxlength="50"
              class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                     text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Division</label>
              <input
                v-model="division"
                type="text"
                placeholder="Ex: Division 3"
                maxlength="50"
                class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                       text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Catégorie</label>
              <input
                v-model="category"
                type="text"
                placeholder="Ex: Seniors, U19..."
                maxlength="30"
                class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                       text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Formation favorite (optionnel)</label>
            <input
              v-model="formation"
              type="text"
              placeholder="Ex: 4-4-2, 4-3-3..."
              maxlength="20"
              class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                     text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>

          <p v-if="errorMessage" class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {{ errorMessage }}
          </p>

          <div class="flex gap-3 pt-2">
            <button
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
                     hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span v-if="saving">Enregistrement...</span>
              <span v-else-if="editingId">Mettre à jour</span>
              <span v-else>Créer l'équipe</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
