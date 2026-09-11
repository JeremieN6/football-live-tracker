<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useClubsStore } from '@/stores/clubs.store'
import TeamsSection from '@/components/club/TeamsSection.vue'
import RosterSection from '@/components/club/RosterSection.vue'

type Tab = 'teams' | 'roster'

const router = useRouter()
const route = useRoute()
const clubsStore = useClubsStore()

const validTab = (value: unknown): value is Tab => value === 'teams' || value === 'roster'
const activeTab = ref<Tab>(validTab(route.query.tab) ? route.query.tab : 'roster')

onMounted(() => {
  clubsStore.ensureClub().catch(() => {})
})

function setTab(tab: Tab) {
  activeTab.value = tab
  router.replace({ query: { ...route.query, tab } })
}

const tabs = computed(() => [
  { id: 'roster' as const, label: 'Effectif' },
  { id: 'teams' as const, label: 'Équipes' },
])
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
      <h1 class="text-sm font-semibold text-white">{{ clubsStore.club?.name ?? 'Mon club' }}</h1>
    </div>

    <div class="px-4 pt-5 max-w-2xl mx-auto">

      <!-- Onglets -->
      <div class="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 border border-white/8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="flex-1 h-9 rounded-lg text-sm font-medium transition-all"
          :class="activeTab === tab.id
            ? 'bg-white text-neutral-900'
            : 'text-neutral-400 hover:text-white'"
          @click="setTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>

      <RosterSection v-if="activeTab === 'roster'" @go-teams="setTab('teams')" />
      <TeamsSection v-else />
    </div>
  </div>
</template>
