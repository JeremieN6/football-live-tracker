<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useMatchStore } from '@/stores/match.store'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { useRouter } from 'vue-router'
import { supabase } from '@/services/supabase'
import { deriveDisplayName } from '@/lib/displayName'
import { extractErrorMessage } from '@/lib/errors'

const emit = defineEmits<{ close: [] }>()

const matchStore = useMatchStore()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()
const router = useRouter()

const homeTeam = ref('')
const awayTeam = ref('')
const competition = ref('')
// Date du jour par défaut
const date = ref(new Date().toISOString().split('T')[0])
const teamId = ref<string | null>(null)
const trackerMemberId = ref<string | null>(null)
const loading = ref(false)
const errorMessage = ref<string | null>(null)

interface EligibleTracker { memberId: string; label: string }
const eligibleTrackers = ref<EligibleTracker[]>([])
const loadingTrackers = ref(false)

// Un coach non-propriétaire ne peut créer un match que pour ses équipes
// rattachées (ou celles de sa catégorie pour un Responsable de catégorie)
const selectableTeams = computed(() => {
  if (clubsStore.isOwner) return teamsStore.teams
  return teamsStore.teams.filter((t) => clubsStore.hasTeamAccess(t))
})

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub()
    await Promise.all([teamsStore.fetchTeams(club.id), playersStore.fetchPlayers()])
    if (selectableTeams.value.length === 1) teamId.value = selectableTeams.value[0].id
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement du club.')
  }
})

// Membres rattachés à l'équipe choisie, éligibles pour être désignés "live
// tracker" de ce match (délégation ponctuelle, pas les droits COACH/ADJOINT
// complets — cf. matches.designated_tracker_member_id). Affiche le nom du
// joueur lié si la fiche effectif est reliée au compte (players.member_id),
// sinon un nom dérivé de son email.
async function loadEligibleTrackers(team: string | null) {
  trackerMemberId.value = null
  eligibleTrackers.value = []
  if (!team) return
  loadingTrackers.value = true
  try {
    const { data, error: sbError } = await supabase
      .from('club_member_teams')
      .select('member_id, club_members!inner(id, invited_email, status)')
      .eq('team_id', team)
      .eq('club_members.status', 'ACTIVE')
    if (sbError) throw sbError
    eligibleTrackers.value = (data ?? []).map((row) => {
      const memberId = row.member_id as string
      const player = playersStore.players.find((p) => p.memberId === memberId)
      const member = row.club_members as unknown as { invited_email: string | null }
      return { memberId, label: player?.name ?? deriveDisplayName(member?.invited_email) }
    })
  } catch {
    // Non bloquant : le champ de délégation reste simplement vide en cas d'erreur
  } finally {
    loadingTrackers.value = false
  }
}

watch(teamId, (team) => { loadEligibleTrackers(team) })

async function handleSubmit() {
  if (!clubsStore.club) return
  errorMessage.value = null
  loading.value = true

  try {
    const match = await matchStore.createMatch({
      homeTeam: homeTeam.value.trim(),
      awayTeam: awayTeam.value.trim(),
      competition: competition.value.trim(),
      date: date.value,
      clubId: clubsStore.club.id,
      teamId: teamId.value,
      designatedTrackerMemberId: trackerMemberId.value,
    })
    emit('close')
    await router.push({ name: 'lineup', params: { id: match.id } })
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de la création.')
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
    <div class="w-full max-w-md bg-surface border border-line rounded-card p-6 max-h-[85vh] overflow-y-auto">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-ink">Nouveau match</h2>
        <button class="text-ink-meta hover:text-ink transition-colors p-1" @click="emit('close')">
          <X :size="18" :stroke-width="2" />
        </button>
      </div>

      <!-- Formulaire -->
      <form class="space-y-4" @submit.prevent="handleSubmit">

        <!-- Équipe du club concernée -->
        <div v-if="selectableTeams.length > 0" class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Votre équipe</label>
          <select
            v-model="teamId"
            class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                   text-sm outline-none focus:border-brand transition-colors"
          >
            <option v-if="clubsStore.isOwner" :value="null">Non précisée</option>
            <option v-for="t in selectableTeams" :key="t.id" :value="t.id">
              {{ t.name }}<span v-if="t.division"> · {{ t.division }}</span>
            </option>
          </select>
        </div>

        <!-- Délégation du live tracking à un joueur pour ce match -->
        <div v-if="teamId" class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Autoriser un joueur à tracker ce match (optionnel)</label>
          <select
            v-model="trackerMemberId"
            :disabled="loadingTrackers"
            class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                   text-sm outline-none focus:border-brand transition-colors disabled:opacity-50"
          >
            <option :value="null">Personne — toi seul(e) pourras tracker</option>
            <option v-for="t in eligibleTrackers" :key="t.memberId" :value="t.memberId">{{ t.label }}</option>
          </select>
          <p class="text-xs text-ink-meta">
            La personne choisie pourra saisir les événements de ce match précis, comme un coach — relis le rapport après le match.
          </p>
        </div>

        <!-- Équipes (adversaire) -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Domicile</label>
            <input
              v-model="homeTeam"
              type="text"
              required
              placeholder="Ex: Lyon"
              maxlength="50"
              class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                     text-sm outline-none focus:border-brand transition-colors"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Extérieur</label>
            <input
              v-model="awayTeam"
              type="text"
              required
              placeholder="Ex: Marseille"
              maxlength="50"
              class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                     text-sm outline-none focus:border-brand transition-colors"
            />
          </div>
        </div>

        <!-- Compétition -->
        <div class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Compétition</label>
          <input
            v-model="competition"
            type="text"
            placeholder="Ex: Championnat R1, Coupe Régionale..."
            maxlength="80"
            class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                   text-sm outline-none focus:border-brand transition-colors"
          />
        </div>

        <!-- Date -->
        <div class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Date</label>
          <input
            v-model="date"
            type="date"
            required
            class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                   text-sm outline-none focus:border-brand transition-colors [color-scheme:dark]"
          />
        </div>

        <!-- Erreur -->
        <p v-if="errorMessage" class="text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2">
          {{ errorMessage }}
        </p>

        <!-- Actions -->
        <div class="flex gap-3 pt-2">
          <button
            type="button"
            class="flex-1 h-11 rounded-btn border border-line text-ink-secondary text-sm font-medium hover:border-line-strong hover:text-ink transition-colors"
            @click="emit('close')"
          >
            Annuler
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="flex-1 h-11 rounded-btn bg-brand text-brand-soft text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="loading">Création…</span>
            <span v-else>Démarrer</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
