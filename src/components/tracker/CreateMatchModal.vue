<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useMatchStore } from '@/stores/match.store'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { useRouter } from 'vue-router'
import { fetchEligibleTrackers, type EligibleTracker } from '@/lib/eligibleTrackers'
import { extractErrorMessage } from '@/lib/errors'
import { MATCH_TYPE_LABELS, MATCH_TYPES, type MatchType } from '@/lib/matchType'
import type { Match } from '@/types/match.types'

// En mode edition (editMatch fourni), le formulaire corrige les infos generales
// d'un match deja cree (ex. mauvaise date remarquee apres coup) au lieu d'en
// creer un nouveau — memes champs, sauf la delegation de tracker (deja geree
// ailleurs) et la composition (non concernee par une correction de date/equipes).
const props = defineProps<{ editMatch?: Match | null }>()
const emit = defineEmits<{ close: [] }>()
const isEditMode = computed(() => !!props.editMatch)

const matchStore = useMatchStore()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()
const router = useRouter()

const homeTeam = ref('')
const awayTeam = ref('')
const competition = ref('')
const matchType = ref<MatchType>('CHAMPIONSHIP')
// Date du jour par défaut
const date = ref(new Date().toISOString().split('T')[0])
const teamId = ref<string | null>(null)
const isHome = ref(true)
const trackerMemberId = ref<string | null>(null)
const loading = ref(false)
const errorMessage = ref<string | null>(null)

const eligibleTrackers = ref<EligibleTracker[]>([])
const loadingTrackers = ref(false)

// Un coach non-propriétaire ne peut créer un match que pour ses équipes
// rattachées (ou celles de sa catégorie pour un Responsable de catégorie)
const selectableTeams = computed(() => {
  if (clubsStore.isOwner) return teamsStore.teams
  return teamsStore.teams.filter((t) => clubsStore.hasTeamAccess(t))
})

// Place le nom du club dans le champ Domicile/Extérieur correspondant au
// côté choisi ("à domicile" = à gauche, "à l'extérieur" = à droite) — le
// coach n'a alors plus qu'à taper le nom de l'adversaire dans l'autre champ.
// Ne touche que le champ qui contenait déjà le nom du club (jamais le nom
// de l'adversaire potentiellement déjà saisi de l'autre côté).
function applyClubSide() {
  // Ne jamais toucher les noms d'equipe deja saisis en mode edition (ex. bascule
  // du toggle domicile/exterieur pour corriger uniquement ce champ)
  if (isEditMode.value) return
  const clubName = clubsStore.club?.name
  if (!clubName) return
  if (isHome.value) {
    homeTeam.value = clubName
    if (awayTeam.value === clubName) awayTeam.value = ''
  } else {
    awayTeam.value = clubName
    if (homeTeam.value === clubName) homeTeam.value = ''
  }
}

watch(isHome, applyClubSide)

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub()
    await Promise.all([teamsStore.fetchTeams(club.id), playersStore.fetchPlayers()])

    if (props.editMatch) {
      homeTeam.value = props.editMatch.homeTeam
      awayTeam.value = props.editMatch.awayTeam
      competition.value = props.editMatch.competition
      matchType.value = props.editMatch.matchType ?? 'CHAMPIONSHIP'
      date.value = props.editMatch.date.split('T')[0]
      isHome.value = props.editMatch.isHome
      teamId.value = props.editMatch.teamId
      return
    }

    if (selectableTeams.value.length === 1) teamId.value = selectableTeams.value[0].id
    applyClubSide()
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement du club.')
  }
})

// Membres rattachés à l'équipe choisie, éligibles pour être désignés "live
// tracker" de ce match (délégation ponctuelle, cf. matches.designated_tracker_member_id).
// Logique factorisée dans src/lib/eligibleTrackers.ts (réutilisée pour changer
// le tracker d'un match déjà créé, depuis LineupView).
async function loadEligibleTrackers(team: string | null) {
  trackerMemberId.value = null
  eligibleTrackers.value = []
  if (!team) return
  loadingTrackers.value = true
  try {
    eligibleTrackers.value = await fetchEligibleTrackers(team, playersStore.players)
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
    if (props.editMatch) {
      await matchStore.updateMatch(props.editMatch.id, {
        homeTeam: homeTeam.value.trim(),
        awayTeam: awayTeam.value.trim(),
        competition: competition.value.trim(),
        matchType: matchType.value,
        date: date.value,
        isHome: isHome.value,
      })
      emit('close')
      return
    }

    const match = await matchStore.createMatch({
      homeTeam: homeTeam.value.trim(),
      awayTeam: awayTeam.value.trim(),
      competition: competition.value.trim(),
      matchType: matchType.value,
      date: date.value,
      clubId: clubsStore.club.id,
      teamId: teamId.value,
      isHome: isHome.value,
      designatedTrackerMemberId: trackerMemberId.value,
    })
    emit('close')
    await router.push({ name: 'lineup', params: { id: match.id } })
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, props.editMatch ? 'Erreur lors de la modification.' : 'Erreur lors de la création.')
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
        <h2 class="text-lg font-semibold text-ink">{{ isEditMode ? 'Modifier le match' : 'Nouveau match' }}</h2>
        <button class="text-ink-meta hover:text-ink transition-colors p-1" @click="emit('close')">
          <X :size="18" :stroke-width="2" />
        </button>
      </div>

      <!-- Formulaire -->
      <form class="space-y-4" @submit.prevent="handleSubmit">

        <!-- Équipe du club concernée (creation uniquement — pas de reassignation d'equipe en edition) -->
        <div v-if="!isEditMode && selectableTeams.length > 0" class="space-y-1">
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

        <!-- Délégation du live tracking à un joueur pour ce match (creation uniquement) -->
        <div v-if="!isEditMode && teamId" class="space-y-1">
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

        <!-- Domicile/Extérieur : vrai choix explicite plutôt que devine depuis le
             libellé "Domicile" (qui reste un texte libre, ex. nom de sponsor ou
             ville, pas forcément le nom exact de l'équipe) — demande explicite
             de l'utilisateur (16/09/2026), sert au split domicile/extérieur des
             stats d'équipe (matches.is_home). -->
        <div class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Notre équipe joue</label>
          <div class="flex gap-1 p-[3px] bg-surface-sub border border-line rounded-input">
            <button
              type="button"
              class="flex-1 h-9 rounded-[7px] text-sm font-medium transition-colors"
              :class="isHome ? 'bg-brand-soft border border-brand-line text-brand-ink' : 'bg-transparent border border-transparent text-ink-meta'"
              @click="isHome = true"
            >
              À domicile
            </button>
            <button
              type="button"
              class="flex-1 h-9 rounded-[7px] text-sm font-medium transition-colors"
              :class="!isHome ? 'bg-brand-soft border border-brand-line text-brand-ink' : 'bg-transparent border border-transparent text-ink-meta'"
              @click="isHome = false"
            >
              À l'extérieur
            </button>
          </div>
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

        <!-- Type de match : champ ferme (distinct du libellé libre "Compétition"
             ci-dessous), sert à filtrer les stats équipe/joueur par la suite. -->
        <div class="space-y-1">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Type de match</label>
          <select
            v-model="matchType"
            class="w-full h-11 px-3 rounded-input bg-surface-sub border border-line text-ink
                   text-sm outline-none focus:border-brand transition-colors"
          >
            <option v-for="t in MATCH_TYPES" :key="t" :value="t">{{ MATCH_TYPE_LABELS[t] }}</option>
          </select>
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
            <span v-if="loading">{{ isEditMode ? 'Enregistrement…' : 'Création…' }}</span>
            <span v-else>{{ isEditMode ? 'Enregistrer' : 'Démarrer' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
