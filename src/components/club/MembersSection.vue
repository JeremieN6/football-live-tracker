<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import { useClubsStore, type MemberRole } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { useClubMembersStore, type ClubMember } from '@/stores/clubMembers.store'
import { deriveDisplayName, deriveInitials } from '@/lib/displayName'
import { ROLE_BADGES } from '@/lib/roleBadge'
import RoleBadge from '@/components/RoleBadge.vue'
import { extractErrorMessage } from '@/lib/errors'

const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()
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

const showForm = ref(false)
const email = ref('')
const role = ref<InvitableRole>('COACH')
const teamIds = ref<string[]>([])
const categories = ref<string[]>([])
const saving = ref(false)
const errorMessage = ref<string | null>(null)
const activeFilter = ref<'ALL' | 'PLAYER' | 'STAFF' | 'DIRECTION' | 'OTHER' | 'PENDING'>('ALL')

const needsTeams = computed(() => role.value !== 'PRESIDENT' && role.value !== 'CATEGORY_MANAGER')
const needsCategories = computed(() => role.value === 'CATEGORY_MANAGER')
const singleTeamRole = computed(() => role.value === 'PLAYER' || role.value === 'OTHER')

const availableCategories = computed(() => {
  const set = new Set<string>()
  for (const t of teamsStore.teams) if (t.category) set.add(t.category)
  return [...set].sort()
})

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub()
    await Promise.all([teamsStore.fetchTeams(club.id), playersStore.fetchPlayers(), membersStore.fetchMembers(club.id)])
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement du club.')
  }
})

function toggleCategory(category: string) {
  const index = categories.value.indexOf(category)
  if (index === -1) categories.value.push(category)
  else categories.value.splice(index, 1)
}

function toggleTeam(id: string) {
  const index = teamIds.value.indexOf(id)
  if (singleTeamRole.value) {
    teamIds.value = index === -1 ? [id] : []
    return
  }
  if (index === -1) teamIds.value.push(id)
  else teamIds.value.splice(index, 1)
}

// Fiche joueur (players) liée à ce membre, s'il y en a une — donne un vrai
// numéro de maillot / poste en plus du rôle d'adhésion (cf. players.member_id).
function playerFor(memberId: string) {
  return playersStore.players.find((p) => p.memberId === memberId)
}

function displayName(member: ClubMember): string {
  const player = playerFor(member.id)
  if (player) return player.name
  if (member.invitedEmail) return deriveDisplayName(member.invitedEmail)
  return 'Vous'
}

function initialsFor(member: ClubMember): string {
  const player = playerFor(member.id)
  if (player) return deriveInitials(player.name.replace(/\s+/, '.'))
  return deriveInitials(member.invitedEmail)
}

const FILTERS: { id: typeof activeFilter.value; label: string }[] = [
  { id: 'ALL', label: 'Tous' },
  { id: 'PLAYER', label: 'Joueurs' },
  { id: 'STAFF', label: 'Encadrement' },
  { id: 'DIRECTION', label: 'Direction' },
  { id: 'OTHER', label: 'Autres' },
  { id: 'PENDING', label: 'En attente' },
]

function matchesFilter(member: ClubMember): boolean {
  switch (activeFilter.value) {
    case 'ALL': return true
    case 'PLAYER': return member.role === 'PLAYER'
    case 'STAFF': return member.role === 'COACH' || member.role === 'ADJOINT'
    case 'DIRECTION': return member.role === 'OWNER' || member.role === 'PRESIDENT' || member.role === 'CATEGORY_MANAGER'
    case 'OTHER': return member.role === 'OTHER'
    case 'PENDING': return member.status === 'PENDING'
  }
}

const visibleMembers = computed(() =>
  [...membersStore.members].filter(matchesFilter).sort((a, b) => (a.role === b.role ? 0 : a.role === 'OWNER' ? -1 : 1)),
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
</script>

<template>
  <div>
    <!-- Filtres par rôle -->
    <div class="flex items-center gap-1.5 mb-3 overflow-x-auto pb-0.5 [scrollbar-width:none]">
      <button
        v-for="f in FILTERS"
        :key="f.id"
        class="flex-none h-8 px-2.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors"
        :class="activeFilter === f.id ? 'bg-brand-soft border-brand-line text-brand-ink' : 'bg-surface border-line text-ink-secondary'"
        @click="activeFilter = f.id"
      >
        {{ f.label }}
      </button>
    </div>

    <div v-if="membersStore.loading" class="flex items-center justify-center py-10">
      <div class="w-6 h-6 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
    </div>

    <p v-else-if="visibleMembers.length === 0" class="text-sm text-ink-meta text-center py-8">
      Aucun membre avec ce rôle — invite le premier
    </p>

    <div v-else class="grid grid-cols-2 gap-2">
      <div
        v-for="member in visibleMembers"
        :key="member.id"
        class="min-w-0 flex flex-col gap-2 p-3 bg-surface border border-line rounded-card"
      >
        <div class="flex items-center justify-between gap-1.5">
          <span
            class="flex items-center justify-center w-[38px] h-[38px] rounded-full font-data text-xs font-bold border"
            :style="{ background: ROLE_BADGES[member.role].bg, borderColor: ROLE_BADGES[member.role].border, color: ROLE_BADGES[member.role].fg }"
          >
            {{ initialsFor(member) }}
          </span>
          <span v-if="playerFor(member.id)?.number != null" class="font-score text-xs font-bold text-ink-disabled">
            {{ playerFor(member.id)!.number }}
          </span>
        </div>
        <div class="min-w-0">
          <p class="text-[13px] font-medium text-ink truncate">{{ displayName(member) }}</p>
          <p v-if="playerFor(member.id)?.position" class="mt-0.5 text-[11px] text-ink-meta truncate">{{ playerFor(member.id)!.position }}</p>
        </div>
        <RoleBadge :role="member.role" :pending="member.status === 'PENDING'" />
      </div>
    </div>

    <button
      v-if="clubsStore.isOwner"
      class="flex items-center justify-center gap-1.5 w-full h-11 mt-3 rounded-btn border border-dashed border-line-strong text-ink-secondary text-[13px] font-medium hover:text-ink hover:bg-surface hover:border-ink-meta transition-colors"
      @click="showForm = true"
    >
      <Plus :size="15" :stroke-width="2" />
      Inviter un membre
    </button>

    <!-- Popup invitation -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="resetForm"
    >
      <div class="w-full max-w-md bg-surface border border-line rounded-card p-6 max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-ink">Inviter un membre</h2>
          <button class="text-ink-meta hover:text-ink transition-colors p-1" @click="resetForm">
            <X :size="18" :stroke-width="2" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleInvite">
          <div class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Email</label>
            <input
              v-model="email"
              type="email"
              required
              placeholder="coach@exemple.com"
              class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                     text-sm outline-none focus:border-brand transition-colors"
            />
            <p class="text-xs text-ink-meta">
              Dès que cette personne se connecte avec cette adresse, elle rejoint automatiquement le rôle et les équipes choisis.
            </p>
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Rôle</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="opt in roleOptions"
                :key="opt.value"
                type="button"
                class="h-11 rounded-btn border text-sm font-medium transition-colors px-2"
                :class="role === opt.value ? 'border-brand-line bg-brand-soft text-brand-ink' : 'border-line text-ink-secondary hover:border-line-strong hover:text-ink'"
                @click="role = opt.value; if ((opt.value === 'PLAYER' || opt.value === 'OTHER') && teamIds.length > 1) teamIds = [teamIds[0]]"
              >
                {{ opt.label }}
              </button>
            </div>
            <p class="text-xs text-ink-meta">{{ roleOptions.find((r) => r.value === role)?.hint }}</p>
          </div>
          <div v-if="needsTeams" class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Équipes</label>
            <p class="text-xs text-ink-meta mb-1">
              {{ singleTeamRole
                ? 'Un joueur (ou un membre "Autre") n\'appartient qu\'à une seule équipe à la fois.'
                : 'Un membre peut avoir accès à plusieurs équipes (ex. coach d\'une équipe et responsable d\'une autre).' }}
            </p>
            <div class="space-y-1.5">
              <label
                v-for="t in teamsStore.teams"
                :key="t.id"
                class="flex items-center gap-2 px-3 py-2 rounded-input bg-surface-sub border border-line transition-opacity"
                :class="singleTeamRole && teamIds.length > 0 && !teamIds.includes(t.id) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'"
              >
                <input
                  type="checkbox"
                  :checked="teamIds.includes(t.id)"
                  :disabled="singleTeamRole && teamIds.length > 0 && !teamIds.includes(t.id)"
                  class="accent-[#16A34A]"
                  @change="toggleTeam(t.id)"
                />
                <span class="text-sm text-ink">{{ t.name }}</span>
              </label>
            </div>
          </div>
          <div v-if="needsCategories" class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Catégories</label>
            <p class="text-xs text-ink-meta mb-1">Accès automatique à toute équipe (actuelle ou future) partageant une de ces catégories.</p>
            <div class="space-y-1.5">
              <label
                v-for="c in availableCategories"
                :key="c"
                class="flex items-center gap-2 px-3 py-2 rounded-input bg-surface-sub border border-line cursor-pointer"
              >
                <input type="checkbox" :checked="categories.includes(c)" class="accent-[#16A34A]" @change="toggleCategory(c)" />
                <span class="text-sm text-ink">{{ c }}</span>
              </label>
            </div>
          </div>
          <p v-if="role === 'PRESIDENT'" class="text-xs text-ink-meta">
            Le président a accès en lecture à tout le club, aucune équipe à sélectionner.
          </p>

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
              :disabled="saving || !canSubmit"
              class="flex-1 h-11 rounded-btn bg-brand text-brand-soft text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="saving">Envoi…</span>
              <span v-else>Inviter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
