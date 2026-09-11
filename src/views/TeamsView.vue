<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'

const router = useRouter()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()

const name = ref('')
const division = ref('')
const editingId = ref<string | null>(null)
const saving = ref(false)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  const club = await clubsStore.ensureClub()
  await teamsStore.fetchTeams(club.id)
})

function startEdit(id: string) {
  const team = teamsStore.teams.find((t) => t.id === id)
  if (!team) return
  editingId.value = id
  name.value = team.name
  division.value = team.division ?? ''
}

function resetForm() {
  editingId.value = null
  name.value = ''
  division.value = ''
  errorMessage.value = null
}

async function handleSubmit() {
  if (!name.value.trim() || !clubsStore.club) return
  errorMessage.value = null
  saving.value = true
  try {
    const payload = { name: name.value.trim(), division: division.value.trim() || null }
    if (editingId.value) {
      await teamsStore.updateTeam(editingId.value, payload)
    } else {
      await teamsStore.createTeam(clubsStore.club.id, payload)
    }
    resetForm()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.'
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

      <!-- Formulaire ajout / édition -->
      <form class="bg-white/5 border border-white/8 rounded-2xl p-4 mb-6 space-y-3" @submit.prevent="handleSubmit">
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
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Division (optionnel)</label>
          <input
            v-model="division"
            type="text"
            placeholder="Ex: Division 1, Division 3..."
            maxlength="50"
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
            <span v-else>Créer l'équipe</span>
          </button>
        </div>
      </form>

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
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white font-medium truncate">{{ team.name }}</p>
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
      </div>
    </div>
  </div>
</template>
