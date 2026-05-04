<script setup lang="ts">
import { ref } from 'vue'
import { useMatchStore } from '@/stores/match.store'
import { useRouter } from 'vue-router'

const emit = defineEmits<{ close: [] }>()

const matchStore = useMatchStore()
const router = useRouter()

const homeTeam = ref('')
const awayTeam = ref('')
const competition = ref('')
// Date du jour par défaut
const date = ref(new Date().toISOString().split('T')[0])
const loading = ref(false)
const errorMessage = ref<string | null>(null)

async function handleSubmit() {
  errorMessage.value = null
  loading.value = true

  try {
    const match = await matchStore.createMatch({
      homeTeam: homeTeam.value.trim(),
      awayTeam: awayTeam.value.trim(),
      competition: competition.value.trim(),
      date: date.value,
    })
    emit('close')
    await router.push({ name: 'tracker', params: { id: match.id } })
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Erreur lors de la création.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- Overlay -->
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
    @click.self="emit('close')"
  >
    <!-- Panel -->
    <div class="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-white">Nouveau match</h2>
        <button
          class="text-neutral-500 hover:text-white transition-colors p-1"
          @click="emit('close')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Formulaire -->
      <form class="space-y-4" @submit.prevent="handleSubmit">

        <!-- Équipes -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Domicile</label>
            <input
              v-model="homeTeam"
              type="text"
              required
              placeholder="Ex: Lyon"
              maxlength="50"
              class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                     text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Extérieur</label>
            <input
              v-model="awayTeam"
              type="text"
              required
              placeholder="Ex: Marseille"
              maxlength="50"
              class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                     text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>
        </div>

        <!-- Compétition -->
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Compétition</label>
          <input
            v-model="competition"
            type="text"
            placeholder="Ex: Championnat R1, Coupe Régionale..."
            maxlength="80"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-600
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          />
        </div>

        <!-- Date -->
        <div class="space-y-1">
          <label class="text-xs font-medium text-neutral-400 uppercase tracking-wide">Date</label>
          <input
            v-model="date"
            type="date"
            required
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-all
                   [color-scheme:dark]"
          />
        </div>

        <!-- Erreur -->
        <p v-if="errorMessage" class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {{ errorMessage }}
        </p>

        <!-- Actions -->
        <div class="flex gap-3 pt-2">
          <button
            type="button"
            class="flex-1 h-11 rounded-lg border border-white/10 text-neutral-400 text-sm font-medium
                   hover:border-white/20 hover:text-white transition-all"
            @click="emit('close')"
          >
            Annuler
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="flex-1 h-11 rounded-lg bg-white text-neutral-900 text-sm font-semibold
                   hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span v-if="loading">Création...</span>
            <span v-else>Démarrer</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
