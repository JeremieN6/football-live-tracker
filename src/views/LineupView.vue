<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchStore } from '@/stores/match.store'
import { usePlayersStore } from '@/stores/players.store'
import { useLineupStore } from '@/stores/lineup.store'
import type { LineupRole } from '@/types/match.types'
import { extractErrorMessage } from '@/lib/errors'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const playersStore = usePlayersStore()
const lineupStore = useLineupStore()

const matchId = route.params.id as string

// playerId -> role sélectionné (absent = non convoqué)
const selection = ref<Map<string, LineupRole>>(new Map())
const saving = ref(false)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  await Promise.all([
    matchStore.fetchMatch(matchId),
    playersStore.fetchPlayers(),
    lineupStore.fetchLineup(matchId),
  ])
  for (const entry of lineupStore.entries) {
    selection.value.set(entry.playerId, entry.role)
  }
})

const activePlayers = computed(() => playersStore.players.filter((p) => p.active))
const startersCount = computed(() => [...selection.value.values()].filter((r) => r === 'STARTER').length)
const subsCount = computed(() => [...selection.value.values()].filter((r) => r === 'SUB').length)

function roleOf(playerId: string): LineupRole | null {
  return selection.value.get(playerId) ?? null
}

// Cycle : non sélectionné → titulaire → remplaçant → non sélectionné
function cycleRole(playerId: string) {
  const current = roleOf(playerId)
  const next = current === null ? 'STARTER' : current === 'STARTER' ? 'SUB' : null
  const map = new Map(selection.value)
  if (next === null) {
    map.delete(playerId)
  } else {
    map.set(playerId, next)
  }
  selection.value = map
}

async function handleSave() {
  errorMessage.value = null
  saving.value = true
  try {
    const payload = [...selection.value.entries()].map(([playerId, role]) => ({ playerId, role }))
    await lineupStore.saveLineup(matchId, payload)
    router.push({ name: 'tracker', params: { id: matchId } })
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de l\'enregistrement.')
  } finally {
    saving.value = false
  }
}

function handleSkip() {
  router.push({ name: 'tracker', params: { id: matchId } })
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white pb-28">

    <!-- Header -->
    <div class="sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-sm border-b border-white/5 px-4 py-3">
      <h1 class="text-sm font-semibold text-white">
        {{ matchStore.currentMatch?.homeTeam }} vs {{ matchStore.currentMatch?.awayTeam }}
      </h1>
      <p class="text-xs text-neutral-500">Sélection de l'effectif pour ce match</p>
    </div>

    <div class="px-4 pt-5 max-w-2xl mx-auto">

      <!-- Compteurs -->
      <div class="flex gap-2 mb-4">
        <span class="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
          {{ startersCount }} titulaire{{ startersCount > 1 ? 's' : '' }}
        </span>
        <span class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-neutral-400 text-xs font-medium">
          {{ subsCount }} remplaçant{{ subsCount > 1 ? 's' : '' }}
        </span>
      </div>

      <p class="text-xs text-neutral-600 mb-4">
        Touchez un joueur pour le passer titulaire, puis remplaçant, puis le désélectionner.
      </p>

      <div v-if="playersStore.loading" class="flex items-center justify-center py-10">
        <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>

      <!-- Aucun joueur dans l'effectif -->
      <div v-else-if="activePlayers.length === 0" class="text-center py-10">
        <p class="text-sm text-neutral-400 mb-4">Votre effectif de club est vide.</p>
        <button
          class="h-11 px-6 rounded-xl bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-100 transition-all"
          @click="router.push({ name: 'club', query: { tab: 'roster' } })"
        >
          Créer l'effectif
        </button>
      </div>

      <!-- Liste joueurs -->
      <div v-else class="space-y-1.5">
        <button
          v-for="player in activePlayers"
          :key="player.id"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all"
          :class="{
            'bg-green-500/10 border-green-500/30': roleOf(player.id) === 'STARTER',
            'bg-white/8 border-white/15': roleOf(player.id) === 'SUB',
            'bg-white/5 border-white/8': roleOf(player.id) === null,
          }"
          @click="cycleRole(player.id)"
        >
          <span class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
            {{ player.number ?? '—' }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white font-medium truncate">{{ player.name }}</p>
            <p v-if="player.position" class="text-xs text-neutral-500">{{ player.position }}</p>
          </div>
          <span
            v-if="roleOf(player.id)"
            class="text-xs font-semibold px-2 py-1 rounded-md shrink-0"
            :class="roleOf(player.id) === 'STARTER' ? 'text-green-400 bg-green-500/10' : 'text-neutral-300 bg-white/10'"
          >
            {{ roleOf(player.id) === 'STARTER' ? 'Titulaire' : 'Remplaçant' }}
          </span>
        </button>
      </div>

      <p v-if="errorMessage" class="mt-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
        {{ errorMessage }}
      </p>
    </div>

    <!-- Actions fixes en bas -->
    <div class="fixed bottom-0 inset-x-0 bg-neutral-950/90 backdrop-blur-sm border-t border-white/10 px-4 py-3">
      <div class="max-w-2xl mx-auto flex gap-3">
        <button
          class="flex-1 h-12 rounded-xl border border-white/10 text-neutral-400 text-sm font-medium
                 hover:border-white/20 hover:text-white transition-all"
          @click="handleSkip"
        >
          Passer (sans effectif)
        </button>
        <button
          :disabled="saving"
          class="flex-1 h-12 rounded-xl bg-white text-neutral-900 text-sm font-semibold
                 hover:bg-neutral-100 disabled:opacity-50 transition-all"
          @click="handleSave"
        >
          <span v-if="saving">Enregistrement...</span>
          <span v-else>Démarrer le match</span>
        </button>
      </div>
    </div>
  </div>
</template>
