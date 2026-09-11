<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players.store'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { extractErrorMessage } from '@/lib/errors'

const router = useRouter()
const playersStore = usePlayersStore()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()

const name = ref('')
// Certains navigateurs renvoient une valeur numérique (et non une chaîne) via v-model sur un input type="number"
const number = ref<string | number>('')
const position = ref('')
const teamId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const showForm = ref(false)
const showArchived = ref(false)
const filterTeamId = ref<string | 'ALL'>('ALL')
const filterPosition = ref<string | 'ALL'>('ALL')
const searchQuery = ref('')
const saving = ref(false)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub()
    await Promise.all([playersStore.fetchPlayers(), teamsStore.fetchTeams(club.id)])
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement du club.')
  }
})

// Postes existants dans l'effectif, pour peupler le filtre
const positions = computed(() => {
  const set = new Set(playersStore.players.map((p) => p.position).filter((p): p is string => !!p))
  return [...set].sort((a, b) => a.localeCompare(b))
})

const visiblePlayers = computed(() => {
  let list = playersStore.players.filter((p) => showArchived.value || p.active)
  if (filterTeamId.value !== 'ALL') list = list.filter((p) => p.teamId === filterTeamId.value)
  if (filterPosition.value !== 'ALL') list = list.filter((p) => p.position === filterPosition.value)
  const query = searchQuery.value.trim().toLowerCase()
  if (query) list = list.filter((p) => p.name.toLowerCase().includes(query))
  // Trie par équipe (ordre de création des équipes), puis par numéro
  const teamOrder = new Map(teamsStore.teams.map((t, i) => [t.id, i]))
  return [...list].sort((a, b) => {
    const orderA = a.teamId ? (teamOrder.get(a.teamId) ?? 999) : 998
    const orderB = b.teamId ? (teamOrder.get(b.teamId) ?? 999) : 998
    if (orderA !== orderB) return orderA - orderB
    return (a.number ?? 99) - (b.number ?? 99)
  })
})

function teamName(id: string | null): string {
  if (!id) return 'Sans équipe'
  return teamsStore.teams.find((t) => t.id === id)?.name ?? 'Équipe inconnue'
}

function startEdit(id: string) {
  const player = playersStore.players.find((p) => p.id === id)
  if (!player) return
  editingId.value = id
  name.value = player.name
  number.value = player.number != null ? String(player.number) : ''
  position.value = player.position ?? ''
  teamId.value = player.teamId
  showForm.value = true
}

function resetForm() {
  editingId.value = null
  name.value = ''
  number.value = ''
  position.value = ''
  teamId.value = null
  errorMessage.value = null
  showForm.value = false
}

async function handleSubmit() {
  if (!name.value.trim() || !clubsStore.club) return
  errorMessage.value = null
  saving.value = true
  try {
    const numberStr = String(number.value).trim()
    if (editingId.value) {
      await playersStore.updatePlayer(editingId.value, {
        name: name.value.trim(),
        number: numberStr ? Number(numberStr) : null,
        position: position.value.trim() || null,
        teamId: teamId.value,
      })
    } else {
      await playersStore.createPlayer({
        name: name.value.trim(),
        number: numberStr ? Number(numberStr) : null,
        position: position.value.trim() || null,
        clubId: clubsStore.club.id,
        teamId: teamId.value,
      })
    }
    resetForm()
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de l\'enregistrement.')
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
      <h1 class="text-sm font-semibold text-white flex-1">Effectif du club</h1>
      <button
        class="text-xs text-neutral-500 hover:text-white transition-colors"
        @click="router.push({ name: 'teams' })"
      >
        Gérer les équipes
      </button>
    </div>

    <div class="px-4 pt-5 max-w-2xl mx-auto">

      <!-- Bouton d'ouverture du formulaire -->
      <button
        v-if="!showForm"
        class="w-full h-11 mb-6 rounded-xl border border-dashed border-white/15 text-neutral-400 text-sm font-medium
               hover:border-white/30 hover:text-white transition-all flex items-center justify-center gap-2"
        @click="showForm = true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Ajouter un joueur
      </button>

      <!-- Formulaire ajout / édition -->
      <form v-else class="bg-white/5 border border-white/8 rounded-2xl p-4 mb-6 space-y-3" @submit.prevent="handleSubmit">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-white">{{ editingId ? 'Modifier le joueur' : 'Nouveau joueur' }}</h2>
          <button
            type="button"
            class="text-neutral-500 hover:text-white transition-colors p-1 -mr-1"
            @click="resetForm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
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
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Équipe</label>
          <select
            v-model="teamId"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all [color-scheme:dark]"
          >
            <option :value="null">Sans équipe</option>
            <option v-for="t in teamsStore.teams" :key="t.id" :value="t.id">
              {{ t.name }}<span v-if="t.division"> · {{ t.division }}</span>
            </option>
          </select>
          <p v-if="teamsStore.teams.length === 0" class="text-xs text-neutral-600">
            Aucune équipe créée pour le moment —
            <button type="button" class="underline hover:text-white" @click="router.push({ name: 'teams' })">en créer une</button>
          </p>
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

      <!-- Recherche -->
      <div class="relative mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher un joueur par nom..."
          class="w-full h-10 pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
        />
      </div>

      <!-- Filtres -->
      <div class="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 shrink-0">
          Joueurs ({{ visiblePlayers.length }})
        </h2>
        <div class="flex items-center gap-2 flex-wrap">
          <select
            v-model="filterTeamId"
            class="h-8 px-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs
                   focus:outline-none focus:ring-2 focus:ring-white/20 transition-all [color-scheme:dark]"
          >
            <option value="ALL">Toutes les équipes</option>
            <option v-for="t in teamsStore.teams" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
          <select
            v-if="positions.length > 0"
            v-model="filterPosition"
            class="h-8 px-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs
                   focus:outline-none focus:ring-2 focus:ring-white/20 transition-all [color-scheme:dark]"
          >
            <option value="ALL">Tous les postes</option>
            <option v-for="pos in positions" :key="pos" :value="pos">{{ pos }}</option>
          </select>
          <button
            class="text-xs text-neutral-600 hover:text-neutral-400 transition-colors whitespace-nowrap"
            @click="showArchived = !showArchived"
          >
            {{ showArchived ? 'Masquer les archivés' : 'Voir les archivés' }}
          </button>
        </div>
      </div>

      <div v-if="playersStore.loading" class="flex items-center justify-center py-10">
        <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>

      <p v-else-if="visiblePlayers.length === 0 && playersStore.players.length === 0" class="text-sm text-neutral-600 text-center py-8">
        Aucun joueur pour le moment. Ajoutez votre effectif ci-dessus.
      </p>

      <p v-else-if="visiblePlayers.length === 0" class="text-sm text-neutral-600 text-center py-8">
        Aucun joueur ne correspond à cette recherche.
      </p>

      <div v-else class="space-y-1.5">
        <div
          v-for="player in visiblePlayers"
          :key="player.id"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8"
          :class="{ 'opacity-50': !player.active }"
        >
          <button
            class="flex items-center gap-3 flex-1 min-w-0 text-left"
            @click="router.push({ name: 'player-profile', params: { id: player.id } })"
          >
            <span class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
              {{ player.number ?? '—' }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white font-medium truncate">{{ player.name }}</p>
              <p class="text-xs text-neutral-500 truncate">
                {{ teamName(player.teamId) }}<span v-if="player.position"> · {{ player.position }}</span>
              </p>
            </div>
          </button>
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
