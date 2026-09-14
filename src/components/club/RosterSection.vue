<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Plus, X } from 'lucide-vue-next'
import { usePlayersStore } from '@/stores/players.store'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { useClubMembersStore } from '@/stores/clubMembers.store'
import { deriveInitials, deriveDisplayName } from '@/lib/displayName'
import { extractErrorMessage } from '@/lib/errors'

const emit = defineEmits<{ 'go-teams': [] }>()

const router = useRouter()
const playersStore = usePlayersStore()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const membersStore = useClubMembersStore()

const name = ref('')
// Certains navigateurs renvoient une valeur numérique (et non une chaîne) via v-model sur un input type="number"
const number = ref<string | number>('')
const position = ref('')
const teamId = ref<string | null>(null)
const memberId = ref<string | null>(null)
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
    await Promise.all([playersStore.fetchPlayers(), teamsStore.fetchTeams(club.id), membersStore.fetchMembers(club.id)])
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement du club.')
  }
})

// Comptes membres pas déjà liés à une autre fiche joueur (+ celui actuellement
// lié au joueur en cours d'édition, pour ne pas le faire disparaître de la liste)
const availableMembers = computed(() => {
  const linkedElsewhere = new Set(
    playersStore.players.filter((p) => p.memberId && p.id !== editingId.value).map((p) => p.memberId),
  )
  return membersStore.members.filter((m) => !linkedElsewhere.has(m.id))
})

function memberLabel(id: string): string {
  const member = membersStore.members.find((m) => m.id === id)
  if (!member) return 'Compte inconnu'
  return member.invitedEmail ? deriveDisplayName(member.invitedEmail) : 'Vous'
}

// Un coach non-propriétaire ne peut rattacher un joueur qu'à ses équipes
// rattachées (ou celles de sa catégorie pour un Responsable de catégorie)
const selectableTeams = computed(() => {
  if (clubsStore.isOwner) return teamsStore.teams
  return teamsStore.teams.filter((t) => clubsStore.hasTeamAccess(t))
})

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

// Palette decorative cyclique pour l'avatar (les joueurs n'ont pas de "role"
// comme les membres du club — juste un poste en texte libre).
const AVATAR_PALETTE = [
  { bg: '#451a03', border: '#78716c', fg: '#FBBF24' },
  { bg: '#172554', border: '#1e40af', fg: '#60A5FA' },
  { bg: '#052e16', border: '#166534', fg: '#4ADE80' },
  { bg: '#450a0a', border: '#7f1d1d', fg: '#F87171' },
  { bg: '#1e1033', border: '#7c3aed', fg: '#a78bfa' },
]
function avatarStyle(index: number) {
  return AVATAR_PALETTE[index % AVATAR_PALETTE.length]
}

function startEdit(id: string) {
  const player = playersStore.players.find((p) => p.id === id)
  if (!player) return
  editingId.value = id
  name.value = player.name
  number.value = player.number != null ? String(player.number) : ''
  position.value = player.position ?? ''
  teamId.value = player.teamId
  memberId.value = player.memberId
  showForm.value = true
}

function resetForm() {
  editingId.value = null
  name.value = ''
  number.value = ''
  position.value = ''
  teamId.value = null
  memberId.value = null
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
        memberId: memberId.value,
      })
    } else {
      await playersStore.createPlayer({
        name: name.value.trim(),
        number: numberStr ? Number(numberStr) : null,
        position: position.value.trim() || null,
        clubId: clubsStore.club.id,
        teamId: teamId.value,
        memberId: memberId.value,
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
  <div>
    <!-- Recherche -->
    <div class="relative mb-2.5">
      <Search :size="15" :stroke-width="2" class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-meta" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Rechercher un joueur par nom…"
        class="w-full h-10 pl-9 pr-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
               text-sm outline-none focus:border-brand transition-colors"
      />
    </div>

    <!-- Filtres -->
    <div class="flex items-center gap-1.5 mb-3 overflow-x-auto pb-0.5 [scrollbar-width:none]">
      <button
        class="flex-none h-8 px-2.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors"
        :class="filterTeamId === 'ALL' ? 'bg-brand-soft border-brand-line text-brand-ink' : 'bg-surface border-line text-ink-secondary'"
        @click="filterTeamId = 'ALL'"
      >
        Toutes équipes
      </button>
      <button
        v-for="t in teamsStore.teams"
        :key="t.id"
        class="flex-none h-8 px-2.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors"
        :class="filterTeamId === t.id ? 'bg-brand-soft border-brand-line text-brand-ink' : 'bg-surface border-line text-ink-secondary'"
        @click="filterTeamId = t.id"
      >
        {{ t.name }}
      </button>
      <select
        v-if="positions.length > 0"
        v-model="filterPosition"
        class="flex-none h-8 px-2 rounded-full bg-surface border border-line text-ink-secondary text-xs outline-none [color-scheme:dark]"
      >
        <option value="ALL">Tous les postes</option>
        <option v-for="pos in positions" :key="pos" :value="pos">{{ pos }}</option>
      </select>
      <button
        class="flex-none text-xs text-ink-meta hover:text-ink-secondary transition-colors whitespace-nowrap px-1"
        @click="showArchived = !showArchived"
      >
        {{ showArchived ? 'Masquer les archivés' : 'Voir les archivés' }}
      </button>
    </div>

    <div v-if="playersStore.loading" class="flex items-center justify-center py-10">
      <div class="w-6 h-6 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
    </div>

    <p v-else-if="visiblePlayers.length === 0 && playersStore.players.length === 0" class="text-sm text-ink-meta text-center py-8">
      Aucun joueur — ajoute le premier
    </p>

    <p v-else-if="visiblePlayers.length === 0" class="text-sm text-ink-meta text-center py-8">
      Aucun joueur ne correspond à cette recherche
    </p>

    <div v-else class="grid grid-cols-2 gap-2">
      <div
        v-for="(player, i) in visiblePlayers"
        :key="player.id"
        class="min-w-0 flex flex-col gap-2 p-3 bg-surface border border-line rounded-card transition-colors"
        :class="{ 'opacity-50': !player.active }"
      >
        <button class="flex items-center justify-between gap-1.5 text-left" @click="router.push({ name: 'player-profile', params: { id: player.id } })">
          <span
            class="flex items-center justify-center w-[38px] h-[38px] rounded-full font-data text-xs font-bold border"
            :style="{ background: avatarStyle(i).bg, borderColor: avatarStyle(i).border, color: avatarStyle(i).fg }"
          >
            {{ deriveInitials(player.name.replace(/\s+/, '.')) }}
          </span>
          <span class="font-score text-xs font-bold text-ink-disabled">{{ player.number ?? '—' }}</span>
        </button>
        <button class="min-w-0 text-left" @click="router.push({ name: 'player-profile', params: { id: player.id } })">
          <p class="text-[13px] font-medium text-ink truncate">{{ player.name }}</p>
          <p class="mt-0.5 text-[11px] text-ink-meta truncate">
            {{ teamName(player.teamId) }}<span v-if="player.position"> · {{ player.position }}</span>
          </p>
        </button>
        <div v-if="clubsStore.canWrite" class="flex items-center gap-2.5 flex-wrap">
          <span v-if="!player.active" class="font-data text-[9px] text-warning">archivé</span>
          <button class="text-[11px] text-ink-meta hover:text-ink-secondary transition-colors" @click="startEdit(player.id)">Modifier</button>
          <button
            class="text-[11px] transition-colors"
            :class="player.active ? 'text-danger hover:opacity-80' : 'text-brand-ink hover:opacity-80'"
            @click="toggleActive(player.id, player.active)"
          >
            {{ player.active ? 'Archiver' : 'Réactiver' }}
          </button>
        </div>
      </div>
    </div>

    <button
      v-if="clubsStore.canWrite"
      class="flex items-center justify-center gap-1.5 w-full h-11 mt-3 rounded-btn border border-dashed border-line-strong text-ink-secondary text-[13px] font-medium hover:text-ink hover:bg-surface hover:border-ink-meta transition-colors"
      @click="showForm = true"
    >
      <Plus :size="15" :stroke-width="2" />
      Ajouter un joueur
    </button>

    <!-- Popup ajout / édition -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="resetForm"
    >
      <div class="w-full max-w-md bg-surface border border-line rounded-card p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-ink">{{ editingId ? 'Modifier le joueur' : 'Nouveau joueur' }}</h2>
          <button class="text-ink-meta hover:text-ink transition-colors p-1" @click="resetForm">
            <X :size="18" :stroke-width="2" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="grid grid-cols-[1fr_auto] gap-3">
            <div class="space-y-1">
              <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Nom</label>
              <input
                v-model="name"
                type="text"
                required
                placeholder="Ex: Karim B."
                maxlength="50"
                class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                       text-sm outline-none focus:border-brand transition-colors"
              />
            </div>
            <div class="space-y-1 w-20">
              <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">N°</label>
              <input
                v-model="number"
                type="number"
                min="1"
                max="99"
                placeholder="9"
                class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                       text-sm outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Poste (optionnel)</label>
            <input
              v-model="position"
              type="text"
              placeholder="Ex: Attaquant, Milieu, Défenseur…"
              maxlength="40"
              class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                     text-sm outline-none focus:border-brand transition-colors"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Équipe</label>
            <select
              v-model="teamId"
              class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                     text-sm outline-none focus:border-brand transition-colors [color-scheme:dark]"
            >
              <option v-if="clubsStore.isOwner" :value="null">Sans équipe</option>
              <option v-for="t in selectableTeams" :key="t.id" :value="t.id">
                {{ t.name }}<span v-if="t.division"> · {{ t.division }}</span>
              </option>
            </select>
            <p v-if="teamsStore.teams.length === 0" class="text-xs text-ink-meta">
              Aucune équipe créée pour le moment —
              <button type="button" class="underline hover:text-ink" @click="emit('go-teams')">en créer une</button>
            </p>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Compte lié (optionnel)</label>
            <select
              v-model="memberId"
              class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                     text-sm outline-none focus:border-brand transition-colors [color-scheme:dark]"
            >
              <option :value="null">Aucun</option>
              <option v-for="m in availableMembers" :key="m.id" :value="m.id">{{ memberLabel(m.id) }}</option>
            </select>
            <p class="text-xs text-ink-meta">
              Si ce joueur a aussi un compte sur l'app (ex. il a été invité comme JOUEUR), relie sa fiche pour afficher son numéro/poste sur sa carte membre.
            </p>
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
              <span v-else>Ajouter au club</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
