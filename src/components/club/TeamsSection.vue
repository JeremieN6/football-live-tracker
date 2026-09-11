<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { useMatchStore } from '@/stores/match.store'
import { extractErrorMessage } from '@/lib/errors'

const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()
const matchStore = useMatchStore()

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
    await Promise.all([teamsStore.fetchTeams(club.id), playersStore.fetchPlayers(), matchStore.fetchMatches()])
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement du club.')
  }
})

// Stats agrégées par équipe, calculées à la volée depuis les matchs terminés
// (score "pour" = GOAL_FOR, score "contre" = GOAL_AGAINST, indépendamment de
// qui joue à domicile/extérieur — voir TrackerView.vue).
interface TeamStats {
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
}

const statsByTeam = computed(() => {
  const map = new Map<string, TeamStats>()
  for (const m of matchStore.matches) {
    if (m.status !== 'FINISHED' || !m.teamId) continue
    const stats = map.get(m.teamId) ?? { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }
    stats.played += 1
    stats.goalsFor += m.scoreHome
    stats.goalsAgainst += m.scoreAway
    if (m.scoreHome > m.scoreAway) stats.wins += 1
    else if (m.scoreHome < m.scoreAway) stats.losses += 1
    else stats.draws += 1
    map.set(m.teamId, stats)
  }
  return map
})

const emptyStats: TeamStats = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }

function teamStats(teamId: string): TeamStats {
  return statsByTeam.value.get(teamId) ?? emptyStats
}

// Joueurs actifs par équipe, calculé depuis l'effectif (pas stocké)
const playersByTeam = computed(() => {
  const map = new Map<string, typeof playersStore.players>()
  for (const p of playersStore.players) {
    if (!p.active || !p.teamId) continue
    const list = map.get(p.teamId) ?? []
    list.push(p)
    map.set(p.teamId, list)
  }
  return map
})

function teamPlayers(teamId: string) {
  return playersByTeam.value.get(teamId) ?? []
}

const expandedTeamId = ref<string | null>(null)
function toggleRoster(teamId: string) {
  expandedTeamId.value = expandedTeamId.value === teamId ? null : teamId
}

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
  <div>
    <!-- Bouton d'ouverture du formulaire (propriétaire uniquement) -->
    <button
      v-if="clubsStore.isOwner"
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
            v-if="clubsStore.isOwner"
            class="text-xs text-neutral-500 hover:text-white transition-colors px-2 py-1"
            @click="startEdit(team.id)"
          >
            Modifier
          </button>
          <button
            v-if="clubsStore.isOwner"
            class="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors"
            @click="handleDelete(team.id)"
          >
            Supprimer
          </button>
        </div>

        <!-- Stats agrégées (matchs terminés uniquement) -->
        <p v-if="teamStats(team.id).played > 0" class="text-xs text-neutral-500 mt-1.5">
          🏆 {{ teamStats(team.id).played }} match{{ teamStats(team.id).played > 1 ? 's' : '' }} ·
          {{ teamStats(team.id).wins }}V {{ teamStats(team.id).draws }}N {{ teamStats(team.id).losses }}D ·
          {{ teamStats(team.id).goalsFor }}-{{ teamStats(team.id).goalsAgainst }} buts
        </p>

        <button
          type="button"
          class="w-full flex items-center gap-3 mt-2 pt-2 border-t border-white/5 text-left"
          @click="toggleRoster(team.id)"
        >
          <span class="text-xs text-neutral-400">
            👤 {{ teamPlayers(team.id).length }} joueur{{ teamPlayers(team.id).length > 1 ? 's' : '' }}
          </span>
          <span v-if="team.formation" class="text-xs text-neutral-400">⚽ {{ team.formation }}</span>
          <span class="text-xs text-neutral-600 ml-auto">
            {{ expandedTeamId === team.id ? 'Masquer ▲' : 'Voir l\'effectif ▼' }}
          </span>
        </button>

        <div v-if="expandedTeamId === team.id" class="mt-2 pt-2 border-t border-white/5">
          <p v-if="teamPlayers(team.id).length === 0" class="text-xs text-neutral-600">
            Aucun joueur assigné à cette équipe pour le moment.
          </p>
          <div v-else class="flex flex-wrap gap-1.5">
            <span
              v-for="p in teamPlayers(team.id)"
              :key="p.id"
              class="text-xs text-neutral-300 bg-white/5 border border-white/10 rounded-full px-2.5 py-1"
            >
              {{ p.name }}<span v-if="p.position" class="text-neutral-500"> · {{ p.position }}</span>
            </span>
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
