<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, ChevronRight, Users, Shield, LogOut, Settings } from 'lucide-vue-next'
import { useMatchStore } from '@/stores/match.store'
import { useAuthStore } from '@/stores/auth.store'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { useAdminClubsStore } from '@/stores/adminClubs.store'
import { deriveDisplayName, deriveInitials } from '@/lib/displayName'
import { ROLE_BADGES } from '@/lib/roleBadge'
import { OUTCOME_BADGES, outcomeFor } from '@/lib/matchBadges'
import NrvLogo from '@/components/NrvLogo.vue'
import RoleBadge from '@/components/RoleBadge.vue'
import ClubCrest from '@/components/ClubCrest.vue'
import CreateMatchModal from '@/components/tracker/CreateMatchModal.vue'
import type { Match } from '@/types/match.types'

const router = useRouter()
const matchStore = useMatchStore()
const authStore = useAuthStore()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()
const adminStore = useAdminClubsStore()

const showCreateModal = ref(false)
const showMenu = ref(false)
const loading = ref(true)

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub().catch(() => null)
    await Promise.all([
      matchStore.fetchMatches(),
      playersStore.fetchPlayers(),
      club ? teamsStore.fetchTeams(club.id) : Promise.resolve(),
    ])
    adminStore.checkAdmin().catch(() => {})
  } finally {
    loading.value = false
  }
})

function teamName(id: string | null): string {
  if (!id) return 'Sans équipe'
  return teamsStore.teams.find((t) => t.id === id)?.name ?? 'Équipe inconnue'
}

// homeTeam/awayTeam sont deux libellés texte libre (pas de notion d'"adversaire"
// dans le modèle, cf. CLAUDE.md) — on affiche donc les deux plutôt que d'inventer
// lequel des deux représente le club.
function matchLabel(m: Match): string {
  return `${m.homeTeam} vs ${m.awayTeam}`
}

function formatDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric' })
}
function formatMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { month: 'short' })
}

async function handleSignOut() {
  showMenu.value = false
  await authStore.signOut()
  router.push({ name: 'auth' })
}

function openReport(id: string) {
  router.push({ name: 'report', params: { id } })
}

// Prochains matchs : à venir ou en cours, triés du plus proche au plus loin
const upcomingMatches = computed(() =>
  [...matchStore.matches]
    .filter((m) => m.status === 'PENDING' || m.status === 'LIVE')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5),
)

// Le match le plus proche se lance directement, les suivants passent par la compo
function matchCta(match: Match, index: number): { label: string; to: 'tracker' | 'lineup' } {
  if (match.status === 'LIVE') return { label: 'Reprendre', to: 'tracker' }
  if (index === 0) return { label: 'Lancer le tracker', to: 'tracker' }
  return { label: 'Préparer la compo', to: 'lineup' }
}

function openUpcoming(match: Match, index: number) {
  const { to } = matchCta(match, index)
  router.push({ name: to, params: { id: match.id } })
}

// Derniers résultats : matchs terminés, du plus récent au plus ancien
const recentResults = computed(() =>
  [...matchStore.matches]
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3),
)

const resultsRecord = computed(() => {
  const counts: Record<'V' | 'N' | 'D', number> = { V: 0, N: 0, D: 0 }
  for (const m of recentResults.value) counts[outcomeFor(m.scoreHome, m.scoreAway)]++
  return (['V', 'N', 'D'] as const).filter((k) => counts[k] > 0).map((k) => `${counts[k]}${k}`).join(' ')
})

const activePlayers = computed(() => playersStore.players.filter((p) => p.active))
const activePlayerCount = computed(() => activePlayers.value.length)

// Palette décorative cyclique pour la pile d'avatars (les joueurs n'ont pas de
// "rôle" comme les membres — juste un poste texte libre, pas de quoi en tirer une couleur).
const AVATAR_PALETTE = [
  { bg: '#451a03', border: '#78716c', fg: '#FBBF24' },
  { bg: '#172554', border: '#1e40af', fg: '#60A5FA' },
  { bg: '#052e16', border: '#166534', fg: '#4ADE80' },
  { bg: '#450a0a', border: '#7f1d1d', fg: '#F87171' },
]
const STACK_SIZE = 4
const avatarStack = computed(() =>
  activePlayers.value.slice(0, STACK_SIZE).map((p, i) => ({
    initials: deriveInitials(p.name.replace(/\s+/, '.')),
    ...AVATAR_PALETTE[i % AVATAR_PALETTE.length],
  })),
)
const avatarOverflow = computed(() => Math.max(0, activePlayerCount.value - STACK_SIZE))

function teamRosterCount(teamId: string): number {
  return activePlayers.value.filter((p) => p.teamId === teamId).length
}

const membershipBadge = computed(() =>
  clubsStore.membership ? ROLE_BADGES[clubsStore.membership.role] : null,
)

const clubMeta = computed(() => {
  const club = clubsStore.club
  if (!club) return ''
  const parts: string[] = []
  if (club.foundedYear) parts.push(`fondé en ${club.foundedYear}`)
  if (club.location) parts.push(club.location)
  return parts.join(' · ')
})
</script>

<template>
  <div class="min-h-screen bg-app flex flex-col text-ink">

    <!-- Barre du haut -->
    <header class="flex-none flex items-center justify-between gap-2.5 px-4 py-3 border-b border-line">
      <NrvLogo :width="66" />
      <div class="relative">
        <button class="flex items-center gap-2" @click="showMenu = !showMenu">
          <span class="text-[11px] text-ink-meta">{{ deriveDisplayName(authStore.user?.email) }}</span>
          <span
            v-if="membershipBadge"
            class="flex items-center justify-center w-[30px] h-[30px] rounded-full font-data text-[11px] font-bold border"
            :style="{ background: membershipBadge.bg, borderColor: membershipBadge.border, color: membershipBadge.fg }"
          >
            {{ deriveInitials(authStore.user?.email) }}
          </span>
        </button>

        <div
          v-if="showMenu"
          class="absolute right-0 top-[38px] z-50 min-w-[168px] py-1 bg-surface border border-line rounded-card"
          @click.self="showMenu = false"
        >
          <button
            class="w-full h-11 px-3 flex items-center gap-2.5 text-sm text-ink-body hover:bg-surface-hover transition-colors text-left"
            @click="showMenu = false; router.push({ name: 'club', query: { tab: 'members' } })"
          >
            <Users :size="16" :stroke-width="2" class="text-ink-meta" /> Membres
          </button>
          <button
            v-if="clubsStore.isOwner"
            class="w-full h-11 px-3 flex items-center gap-2.5 text-sm text-ink-body hover:bg-surface-hover transition-colors text-left"
            @click="showMenu = false; router.push({ name: 'club-settings' })"
          >
            <Settings :size="16" :stroke-width="2" class="text-ink-meta" /> Réglages du club
          </button>
          <button
            v-if="adminStore.isAdmin"
            class="w-full h-11 px-3 flex items-center gap-2.5 text-sm text-ink-body hover:bg-surface-hover transition-colors text-left"
            @click="showMenu = false; router.push({ name: 'admin-clubs' })"
          >
            <Shield :size="16" :stroke-width="2" class="text-ink-meta" /> Administration
          </button>
          <button
            class="w-full h-11 px-3 flex items-center gap-2.5 text-sm text-danger hover:bg-surface-hover transition-colors text-left"
            @click="handleSignOut"
          >
            <LogOut :size="16" :stroke-width="2" /> Déconnexion
          </button>
        </div>
      </div>
    </header>

    <!-- Chargement -->
    <div v-if="loading" class="flex-1 flex flex-col gap-2.5 px-4 pt-3.5 pb-[18px]">
      <div v-for="i in 4" :key="i" class="rounded-card bg-surface animate-pulse" :class="i === 2 ? 'h-32' : 'h-20'" />
    </div>

    <!-- Contenu -->
    <main v-else class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 px-4 pt-3.5 pb-[18px]">

      <!-- Identité club -->
      <div class="flex-shrink-0 flex items-center gap-3.5 p-4 bg-surface border border-line rounded-card">
        <ClubCrest :logo-url="clubsStore.club?.logoUrl" :name="clubsStore.club?.name" />
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Ton club</p>
          <h1 class="mt-[5px] text-[18px] font-semibold text-ink truncate">{{ clubsStore.club?.name ?? 'Ton club' }}</h1>
          <p v-if="clubMeta" class="mt-[5px] text-[11px] text-ink-meta truncate">{{ clubMeta }}</p>
          <div v-if="membershipBadge" class="mt-[9px]">
            <RoleBadge :role="clubsStore.membership!.role" />
          </div>
        </div>
      </div>

      <!-- Prochains matchs -->
      <div class="flex-shrink-0 p-3.5 bg-surface border border-line rounded-card">
        <div class="flex items-baseline justify-between mb-3">
          <span class="text-[13px] font-medium text-ink-secondary">Prochains matchs</span>
          <span class="font-data text-[11px] text-ink-disabled">{{ upcomingMatches.length }}</span>
        </div>

        <p v-if="upcomingMatches.length === 0" class="text-sm text-ink-meta text-center py-4">
          Aucun match — crée le premier
        </p>

        <div v-else class="flex flex-col gap-2">
          <div
            v-for="(match, index) in upcomingMatches"
            :key="match.id"
            class="flex flex-col gap-2 p-[11px] rounded-[10px] bg-surface-sub border"
            :class="match.status === 'LIVE' ? 'border-brand-line' : 'border-line'"
          >
            <div class="flex items-center gap-2.5">
              <div class="flex-none w-9 text-center">
                <div class="font-score text-sm font-bold text-ink">{{ formatDay(match.date) }}</div>
                <div class="text-[9px] font-medium tracking-[.5px] text-ink-meta">{{ formatMonth(match.date) }}</div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-medium text-ink truncate">{{ matchLabel(match) }}</p>
                <div class="flex items-center gap-1.5 mt-[3px] min-w-0">
                  <span
                    v-if="match.status === 'LIVE'"
                    class="inline-flex items-center gap-[5px] font-medium text-[9.5px] tracking-[.3px] px-[7px] py-[3px] rounded-full bg-brand-soft border border-brand-line text-brand-ink shrink-0"
                  >
                    <span class="w-[5px] h-[5px] rounded-full bg-[#22C55E] animate-nrv-pulse" />
                    En cours
                  </span>
                  <span class="text-[10.5px] text-ink-meta truncate">
                    {{ teamName(match.teamId) }}<span v-if="match.competition"> · {{ match.competition }}</span>
                  </span>
                </div>
              </div>
            </div>
            <button
              class="h-11 rounded-btn text-[12.5px] font-semibold border"
              :class="index === 0
                ? 'bg-brand border-brand-line text-brand-soft hover:bg-brand-hover'
                : 'bg-surface border-line-strong text-ink hover:bg-surface-hover'"
              @click="openUpcoming(match, index)"
            >
              {{ matchCta(match, index).label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Effectif + Équipes -->
      <div class="flex-shrink-0 grid grid-cols-2 gap-2.5">
        <button
          class="flex flex-col min-w-0 p-3.5 bg-surface border border-line rounded-card text-left hover:bg-surface-hover hover:border-line-strong transition-colors"
          @click="router.push({ name: 'club', query: { tab: 'roster' } })"
        >
          <span class="text-[13px] font-medium text-ink-secondary">Effectif</span>
          <div class="mt-2.5 font-score text-[26px] font-bold text-ink">{{ activePlayerCount }}</div>
          <div class="mt-[3px] text-[11px] text-ink-meta">joueur{{ activePlayerCount > 1 ? 's' : '' }} actif{{ activePlayerCount > 1 ? 's' : '' }}</div>
          <div v-if="activePlayerCount > 0" class="flex mt-3">
            <span
              v-for="(a, i) in avatarStack"
              :key="i"
              class="flex items-center justify-center w-[26px] h-[26px] rounded-full font-data text-[9px] font-bold border box-border"
              :class="i > 0 ? '-ml-[7px]' : ''"
              :style="{ background: a.bg, borderColor: a.border, color: a.fg }"
            >
              {{ a.initials }}
            </span>
            <span
              v-if="avatarOverflow > 0"
              class="flex items-center justify-center w-[26px] h-[26px] rounded-full -ml-[7px] font-data text-[8px] font-bold border box-border bg-surface-sub border-line text-ink-secondary"
            >
              +{{ avatarOverflow }}
            </span>
          </div>
        </button>

        <button
          class="flex flex-col min-w-0 p-3.5 bg-surface border border-line rounded-card text-left"
          @click="router.push({ name: 'club', query: { tab: 'teams' } })"
        >
          <span class="text-[13px] font-medium text-ink-secondary">Équipes</span>
          <p v-if="teamsStore.teams.length === 0" class="mt-2.5 text-xs text-ink-meta">Aucune équipe</p>
          <div v-else class="flex flex-col gap-[7px] mt-[11px]">
            <div
              v-for="t in teamsStore.teams"
              :key="t.id"
              class="flex items-center justify-between gap-2 min-w-0"
              @click.stop="router.push({ name: 'team-stats', params: { id: t.id } })"
            >
              <div class="min-w-0">
                <div class="text-xs font-semibold text-ink truncate">{{ t.name }}</div>
                <div v-if="t.category" class="mt-0.5 text-[10px] text-ink-meta truncate">{{ t.category }}</div>
              </div>
              <span class="flex-none font-data text-[10px] text-ink-disabled">{{ teamRosterCount(t.id) }}</span>
            </div>
          </div>
        </button>
      </div>

      <!-- Derniers résultats -->
      <div v-if="recentResults.length > 0" class="flex-shrink-0 p-3.5 bg-surface border border-line rounded-card">
        <div class="flex items-baseline justify-between mb-1">
          <span class="text-[13px] font-medium text-ink-secondary">Derniers résultats</span>
          <span class="font-data text-[11px] text-ink-disabled">{{ resultsRecord }}</span>
        </div>
        <button
          v-for="(match, index) in recentResults"
          :key="match.id"
          class="w-full flex items-center gap-2.5 py-[11px] text-left"
          :class="index < recentResults.length - 1 ? 'border-b border-[rgba(55,65,81,.6)]' : ''"
          @click="openReport(match.id)"
        >
          <span
            class="flex items-center justify-center flex-none w-6 h-6 rounded-tag font-data text-[11px] font-bold border"
            :style="{
              background: OUTCOME_BADGES[outcomeFor(match.scoreHome, match.scoreAway)].bg,
              borderColor: OUTCOME_BADGES[outcomeFor(match.scoreHome, match.scoreAway)].border,
              color: OUTCOME_BADGES[outcomeFor(match.scoreHome, match.scoreAway)].fg,
            }"
          >
            {{ outcomeFor(match.scoreHome, match.scoreAway) }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-[12.5px] font-medium text-ink truncate">{{ matchLabel(match) }}</p>
            <p class="mt-0.5 text-[10px] text-ink-meta truncate">{{ teamName(match.teamId) }} · {{ formatDay(match.date) }} {{ formatMonth(match.date) }}</p>
          </div>
          <span class="font-score text-sm font-bold text-ink">{{ match.scoreHome }} – {{ match.scoreAway }}</span>
          <ChevronRight :size="14" :stroke-width="2" class="flex-none text-ink-disabled" />
        </button>
      </div>

      <!-- CTA -->
      <button
        v-if="clubsStore.canWrite"
        class="flex-shrink-0 flex items-center justify-center gap-[7px] w-full h-12 rounded-btn border border-brand-line bg-brand text-brand-soft font-semibold text-sm hover:bg-brand-hover transition-colors"
        @click="showCreateModal = true"
      >
        <Plus :size="16" :stroke-width="2.5" />
        Créer un match
      </button>
    </main>

    <!-- Modal création match -->
    <CreateMatchModal v-if="showCreateModal" @close="showCreateModal = false" />
  </div>
</template>
