<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMatchStore } from '@/stores/match.store'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { MATCH_STATUS_BADGES, outcomeFor, displayScore } from '@/lib/matchBadges'
import { Trash2 } from 'lucide-vue-next'
import { extractErrorMessage } from '@/lib/errors'
import AppHeader from '@/components/AppHeader.vue'
import CreateMatchModal from '@/components/tracker/CreateMatchModal.vue'
import type { Match } from '@/types/match.types'

const router = useRouter()
const matchStore = useMatchStore()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()

const showCreateModal = ref(false)
const editingMatch = ref<Match | null>(null)
const activeTeam = ref<string>('ALL')
const openId = ref<string | null>(null)
const confirmDeleteId = ref<string | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

onMounted(async () => {
  matchStore.fetchMatches()
  const club = await clubsStore.ensureClub().catch(() => null)
  if (club) await teamsStore.fetchTeams(club.id)
})

function matchLabel(m: Match): string {
  return `${m.homeTeam} vs ${m.awayTeam}`
}
function day(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric' })
}
function month(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { month: 'short' })
}

const teamTabs = computed(() => {
  const all = { id: 'ALL', label: 'Toutes', count: matchStore.matches.length }
  const teams = teamsStore.teams.map((t) => ({
    id: t.id,
    label: t.name,
    count: matchStore.matches.filter((m) => m.teamId === t.id).length,
  }))
  return [all, ...teams]
})

const filteredMatches = computed(() =>
  [...matchStore.matches]
    .filter((m) => activeTeam.value === 'ALL' || m.teamId === activeTeam.value)
    .sort((a, b) => b.date.localeCompare(a.date)),
)

const isEmpty = computed(() => filteredMatches.value.length === 0)

const summary = computed(() => {
  const n = filteredMatches.value.length
  const activeLabel = teamTabs.value.find((t) => t.id === activeTeam.value)?.label
  const base = `${n} match${n > 1 ? 's' : ''}`
  return activeTeam.value === 'ALL' ? base : `${base} · ${activeLabel}`
})

const record = computed(() => {
  const done = filteredMatches.value.filter((m) => m.status === 'FINISHED')
  if (done.length === 0) return '—'
  const tally = { V: 0, N: 0, D: 0 }
  for (const m of done) tally[outcomeFor(m.scoreHome, m.scoreAway)]++
  return `${tally.V}V ${tally.N}N ${tally.D}D`
})

function toggleOpen(id: string) {
  openId.value = openId.value === id ? null : id
}

function scoreDisplay(m: Match): string {
  if (m.status === 'PENDING') return '—'
  const d = displayScore(m.scoreHome, m.scoreAway, m.isHome)
  return `${d.home} – ${d.away}`
}
function scoreColorClass(m: Match): string {
  if (m.status === 'FINISHED') return 'text-ink'
  if (m.status === 'LIVE') return 'text-brand-ink'
  return 'text-ink-meta'
}

// Miroir de la logique de CTA de HomeView : le match le plus proche se lance
// directement, les suivants passent par la préparation de compo.
function primaryLabel(m: Match): string {
  if (m.status === 'FINISHED') return 'Voir le rapport'
  if (m.status === 'LIVE') return 'Ouvrir le tracker'
  return 'Préparer la compo'
}
function primaryAction(m: Match) {
  if (m.status === 'FINISHED') router.push({ name: 'report', params: { id: m.id } })
  else if (m.status === 'LIVE') router.push({ name: 'tracker', params: { id: m.id } })
  else router.push({ name: 'lineup', params: { id: m.id } })
}
function openDetails(m: Match) {
  router.push({ name: 'report', params: { id: m.id } })
}

// Suppression d'un match reservee au OWNER (demande explicite de l'utilisateur,
// meme si can_write_team() autoriserait aussi COACH/ADJOINT/CATEGORY_MANAGER
// cote RLS -- l'UI reste volontairement plus restrictive qu'elle ne pourrait l'etre).
async function handleDelete(id: string) {
  deleteError.value = null
  deleting.value = true
  try {
    await matchStore.deleteMatch(id)
    confirmDeleteId.value = null
    openId.value = null
  } catch (err: unknown) {
    deleteError.value = extractErrorMessage(err, 'Erreur lors de la suppression du match.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-app flex flex-col text-ink">

    <AppHeader back />

    <div class="flex-none px-4 pt-3.5">
      <div class="flex items-center justify-between gap-2.5">
        <h1 class="text-[20px] font-semibold text-ink">Matchs</h1>
        <button
          v-if="clubsStore.canWrite"
          class="h-9 px-3 rounded-[9px] border border-brand-line bg-brand text-brand-soft font-semibold text-xs hover:bg-brand-hover transition-colors"
          @click="showCreateModal = true"
        >
          Nouveau match
        </button>
      </div>

      <!-- Tabs d'équipe -->
      <div class="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        <button
          v-for="t in teamTabs"
          :key="t.id"
          class="flex items-center gap-1.5 flex-none h-[34px] px-3 rounded-full text-xs font-medium whitespace-nowrap border transition-colors"
          :class="activeTeam === t.id ? 'bg-brand-soft border-brand-line text-brand-ink' : 'bg-surface border-line text-ink-secondary'"
          @click="activeTeam = t.id; openId = null"
        >
          {{ t.label }}
          <span class="font-data text-[10px]" :class="activeTeam === t.id ? 'text-brand-line' : 'text-ink-disabled'">{{ t.count }}</span>
        </button>
      </div>

      <div class="flex items-baseline justify-between mt-3 px-0.5 pb-2 border-b border-line">
        <span class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">{{ summary }}</span>
        <span class="font-data text-[11px] text-ink-meta">{{ record }}</span>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">

      <!-- Chargement -->
      <div v-if="matchStore.loading" class="p-4 space-y-2">
        <div v-for="i in 4" :key="i" class="h-14 rounded-card bg-surface animate-pulse" />
      </div>

      <!-- Erreur -->
      <p v-else-if="matchStore.error" class="m-4 text-sm text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2">
        {{ matchStore.error }}
      </p>

      <!-- État vide -->
      <div v-else-if="isEmpty" class="m-4 px-5 py-[26px] bg-surface border border-line rounded-card text-center">
        <p class="mb-3.5 text-sm text-ink-secondary leading-relaxed">Aucun match pour cette équipe — crée le premier</p>
        <button
          v-if="clubsStore.canWrite"
          class="h-11 px-4 rounded-btn border border-brand-line bg-brand-soft text-brand-ink text-[13px] font-medium hover:bg-[#0a3d1c] transition-colors"
          @click="showCreateModal = true"
        >
          Créer un match
        </button>
      </div>

      <!-- Liste -->
      <template v-else>
        <div
          v-for="(m, i) in filteredMatches"
          :key="m.id"
          class="border-b border-[rgba(55,65,81,.5)]"
          :class="openId === m.id ? 'bg-surface-hover' : (i % 2 ? 'bg-surface-sub' : 'bg-app')"
        >
          <div class="flex items-center gap-2.5 px-4 py-[11px] cursor-pointer" @click="toggleOpen(m.id)">
            <div class="flex-none w-[34px] text-center">
              <div class="font-score text-[13px] font-bold text-ink-body">{{ day(m.date) }}</div>
              <div class="text-[9px] font-medium tracking-[.5px] text-ink-meta">{{ month(m.date) }}</div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-medium text-ink truncate">{{ matchLabel(m) }}</p>
              <div class="flex items-center gap-1.5 mt-[3px] min-w-0">
                <span
                  class="inline-flex items-center gap-[5px] flex-none px-[7px] py-[3px] rounded-full text-[9.5px] font-medium tracking-[.3px] whitespace-nowrap border"
                  :style="{
                    background: MATCH_STATUS_BADGES[m.status].bg,
                    borderColor: MATCH_STATUS_BADGES[m.status].border,
                    color: MATCH_STATUS_BADGES[m.status].fg,
                  }"
                >
                  <span
                    class="w-[5px] h-[5px] rounded-full"
                    :class="m.status === 'LIVE' ? 'animate-nrv-pulse' : ''"
                    :style="{ background: MATCH_STATUS_BADGES[m.status].dot }"
                  />
                  {{ MATCH_STATUS_BADGES[m.status].label }}
                </span>
                <span v-if="m.competition" class="text-[10.5px] text-ink-meta truncate">{{ m.competition }}</span>
              </div>
            </div>
            <div class="flex-none text-right min-w-[42px]">
              <span class="font-score text-[15px] font-bold" :class="scoreColorClass(m)">{{ scoreDisplay(m) }}</span>
            </div>
          </div>

          <div v-if="openId === m.id" class="flex gap-1.5 px-4 pb-3">
            <button
              class="flex-1 h-10 rounded-[9px] text-xs font-medium"
              :class="m.status === 'FINISHED' ? 'bg-surface border border-line-strong text-ink' : 'bg-brand border border-brand-line text-brand-soft'"
              @click.stop="primaryAction(m)"
            >
              {{ primaryLabel(m) }}
            </button>
            <button
              class="flex-none h-10 px-3 rounded-[9px] border border-line text-ink-secondary text-xs font-medium hover:text-ink hover:bg-surface transition-colors"
              @click.stop="openDetails(m)"
            >
              Détails
            </button>
            <button
              v-if="clubsStore.canWrite"
              class="flex-none h-10 px-3 rounded-[9px] border border-line text-ink-secondary text-xs font-medium hover:text-ink hover:bg-surface transition-colors"
              @click.stop="editingMatch = m"
            >
              Modifier
            </button>
            <button
              v-if="clubsStore.isOwner"
              class="flex-none h-10 px-3 rounded-[9px] border border-line text-ink-secondary hover:text-danger hover:border-danger-line hover:bg-danger-soft transition-colors"
              @click.stop="confirmDeleteId = m.id"
            >
              <Trash2 :size="15" :stroke-width="2" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Erreur de suppression -->
    <p v-if="deleteError" class="flex-none mx-4 mb-2 text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2">
      {{ deleteError }}
    </p>

    <!-- Modal création match -->
    <CreateMatchModal v-if="showCreateModal" @close="showCreateModal = false" />
    <CreateMatchModal v-if="editingMatch" :edit-match="editingMatch" @close="editingMatch = null" />

    <!-- Confirmation de suppression -->
    <div
      v-if="confirmDeleteId"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="confirmDeleteId = null"
    >
      <div class="w-full max-w-sm bg-surface border border-line rounded-card p-6">
        <h2 class="text-base font-semibold text-ink mb-1">Supprimer ce match ?</h2>
        <p class="text-sm text-ink-secondary mb-5">
          Le match, sa composition, ses événements et son rapport seront définitivement supprimés. Cette action est irréversible.
        </p>
        <div class="flex gap-3">
          <button
            class="flex-1 h-11 rounded-btn border border-line text-ink-secondary text-sm font-medium hover:text-ink transition-colors"
            :disabled="deleting"
            @click="confirmDeleteId = null"
          >
            Annuler
          </button>
          <button
            class="flex-1 h-11 rounded-btn bg-danger text-white text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-50"
            :disabled="deleting"
            @click="handleDelete(confirmDeleteId)"
          >
            {{ deleting ? 'Suppression…' : 'Supprimer' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
