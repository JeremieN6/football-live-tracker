<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClubsStore, type MemberRole } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { useClubMembersStore, type ClubMember } from '@/stores/clubMembers.store'
import { extractErrorMessage } from '@/lib/errors'

const router = useRouter()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const membersStore = useClubMembersStore()

type InvitableRole = Exclude<MemberRole, 'OWNER'>

const roleOptions: { value: InvitableRole; label: string; hint: string }[] = [
  { value: 'COACH', label: 'Coach', hint: 'Accès complet (créer/modifier) sur ses équipes' },
  { value: 'ADJOINT', label: 'Adjoint', hint: 'Aide le coach à opérer le live tracker sur son équipe' },
  { value: 'PLAYER', label: 'Joueur', hint: 'Lecture seule sur ses équipes' },
  { value: 'OTHER', label: 'Autre', hint: 'Staff, lecture seule sur ses équipes' },
  { value: 'PRESIDENT', label: 'Président', hint: 'Lecture seule sur tout le club, aucune équipe à choisir' },
  { value: 'CATEGORY_MANAGER', label: 'Responsable de catégorie', hint: 'Accès complet à toutes les équipes d\'une ou plusieurs catégories, y compris futures' },
]

function roleLabel(role: MemberRole): string {
  if (role === 'OWNER') return 'Propriétaire'
  return roleOptions.find((r) => r.value === role)?.label ?? role
}

const showForm = ref(false)
const email = ref('')
const role = ref<InvitableRole>('COACH')
const teamIds = ref<string[]>([])
const categories = ref<string[]>([])
const saving = ref(false)
const errorMessage = ref<string | null>(null)

const needsTeams = computed(() => role.value !== 'PRESIDENT' && role.value !== 'CATEGORY_MANAGER')
const needsCategories = computed(() => role.value === 'CATEGORY_MANAGER')

const availableCategories = computed(() => {
  const set = new Set<string>()
  for (const t of teamsStore.teams) {
    if (t.category) set.add(t.category)
  }
  return [...set].sort()
})

function toggleCategory(category: string) {
  const index = categories.value.indexOf(category)
  if (index === -1) categories.value.push(category)
  else categories.value.splice(index, 1)
}

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub()
    if (!clubsStore.isOwner) {
      errorMessage.value = 'Seul le propriétaire du club peut gérer les membres.'
      return
    }
    await Promise.all([teamsStore.fetchTeams(club.id), membersStore.fetchMembers(club.id)])
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement du club.')
  }
})

function teamNames(ids: string[]): string {
  if (ids.length === 0) return 'Aucune équipe'
  return ids
    .map((id) => teamsStore.teams.find((t) => t.id === id)?.name ?? 'Équipe inconnue')
    .join(', ')
}

function accessSummary(member: ClubMember): string {
  if (member.role === 'OWNER' || member.role === 'PRESIDENT') return 'Toutes les équipes'
  if (member.role === 'CATEGORY_MANAGER') {
    return member.categories.length > 0 ? `Catégorie(s) : ${member.categories.join(', ')}` : 'Aucune catégorie'
  }
  return teamNames(member.teamIds)
}

function toggleTeam(id: string) {
  const index = teamIds.value.indexOf(id)
  if (index === -1) teamIds.value.push(id)
  else teamIds.value.splice(index, 1)
}

const sortedMembers = computed(() =>
  [...membersStore.members].sort((a, b) => (a.role === b.role ? 0 : a.role === 'OWNER' ? -1 : 1)),
)

function resetForm() {
  email.value = ''
  role.value = 'COACH'
  teamIds.value = []
  categories.value = []
  errorMessage.value = null
  showForm.value = false
}

const canSubmit = computed(() => {
  if (!email.value.trim()) return false
  if (needsCategories.value) return categories.value.length > 0
  if (needsTeams.value) return teamIds.value.length > 0
  return true
})

async function handleInvite() {
  if (!canSubmit.value || !clubsStore.club) return
  errorMessage.value = null
  saving.value = true
  try {
    await membersStore.inviteMember(clubsStore.club.id, {
      email: email.value,
      role: role.value,
      teamIds: teamIds.value,
      categories: categories.value,
    })
    resetForm()
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de l\'invitation.')
  } finally {
    saving.value = false
  }
}

async function handleRemove(id: string) {
  if (!confirm('Retirer ce membre du club ?')) return
  await membersStore.removeMember(id)
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
      <h1 class="text-sm font-semibold text-white">Membres de {{ clubsStore.club?.name ?? 'votre club' }}</h1>
    </div>

    <div class="px-4 pt-5 max-w-2xl mx-auto">

      <p v-if="errorMessage && !clubsStore.isOwner" class="text-sm text-neutral-400 bg-white/5 border border-white/10 rounded-lg px-3 py-3">
        {{ errorMessage }}
      </p>

      <template v-else>
        <!-- Bouton d'invitation -->
        <button
          class="w-full h-11 mb-6 rounded-xl border border-dashed border-white/15 text-neutral-400 text-sm font-medium
                 hover:border-white/30 hover:text-white transition-all flex items-center justify-center gap-2"
          @click="showForm = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Inviter un membre
        </button>

        <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          Membres ({{ membersStore.members.length }})
        </h2>

        <div v-if="membersStore.loading" class="flex items-center justify-center py-10">
          <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>

        <div v-else class="space-y-1.5">
          <div
            v-for="member in sortedMembers"
            :key="member.id"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white font-medium truncate">
                {{ member.invitedEmail ?? 'Vous' }}
              </p>
              <p class="text-xs text-neutral-500">
                {{ roleLabel(member.role) }} ·
                {{ accessSummary(member) }}
                <span v-if="member.status === 'PENDING'" class="text-amber-400">· Invitation en attente</span>
              </p>
            </div>
            <button
              v-if="member.role !== 'OWNER'"
              class="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors"
              @click="handleRemove(member.id)"
            >
              Retirer
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Popup invitation -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="resetForm"
    >
      <div class="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-white">Inviter un membre</h2>
          <button class="text-neutral-500 hover:text-white transition-colors p-1" @click="resetForm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleInvite">
          <div class="space-y-1">
            <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Email</label>
            <input
              v-model="email"
              type="email"
              required
              placeholder="coach@exemple.com"
              class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                     text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
            <p class="text-xs text-neutral-600">
              Dès que cette personne se connecte avec cette adresse (compte existant ou nouveau), elle rejoint automatiquement l'équipe choisie.
            </p>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Rôle</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="opt in roleOptions"
                :key="opt.value"
                type="button"
                class="h-11 rounded-lg border text-sm font-medium transition-all px-2"
                :class="role === opt.value
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-white/10 text-neutral-400 hover:border-white/20 hover:text-white'"
                @click="role = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
            <p class="text-xs text-neutral-600">
              {{ roleOptions.find((r) => r.value === role)?.hint }}
            </p>
          </div>
          <div v-if="needsTeams" class="space-y-1">
            <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Équipes</label>
            <p class="text-xs text-neutral-600 mb-1">
              Un membre peut avoir accès à plusieurs équipes (ex. coach d'une équipe et responsable d'une autre).
            </p>
            <div class="space-y-1.5">
              <label
                v-for="t in teamsStore.teams"
                :key="t.id"
                class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :checked="teamIds.includes(t.id)"
                  class="accent-white"
                  @change="toggleTeam(t.id)"
                />
                <span class="text-sm text-white">{{ t.name }}</span>
              </label>
            </div>
            <p v-if="teamsStore.teams.length === 0" class="text-xs text-neutral-600">
              Aucune équipe créée pour le moment —
              <button type="button" class="underline hover:text-white" @click="router.push({ name: 'club', query: { tab: 'teams' } })">en créer une</button>
            </p>
          </div>
          <div v-if="needsCategories" class="space-y-1">
            <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Catégories</label>
            <p class="text-xs text-neutral-600 mb-1">
              Accès automatique à toute équipe (actuelle ou future) partageant une de ces catégories.
            </p>
            <div class="space-y-1.5">
              <label
                v-for="c in availableCategories"
                :key="c"
                class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :checked="categories.includes(c)"
                  class="accent-white"
                  @change="toggleCategory(c)"
                />
                <span class="text-sm text-white">{{ c }}</span>
              </label>
            </div>
            <p v-if="availableCategories.length === 0" class="text-xs text-neutral-600">
              Aucune équipe n'a de catégorie renseignée pour le moment —
              <button type="button" class="underline hover:text-white" @click="router.push({ name: 'club', query: { tab: 'teams' } })">en configurer une</button>
            </p>
          </div>
          <p v-if="role === 'PRESIDENT'" class="text-xs text-neutral-600">
            Le président a accès en lecture à tout le club, aucune équipe à sélectionner.
          </p>

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
              :disabled="saving || !canSubmit"
              class="flex-1 h-11 rounded-lg bg-white text-neutral-900 text-sm font-semibold
                     hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span v-if="saving">Envoi...</span>
              <span v-else>Inviter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
