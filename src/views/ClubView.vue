<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { useClubMembersStore } from '@/stores/clubMembers.store'
import AppHeader from '@/components/AppHeader.vue'
import ClubCrest from '@/components/ClubCrest.vue'
import TeamsSection from '@/components/club/TeamsSection.vue'
import RosterSection from '@/components/club/RosterSection.vue'
import MembersSection from '@/components/club/MembersSection.vue'

type Tab = 'roster' | 'members' | 'teams'

const router = useRouter()
const route = useRoute()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()
const membersStore = useClubMembersStore()

const validTab = (value: unknown): value is Tab => value === 'teams' || value === 'roster' || value === 'members'
const activeTab = ref<Tab>(validTab(route.query.tab) ? route.query.tab : 'roster')

onMounted(async () => {
  const club = await clubsStore.ensureClub().catch(() => null)
  await Promise.all([
    club ? teamsStore.fetchTeams(club.id) : Promise.resolve(),
    club ? membersStore.fetchMembers(club.id) : Promise.resolve(),
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
  { id: 'members' as const, label: 'Membres', count: membersStore.members.length },
  { id: 'teams' as const, label: 'Équipes', count: teamsStore.teams.length },
])
</script>

<template>
  <div class="min-h-screen bg-app flex flex-col text-ink">

    <AppHeader back />

    <div class="flex-none px-4 pt-3.5">
      <div class="flex items-center gap-2">
        <ClubCrest :logo-url="clubsStore.club?.logoUrl" :name="clubsStore.club?.name" size="sm" />
        <h1 class="text-[20px] font-semibold text-ink">{{ clubsStore.club?.name ?? 'Ton club' }}</h1>
      </div>
      <p class="mt-1 text-[11px] text-ink-meta">
        {{ teamsStore.teams.length }} équipe{{ teamsStore.teams.length > 1 ? 's' : '' }} · {{ activePlayerCount }} joueur{{ activePlayerCount > 1 ? 's' : '' }}
      </p>

      <!-- Onglets -->
      <div class="flex gap-5 mt-3.5 border-b border-line overflow-x-auto [scrollbar-width:none]">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="flex-none flex items-center gap-1.5 h-[38px] text-sm font-semibold transition-colors whitespace-nowrap"
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
      <MembersSection v-else-if="activeTab === 'members'" />
      <TeamsSection v-else />
    </main>
  </div>
</template>
