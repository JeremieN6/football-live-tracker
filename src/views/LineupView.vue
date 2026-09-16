<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchStore } from '@/stores/match.store'
import { usePlayersStore } from '@/stores/players.store'
import { useLineupStore } from '@/stores/lineup.store'
import { useTeamsStore } from '@/stores/teams.store'
import { useClubsStore } from '@/stores/clubs.store'
import { FORMATIONS, ROLE_COLORS, isFormationId, type FormationId } from '@/lib/formations'
import { deriveInitials } from '@/lib/displayName'
import { extractErrorMessage } from '@/lib/errors'
import { supabase } from '@/services/supabase'
import { fetchEligibleTrackers, type EligibleTracker } from '@/lib/eligibleTrackers'
import { Users } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const playersStore = usePlayersStore()
const lineupStore = useLineupStore()
const teamsStore = useTeamsStore()
const clubsStore = useClubsStore()

const matchId = route.params.id as string

const formation = ref<FormationId>('4-4-2')
// slotId -> playerId
const assign = ref<Record<string, string>>({})
const pickedPlayer = ref<string | null>(null)
const pickedSlot = ref<string | null>(null)
const saving = ref(false)
const errorMessage = ref<string | null>(null)

// Prefill "11 du match précédent" : proposé uniquement si ce match n'a pas
// encore de composition enregistrée et qu'un match antérieur de la même
// équipe a une composition titulaire placée sur le terrain (slot_id renseigné).
const showPrefillPrompt = ref(false)
const previousLineup = ref<{ formation: FormationId; assign: Record<string, string> } | null>(null)

async function checkPreviousLineup() {
  const match = matchStore.currentMatch
  if (!match?.teamId || !clubsStore.canWrite) return

  const { data: prevMatches } = await supabase
    .from('matches')
    .select('id, formation')
    .eq('team_id', match.teamId)
    .lt('date', match.date)
    .order('date', { ascending: false })
    .limit(1)

  const prevMatch = prevMatches?.[0]
  if (!prevMatch) return

  const { data: prevEntries } = await supabase
    .from('match_lineups')
    .select('player_id, slot_id')
    .eq('match_id', prevMatch.id)
    .eq('role', 'STARTER')
    .not('slot_id', 'is', null)

  if (!prevEntries || prevEntries.length === 0) return

  const prevAssign: Record<string, string> = {}
  for (const e of prevEntries) prevAssign[e.slot_id as string] = e.player_id as string

  previousLineup.value = {
    formation: isFormationId(prevMatch.formation) ? (prevMatch.formation as FormationId) : formation.value,
    assign: prevAssign,
  }
  showPrefillPrompt.value = true
}

function applyPreviousLineup() {
  if (!previousLineup.value) return
  formation.value = previousLineup.value.formation
  // Ne garde que les joueurs toujours actifs dans l'équipe (effectif a pu changer).
  const squadIds = new Set(squad.value.map((p) => p.id))
  const next: Record<string, string> = {}
  for (const [slotId, playerId] of Object.entries(previousLineup.value.assign)) {
    if (squadIds.has(playerId)) next[slotId] = playerId
  }
  assign.value = next
  showPrefillPrompt.value = false
}

function dismissPrefillPrompt() {
  showPrefillPrompt.value = false
}

onMounted(async () => {
  const club = await clubsStore.ensureClub().catch(() => null)
  await Promise.all([
    matchStore.fetchMatch(matchId),
    playersStore.fetchPlayers(),
    lineupStore.fetchLineup(matchId),
    club ? teamsStore.fetchTeams(club.id) : Promise.resolve(),
  ])

  if (isFormationId(matchStore.currentMatch?.formation)) formation.value = matchStore.currentMatch!.formation as FormationId

  const next: Record<string, string> = {}
  for (const entry of lineupStore.entries) {
    if (entry.role === 'STARTER' && entry.slotId) next[entry.slotId] = entry.playerId
  }
  assign.value = next

  if (Object.keys(next).length === 0) await checkPreviousLineup()

  if (matchStore.currentMatch?.teamId) await loadEligibleTrackers(matchStore.currentMatch.teamId)
})

// Désignation du tracker après la création du match (CreateMatchModal ne
// couvrait que la création) — visible uniquement pour qui peut écrire, un
// tracker désigné n'a pas ce droit de délégation à son tour.
const eligibleTrackers = ref<EligibleTracker[]>([])
const loadingTrackers = ref(false)
const showTrackerPanel = ref(false)
const trackerSaving = ref(false)

async function loadEligibleTrackers(teamId: string) {
  loadingTrackers.value = true
  try {
    eligibleTrackers.value = await fetchEligibleTrackers(teamId, playersStore.players)
  } catch {
    // Non bloquant
  } finally {
    loadingTrackers.value = false
  }
}

const currentTrackerLabel = computed(() => {
  const id = matchStore.currentMatch?.designatedTrackerMemberId
  if (!id) return 'Personne'
  return eligibleTrackers.value.find((t) => t.memberId === id)?.label ?? 'Joueur désigné'
})

async function setTracker(memberId: string | null) {
  trackerSaving.value = true
  try {
    await matchStore.updateDesignatedTracker(matchId, memberId)
    showTrackerPanel.value = false
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de la désignation du tracker.')
  } finally {
    trackerSaving.value = false
  }
}

// Le nouveau modèle n'a plus de 3e état "non convoqué" : tout joueur actif de
// l'équipe du match est soit sur le terrain, soit sur le banc (cf. maquette
// Lineup). Un joueur écarté du match doit être archivé dans l'effectif.
//
// Vivier de base : l'effectif de l'équipe du match si une équipe est
// précisée (cas normal), ou le groupe Senior (teams.category contenant
// "senior") si aucune équipe n'est précisée (ex. match amical créé sans
// équipe exacte) — plus TOUT le club par défaut, un U18 s'y mélangeait.
// Dans TOUS les cas (équipe précisée ou non), le panneau "Inclure d'autres
// joueurs" ci-dessous permet d'ajouter ponctuellement des joueurs d'une
// autre catégorie que celle du vivier de base — un amical d'Équipe Première
// reste un match ou l'on peut vouloir monter un U18, pas seulement un match
// sans équipe rattachée.
const SENIOR_CATEGORY = /s[ée]nior/i

const seniorTeamIds = computed(
  () => new Set(teamsStore.teams.filter((t) => SENIOR_CATEGORY.test(t.category ?? '')).map((t) => t.id)),
)

// Catégorie de l'équipe du match (si une équipe est précisée) — sert à
// l'exclure de la liste des "autres catégories" proposées à l'ajout.
const matchTeamCategory = computed(() => {
  const teamId = matchStore.currentMatch?.teamId
  if (!teamId) return null
  return teamsStore.teams.find((t) => t.id === teamId)?.category ?? null
})

const extraPlayerIds = ref<Set<string>>(new Set())
const showExtraPicker = ref(false)
const extraCategory = ref<string | null>(null)

// Catégories disponibles pour l'ajout ponctuel : toutes sauf celle du vivier
// de base (celle de l'équipe du match si précisée, sinon "Senior") — déduites
// des équipes existantes (teams.category reste du texte libre saisi par le coach).
const otherCategories = computed(() => {
  const cats = new Set<string>()
  for (const t of teamsStore.teams) {
    if (!t.category) continue
    if (matchTeamCategory.value ? t.category === matchTeamCategory.value : SENIOR_CATEGORY.test(t.category)) continue
    cats.add(t.category)
  }
  return [...cats].sort()
})

const extraCategoryPlayers = computed(() => {
  if (!extraCategory.value) return []
  const teamIds = new Set(teamsStore.teams.filter((t) => t.category === extraCategory.value).map((t) => t.id))
  return playersStore.players.filter((p) => p.active && p.teamId && teamIds.has(p.teamId))
})

function toggleExtraPlayer(playerId: string) {
  const next = new Set(extraPlayerIds.value)
  if (next.has(playerId)) next.delete(playerId)
  else next.add(playerId)
  extraPlayerIds.value = next
}

const squad = computed(() => {
  const teamId = matchStore.currentMatch?.teamId
  const base = teamId
    ? playersStore.players.filter((p) => p.active && p.teamId === teamId)
    : playersStore.players.filter((p) => p.active && p.teamId && seniorTeamIds.value.has(p.teamId))
  if (extraPlayerIds.value.size === 0) return base
  const baseIds = new Set(base.map((p) => p.id))
  const extras = playersStore.players.filter((p) => p.active && extraPlayerIds.value.has(p.id) && !baseIds.has(p.id))
  return [...base, ...extras]
})

const slots = computed(() => FORMATIONS[formation.value])

const bench = computed(() => {
  const used = new Set(Object.values(assign.value))
  return squad.value.filter((p) => !used.has(p.id))
})

const filledCount = computed(() => Object.keys(assign.value).length)
const complete = computed(() => filledCount.value === 11)

function place(slotId: string, playerId: string) {
  const next = { ...assign.value }
  for (const key of Object.keys(next)) {
    if (next[key] === playerId) delete next[key]
  }
  next[slotId] = playerId
  assign.value = next
  pickedPlayer.value = null
  pickedSlot.value = null
}

function tapSlot(slotId: string) {
  if (!clubsStore.canWrite) return
  if (pickedPlayer.value) {
    place(slotId, pickedPlayer.value)
    return
  }
  const occupant = assign.value[slotId]
  if (pickedSlot.value && pickedSlot.value !== slotId) {
    const next = { ...assign.value }
    const a = next[pickedSlot.value]
    if (occupant === undefined) delete next[pickedSlot.value]
    else next[pickedSlot.value] = occupant
    if (a !== undefined) next[slotId] = a
    else delete next[slotId]
    assign.value = next
    pickedSlot.value = null
    pickedPlayer.value = null
    return
  }
  if (occupant !== undefined) {
    const next = { ...assign.value }
    delete next[slotId]
    assign.value = next
    pickedSlot.value = null
    pickedPlayer.value = null
    return
  }
  pickedSlot.value = slotId
  pickedPlayer.value = null
}

function tapPlayer(playerId: string) {
  if (!clubsStore.canWrite) return
  if (pickedSlot.value) {
    place(pickedSlot.value, playerId)
    return
  }
  pickedPlayer.value = pickedPlayer.value === playerId ? null : playerId
  pickedSlot.value = null
}

function selectFormation(id: FormationId) {
  if (!clubsStore.canWrite) return
  formation.value = id
  assign.value = {}
  pickedPlayer.value = null
  pickedSlot.value = null
}

function resetAll() {
  assign.value = {}
  pickedPlayer.value = null
  pickedSlot.value = null
}

const pickedPlayerObj = computed(() => squad.value.find((p) => p.id === pickedPlayer.value) ?? null)
const hint = computed(() => {
  if (pickedPlayerObj.value) return `Tape une position pour ${pickedPlayerObj.value.name}`
  if (pickedSlot.value) return 'Tape un joueur du banc'
  return ''
})

function playerFor(slotId: string) {
  const id = assign.value[slotId]
  return id ? squad.value.find((p) => p.id === id) ?? null : null
}
function lastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1]
}

const matchMeta = computed(() => {
  const match = matchStore.currentMatch
  if (!match) return ''
  const teamLabel = teamsStore.teams.find((t) => t.id === match.teamId)?.name
  const date = new Date(match.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  return [teamLabel, `${match.homeTeam} vs ${match.awayTeam}`, date].filter(Boolean).join(' · ')
})

async function handleLaunch() {
  if (!complete.value) return
  errorMessage.value = null
  saving.value = true
  try {
    const selection = [
      ...slots.value
        .filter((s) => assign.value[s.id])
        .map((s) => ({ playerId: assign.value[s.id], role: 'STARTER' as const, slotId: s.id, slotLabel: s.label })),
      ...bench.value.map((p) => ({ playerId: p.id, role: 'SUB' as const, slotId: null, slotLabel: null })),
    ]
    await Promise.all([
      lineupStore.saveLineup(matchId, selection),
      matchStore.updateFormation(matchId, formation.value),
    ])
    router.push({ name: 'tracker', params: { id: matchId } })
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de l\'enregistrement.')
  } finally {
    saving.value = false
  }
}

function handleViewOnly() {
  router.push({ name: 'tracker', params: { id: matchId } })
}
</script>

<template>
  <div class="h-dvh flex flex-col bg-app text-ink overflow-hidden">

    <!-- Header -->
    <div class="flex-none flex items-center justify-between gap-2.5 px-4 py-3 border-b border-line">
      <div class="min-w-0">
        <h1 class="text-[17px] font-semibold text-ink">Composition</h1>
        <p class="mt-0.5 text-[11px] text-ink-meta truncate">{{ matchMeta }}</p>
      </div>
      <div v-if="clubsStore.canWrite" class="flex-none flex gap-1 p-[3px] bg-surface-sub border border-line rounded-input">
        <button
          v-for="f in (Object.keys(FORMATIONS) as FormationId[])"
          :key="f"
          class="h-7 px-2.5 rounded-[7px] font-data text-[11px] font-semibold transition-colors"
          :class="formation === f ? 'bg-brand-soft border border-brand-line text-brand-ink' : 'bg-transparent border border-transparent text-ink-meta'"
          @click="selectFormation(f)"
        >
          {{ f }}
        </button>
      </div>
    </div>

    <!-- Tracker delegue : desormais modifiable ici, pas seulement a la creation
         du match (CreateMatchModal.vue) — un coach peut vouloir deleguer la
         saisie apres coup. -->
    <div v-if="clubsStore.canWrite && matchStore.currentMatch?.teamId" class="flex-none px-4 py-2 border-b border-line">
      <button
        class="w-full flex items-center gap-2 text-[12px] text-ink-secondary hover:text-ink transition-colors"
        @click="showTrackerPanel = !showTrackerPanel"
      >
        <Users :size="13" :stroke-width="2" class="flex-none text-ink-disabled" />
        <span>Tracker délégué :</span>
        <span class="font-medium text-ink">{{ currentTrackerLabel }}</span>
      </button>

      <div v-if="showTrackerPanel" class="mt-2 flex flex-wrap gap-1.5">
        <button
          class="h-8 px-2.5 rounded-[7px] text-[11.5px] font-medium border transition-colors"
          :class="!matchStore.currentMatch?.designatedTrackerMemberId ? 'bg-brand-soft border-brand-line text-brand-ink' : 'bg-surface-sub border-line text-ink-secondary'"
          :disabled="trackerSaving"
          @click="setTracker(null)"
        >
          Personne
        </button>
        <button
          v-for="t in eligibleTrackers"
          :key="t.memberId"
          class="h-8 px-2.5 rounded-[7px] text-[11.5px] font-medium border transition-colors"
          :class="matchStore.currentMatch?.designatedTrackerMemberId === t.memberId ? 'bg-brand-soft border-brand-line text-brand-ink' : 'bg-surface-sub border-line text-ink-secondary'"
          :disabled="trackerSaving"
          @click="setTracker(t.memberId)"
        >
          {{ t.label }}
        </button>
        <p v-if="!loadingTrackers && eligibleTrackers.length === 0" class="text-[11.5px] text-ink-meta py-1.5">
          Aucun membre rattaché à cette équipe à désigner.
        </p>
      </div>
    </div>

    <!-- Zone principale : empilee en mobile (terrain puis banc), en 2 colonnes
         des lg (banc a gauche, terrain a droite). Avant, le terrain etait fige a
         380px de haut : sur un ecran large mais peu haut, il ne restait qu'une
         fente de quelques centimetres pour scroller tout l'effectif. -->
    <div class="flex-1 min-h-0 flex flex-col lg:flex-row">

    <!-- Terrain -->
    <div class="flex-none h-[380px] lg:order-2 lg:flex-1 lg:h-auto lg:min-h-0 relative bg-pitch overflow-hidden">
      <div class="absolute inset-0" style="background: repeating-linear-gradient(to bottom, rgba(255,255,255,.022) 0 38px, transparent 38px 76px)" />
      <svg viewBox="0 0 68 105" preserveAspectRatio="none" class="absolute inset-0 w-full h-full pointer-events-none" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="0.4">
        <rect x="2" y="2" width="64" height="101" />
        <line x1="2" y1="52.5" x2="66" y2="52.5" />
        <circle cx="34" cy="52.5" r="9" />
        <rect x="14" y="2" width="40" height="16" />
        <rect x="25" y="2" width="18" height="6" />
        <rect x="14" y="87" width="40" height="16" />
        <rect x="25" y="97" width="18" height="6" />
      </svg>

      <div
        v-for="slot in slots"
        :key="slot.id"
        class="absolute flex flex-col items-center gap-[3px] -translate-x-1/2 -translate-y-1/2"
        :class="clubsStore.canWrite ? 'cursor-pointer' : ''"
        :style="{ left: `${slot.x}%`, top: `${slot.y}%` }"
        :data-testid="`lineup-slot-${slot.id}`"
        @click="tapSlot(slot.id)"
      >
        <span
          class="flex items-center justify-center w-[34px] h-[34px] rounded-full font-data text-xs font-bold transition-transform"
          :style="playerFor(slot.id)
            ? { background: ROLE_COLORS[slot.role].bg, borderWidth: '1.5px', borderStyle: 'solid', borderColor: ROLE_COLORS[slot.role].fg, color: ROLE_COLORS[slot.role].fg, transform: (pickedSlot === slot.id) ? 'scale(1.12)' : 'scale(1)' }
            : { background: 'rgba(15,25,35,.55)', borderWidth: '1.5px', borderStyle: 'dashed', borderColor: (pickedPlayer ? '#4ADE80' : 'rgba(255,255,255,.4)'), color: (pickedPlayer ? '#4ADE80' : 'rgba(255,255,255,.65)'), transform: (pickedSlot === slot.id || pickedPlayer) ? 'scale(1.12)' : 'scale(1)' }"
        >
          {{ playerFor(slot.id)?.number ?? slot.label }}
        </span>
        <span v-if="playerFor(slot.id)" class="font-semibold text-[9px] text-ink whitespace-nowrap" style="text-shadow: 0 1px 3px rgba(0,0,0,.9)">
          {{ lastName(playerFor(slot.id)!.name) }}
        </span>
      </div>

      <div
        class="absolute left-3 right-3 top-2.5 text-center px-2.5 py-[7px] rounded-input font-medium text-xs transition-opacity pointer-events-none"
        :style="{ background: 'rgba(15,25,35,.9)', border: '1px solid #374151', color: '#F9FAFB', opacity: hint ? 1 : 0 }"
      >
        {{ hint }}
      </div>
    </div>

    <!-- Colonne banc + actions -->
    <div class="flex-1 min-h-0 lg:order-1 lg:flex-none lg:w-[360px] flex flex-col lg:border-r lg:border-line">

    <!-- En-tête banc -->
    <div class="flex-none flex items-center justify-between px-4 pt-2.5 pb-2 border-t border-line border-b border-line lg:border-t-0">
      <span class="text-[13px] font-semibold text-ink">Banc</span>
      <span class="font-data text-[11px]" :class="complete ? 'text-brand-ink' : 'text-ink-meta'">{{ filledCount }}/11 placés</span>
    </div>

    <!-- Ajout ponctuel de joueurs d'une autre catégorie que celle du vivier de
         base — disponible que le match soit rattaché à une équipe précise
         (ex. Équipe Première pour un amical) ou non (groupe Senior par défaut). -->
    <div v-if="clubsStore.canWrite" class="flex-none px-4 pt-2 pb-1 border-b border-line">
      <button
        type="button"
        class="text-[12px] text-ink-secondary hover:text-ink transition-colors"
        @click="showExtraPicker = !showExtraPicker"
      >
        + Inclure des joueurs d'une autre catégorie
      </button>

      <div v-if="showExtraPicker" class="mt-2 space-y-2">
        <select
          v-model="extraCategory"
          class="w-full h-9 px-2.5 rounded-input bg-surface-sub border border-line text-ink
                 text-[13px] outline-none focus:border-brand transition-colors [color-scheme:dark]"
        >
          <option :value="null">Choisir une catégorie…</option>
          <option v-for="c in otherCategories" :key="c" :value="c">{{ c }}</option>
        </select>
        <p v-if="extraCategory && extraCategoryPlayers.length === 0" class="text-[11.5px] text-ink-meta">
          Aucun joueur actif dans cette catégorie.
        </p>
        <div v-else-if="extraCategory" class="flex flex-wrap gap-1.5">
          <button
            v-for="p in extraCategoryPlayers"
            :key="p.id"
            type="button"
            class="text-[12px] px-2.5 py-1 rounded-full border transition-colors"
            :class="extraPlayerIds.has(p.id)
              ? 'bg-brand-soft border-brand-line text-brand-ink'
              : 'bg-surface-sub border-line text-ink-secondary'"
            @click="toggleExtraPlayer(p.id)"
          >
            {{ p.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Liste banc -->
    <div class="flex-1 min-h-0 overflow-y-auto px-3 py-2.5">
      <p v-if="squad.length === 0" class="px-4 py-6 text-center text-sm text-ink-meta">
        <template v-if="playersStore.loading">Chargement…</template>
        <template v-else-if="matchStore.currentMatch?.teamId">Aucun joueur actif dans l'équipe de ce match — ajoute l'effectif d'abord.</template>
        <template v-else>Aucun joueur dans le groupe Senior — renseigne la catégorie "Senior" sur une équipe dans Mon club, ou inclus des joueurs d'une autre catégorie ci-dessus.</template>
      </p>
      <p v-else-if="bench.length === 0" class="px-4 py-4 text-center text-[13px] text-ink-meta">
        Banc vide — tous les joueurs sont sur le terrain
      </p>
      <div v-else class="flex flex-col gap-[5px]">
        <div
          v-for="p in bench"
          :key="p.id"
          class="flex items-center gap-2.5 min-h-[52px] px-2.5 py-1.5 rounded-input border transition-colors"
          :class="[clubsStore.canWrite ? 'cursor-pointer' : '', pickedPlayer === p.id ? 'bg-surface-hover' : 'bg-surface']"
          :style="pickedPlayer === p.id ? { borderWidth: '1.5px', borderColor: '#16A34A' } : { borderColor: '#374151' }"
          data-testid="lineup-bench-player"
          @click="tapPlayer(p.id)"
        >
          <span
            class="flex-none flex items-center justify-center w-[34px] h-[34px] rounded-full font-data text-[11px] font-bold border"
            :style="{ background: ROLE_COLORS.M.bg, borderColor: '#374151', color: '#9CA3AF' }"
          >
            {{ deriveInitials(p.name.replace(/\s+/, '.')) }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-medium text-ink truncate">{{ p.name }}</p>
            <p class="mt-0.5 text-[10.5px] text-ink-meta truncate">{{ p.position || '—' }}</p>
          </div>
          <span class="flex-none font-data text-[13px] font-bold text-ink-disabled">{{ p.number ?? '—' }}</span>
        </div>
      </div>
    </div>

    <!-- Erreur -->
    <p v-if="errorMessage" class="flex-none mx-4 mb-2 text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-3 py-2">
      {{ errorMessage }}
    </p>

    <!-- Pied de page -->
    <div class="flex-none flex gap-2 px-4 pt-2.5 pb-3.5 border-t border-line">
      <template v-if="clubsStore.canWrite">
        <button
          class="flex-none h-11 px-3.5 rounded-btn border border-line text-ink-secondary text-[13px] font-medium hover:text-ink hover:bg-surface transition-colors"
          @click="resetAll"
        >
          Vider
        </button>
        <button
          class="flex-1 h-11 rounded-btn text-[13px] font-semibold transition-colors"
          :class="complete ? 'bg-brand border border-brand-line text-brand-soft hover:bg-brand-hover' : 'bg-surface border border-line text-ink-meta cursor-not-allowed'"
          :disabled="!complete || saving"
          @click="handleLaunch"
        >
          <span v-if="saving">Enregistrement…</span>
          <span v-else-if="complete">Lancer le tracker</span>
          <span v-else>Place les 11 titulaires</span>
        </button>
      </template>
      <button
        v-else
        class="flex-1 h-11 rounded-btn bg-brand border border-brand-line text-brand-soft text-[13px] font-semibold hover:bg-brand-hover transition-colors"
        @click="handleViewOnly"
      >
        Voir le match
      </button>
    </div>

    </div><!-- /colonne banc -->
    </div><!-- /zone principale -->

    <!-- Prefill 11 du match précédent -->
    <div
      v-if="showPrefillPrompt"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="dismissPrefillPrompt"
    >
      <div class="w-full max-w-sm bg-surface border border-line rounded-card p-6">
        <h2 class="text-base font-semibold text-ink mb-1">Reprendre le 11 du match précédent ?</h2>
        <p class="text-sm text-ink-secondary mb-5">
          La composition titulaire du dernier match de cette équipe peut être posée directement sur le terrain — tu pourras l'ajuster ensuite.
        </p>
        <div class="flex gap-3">
          <button
            class="flex-1 h-11 rounded-btn border border-line text-ink-secondary text-sm font-medium hover:text-ink transition-colors"
            @click="dismissPrefillPrompt"
          >
            Non merci
          </button>
          <button
            class="flex-1 h-11 rounded-btn bg-brand text-brand-soft text-sm font-semibold hover:bg-brand-hover transition-colors"
            @click="applyPreviousLineup"
          >
            Oui, reprendre
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
