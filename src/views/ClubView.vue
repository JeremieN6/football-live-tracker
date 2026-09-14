<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import TeamsSection from '@/components/club/TeamsSection.vue'
import RosterSection from '@/components/club/RosterSection.vue'

type Tab = 'roster' | 'teams'

const router = useRouter()
const route = useRoute()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()

const validTab = (value: unknown): value is Tab => value === 'teams' || value === 'roster'
const activeTab = ref<Tab>(validTab(route.query.tab) ? route.query.tab : 'roster')

onMounted(async () => {
  const club = await clubsStore.ensureClub().catch(() => null)
  await Promise.all([
    club ? teamsStore.fetchTeams(club.id) : Promise.resolve(),
    playersStore.fetchPlayers(),
  ])
})

function setTab(tab: Tab) {
  activeTab.value = tab
  router.replace({ query: { ...route.query, tab } })
}

const activePlayerCount = computed(() => playersStore.players.filter((p) => p.active).length)

const tabs = computed(() => [
  { id: 'roster' as const, label: 'Effectif', count: activePlayerCount.value },
  { id: 'teams' as const, label: 'Équipes', count: teamsStore.teams.length },
])
</script>

<template>
  <div class="min-h-screen bg-app flex flex-col text-ink">

    <div class="flex-none px-4 pt-3.5">
      <h1 class="text-[20px] font-semibold text-ink">{{ clubsStore.club?.name ?? 'Ton club' }}</h1>
      <p class="mt-1 text-[11px] text-ink-meta">
        {{ teamsStore.teams.length }} équipe{{ teamsStore.teams.length > 1 ? 's' : '' }} · {{ activePlayerCount }} joueur{{ activePlayerCount > 1 ? 's' : '' }}
      </p>

      <!-- Onglets -->
      <div class="flex gap-5 mt-3.5 border-b border-line">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="flex items-center gap-1.5 h-[38px] text-sm font-semibold transition-colors"
          :class="activeTab === tab.id ? 'text-ink' : 'text-ink-meta'"
          :style="activeTab === tab.id ? { boxShadow: 'inset 0 -2px 0 #16A34A' } : {}"
          @click="setTab(tab.id)"
        >
          {{ tab.label }}
          <span class="font-data text-[10px]" :class="activeTab === tab.id ? 'text-brand-ink' : 'text-ink-disabled'">{{ tab.count }}</span>
        </button>
      </div>
    </div>

    <main class="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-6">
      <RosterSection v-if="activeTab === 'roster'" @go-teams="setTab('teams')" />
      <TeamsSection v-else />
    </main>
  </div>
</template>
