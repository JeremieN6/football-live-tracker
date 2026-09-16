<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Users, ChevronDown, Plus, X, Star } from 'lucide-vue-next'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { useMatchStore } from '@/stores/match.store'
import { extractErrorMessage } from '@/lib/errors'

const router = useRouter()
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

function teamShort(teamName: string): string {
  const clean = teamName.trim()
  return clean.length <= 4 ? clean.toUpperCase() : clean.slice(0, 3).toUpperCase()
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

// Équipe fanion : son coach/adjoint voit (lecture seule) toutes les autres
// équipes, jamais l'inverse — au plus une par club (voir teams.store.ts).
async function toggleFlagship(team: { id: string; isFlagship: boolean }) {
  if (!clubsStore.club) return
  try {
    await teamsStore.setFlagshipTeam(clubsStore.club.id, team.isFlagship ? null : team.id)
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, "Erreur lors de la désignation de l'équipe fanion.")
  }
}
</script>

<template>
  <div>
    <p v-if="errorMessage" class="mb-3 text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2">
      {{ errorMessage }}
    </p>

    <div v-if="teamsStore.loading" class="flex items-center justify-center py-10">
      <div class="w-6 h-6 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
    </div>

    <p v-else-if="teamsStore.teams.length === 0" class="text-sm text-ink-meta text-center py-8">
      Aucune équipe — crée la première
    </p>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="team in teamsStore.teams"
        :key="team.id"
        class="bg-surface border border-line rounded-card overflow-hidden"
      >
        <button class="w-full flex items-center gap-3 p-3.5 text-left hover:bg-surface-hover transition-colors" @click="toggleRoster(team.id)">
          <span class="flex-none flex items-center justify-center w-11 h-11 rounded-input font-data text-xs font-bold bg-surface-sub border border-line text-ink-secondary">
            {{ teamShort(team.name) }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-ink truncate flex items-center gap-1.5">
              <Star v-if="team.isFlagship" :size="12" :stroke-width="2" class="flex-none text-brand-ink fill-brand-ink" />
              <span class="truncate">{{ team.name }}<span v-if="team.category" class="text-ink-meta font-normal"> · {{ team.category }}</span></span>
            </p>
            <div class="flex items-center gap-1.5 mt-[5px]">
              <Users :size="11" :stroke-width="2" class="text-ink-meta flex-none" />
              <span class="text-[11px] text-ink-meta truncate">
                {{ teamPlayers(team.id).length }} joueur{{ teamPlayers(team.id).length > 1 ? 's' : '' }}<span v-if="team.division"> · {{ team.division }}</span>
              </span>
            </div>
            <button
              v-if="teamStats(team.id).played > 0"
              type="button"
              class="font-data text-[10px] text-ink-disabled mt-1 hover:text-brand-ink transition-colors"
              @click.stop="router.push({ name: 'team-stats', params: { id: team.id } })"
            >
              {{ teamStats(team.id).played }} match{{ teamStats(team.id).played > 1 ? 's' : '' }} ·
              {{ teamStats(team.id).wins }}V {{ teamStats(team.id).draws }}N {{ teamStats(team.id).losses }}D ·
              {{ teamStats(team.id).goalsFor }}-{{ teamStats(team.id).goalsAgainst }} · voir plus
            </button>
          </div>
          <ChevronDown
            :size="16"
            :stroke-width="2"
            class="flex-none text-ink-disabled transition-transform"
            :style="{ transform: expandedTeamId === team.id ? 'rotate(0deg)' : 'rotate(-90deg)' }"
          />
        </button>

        <div v-if="expandedTeamId === team.id" class="px-3.5 pb-3.5 pt-0.5 border-t border-line">
          <p v-if="teamPlayers(team.id).length === 0" class="text-xs text-ink-meta pt-3">
            Aucun joueur assigné à cette équipe pour le moment.
          </p>
          <div v-else class="flex flex-wrap gap-1.5 pt-3">
            <button
              v-for="p in teamPlayers(team.id)"
              :key="p.id"
              type="button"
              class="text-xs text-ink-body bg-surface-sub border border-line rounded-full px-2.5 py-1 hover:border-line-strong hover:bg-surface-hover transition-colors"
              @click="router.push({ name: 'player-profile', params: { id: p.id } })"
            >
              {{ p.name }}<span v-if="p.position" class="text-ink-meta"> · {{ p.position }}</span>
            </button>
          </div>
          <div v-if="clubsStore.isOwner" class="flex flex-wrap gap-4 pt-3">
            <button class="text-xs text-ink-meta hover:text-ink-secondary transition-colors" @click="startEdit(team.id)">Modifier</button>
            <button class="text-xs text-ink-meta hover:text-ink-secondary transition-colors" @click="toggleFlagship(team)">
              {{ team.isFlagship ? 'Retirer le statut fanion' : 'Désigner équipe fanion' }}
            </button>
            <button class="text-xs text-danger hover:opacity-80 transition-colors" @click="handleDelete(team.id)">Supprimer</button>
          </div>
        </div>
      </div>
    </div>

    <button
      v-if="clubsStore.isOwner"
      class="flex items-center justify-center gap-1.5 w-full h-11 mt-3 rounded-btn border border-dashed border-line-strong text-ink-secondary text-[13px] font-medium hover:text-ink hover:bg-surface hover:border-ink-meta transition-colors"
      @click="showForm = true"
    >
      <Plus :size="15" :stroke-width="2" />
      Créer une équipe
    </button>

    <!-- Popup ajout / édition -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="resetForm"
    >
      <div class="w-full max-w-md bg-surface border border-line rounded-card p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-ink">{{ editingId ? 'Modifier l\'équipe' : 'Nouvelle équipe' }}</h2>
          <button class="text-ink-meta hover:text-ink transition-colors p-1" @click="resetForm">
            <X :size="18" :stroke-width="2" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Nom de l'équipe</label>
            <input
              v-model="name"
              type="text"
              required
              placeholder="Ex: Équipe 1, Équipe réserve…"
              maxlength="50"
              class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                     text-sm outline-none focus:border-brand transition-colors"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Division</label>
              <input
                v-model="division"
                type="text"
                placeholder="Ex: Division 3"
                maxlength="50"
                class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                       text-sm outline-none focus:border-brand transition-colors"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Catégorie</label>
              <input
                v-model="category"
                type="text"
                placeholder="Ex: Seniors, U19…"
                maxlength="30"
                class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                       text-sm outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Formation favorite (optionnel)</label>
            <input
              v-model="formation"
              type="text"
              placeholder="Ex: 4-4-2, 4-3-3…"
              maxlength="20"
              class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                     text-sm outline-none focus:border-brand transition-colors"
            />
          </div>

          <p v-if="errorMessage" class="text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2">
            {{ errorMessage }}
          </p>

          <div class="flex gap-3 pt-2">
            <button
              type="button"
              class="flex-1 h-11 rounded-btn border border-line text-ink-secondary text-sm font-medium hover:border-line-strong hover:text-ink transition-colors"
              @click="resetForm"
            >
              Annuler
            </button>
            <button
              type="submit"
              :disabled="saving || !name.trim()"
              class="flex-1 h-11 rounded-btn bg-brand text-brand-soft text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="saving">Enregistrement…</span>
              <span v-else-if="editingId">Mettre à jour</span>
              <span v-else>Créer l'équipe</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
