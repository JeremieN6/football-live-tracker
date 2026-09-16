<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClubsStore } from '@/stores/clubs.store'
import { useTeamsStore } from '@/stores/teams.store'
import { usePlayersStore } from '@/stores/players.store'
import { supabase } from '@/services/supabase'
import { extractErrorMessage } from '@/lib/errors'
import type { Player } from '@/types/match.types'

// Onboarding d'un joueur qui vient de se connecter (lien magique) : le
// compte est déjà relié au club via club_members (invitation par email),
// mais aucune fiche `players` (numéro, poste, stats) n'est encore reliée.
// Deux chemins : reprendre une fiche déjà créée par le coach (le cas
// courant — le coach a créé son effectif à la main), ou en créer une.

const router = useRouter()
const clubsStore = useClubsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()

const loading = ref(true)
const saving = ref(false)
const errorMessage = ref<string | null>(null)

const showCreateForm = ref(false)
const name = ref('')
const position = ref('')
const number = ref('')

// Aucune preuve d'identité n'existe entre le compte qui se connecte et la
// fiche joueur choisie (le lien d'invitation ne porte que l'email/l'équipe,
// pas un joueur précis) — un simple récapitulatif avant confirmation évite
// qu'un clic distrait relie le compte au mauvais coéquipier.
const pendingClaim = ref<Player | null>(null)

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}

function playerDetail(p: Player): string {
  const parts = [p.position, p.number != null ? `#${p.number}` : null].filter(Boolean)
  return parts.length > 0 ? ` (${parts.join(', ')})` : ''
}

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub()
    await Promise.all([teamsStore.fetchTeams(club.id), playersStore.fetchPlayers()])
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement.')
  } finally {
    loading.value = false
  }
})

// Fiches non réclamées (member_id null) des équipes du membre — le cas
// attendu : le coach a déjà créé ce joueur dans l'effectif.
const unclaimedPlayers = computed(() => {
  const teamIds = clubsStore.membership?.teamIds ?? []
  return playersStore.players.filter((p) => p.memberId === null && p.teamId && teamIds.includes(p.teamId))
})

const teamName = computed(() => {
  const id = clubsStore.membership?.teamIds[0]
  return teamsStore.teams.find((t) => t.id === id)?.name ?? null
})

async function confirmClaim() {
  if (!pendingClaim.value) return
  errorMessage.value = null
  saving.value = true
  try {
    const { error } = await supabase.rpc('claim_player_profile', { target_player_id: pendingClaim.value.id })
    if (error) throw error
    clubsStore.markPlayerProfileClaimed()
    router.push({ name: 'home' })
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de la liaison du profil.')
  } finally {
    saving.value = false
    pendingClaim.value = null
  }
}

async function handleCreate() {
  const teamId = clubsStore.membership?.teamIds[0]
  if (!name.value.trim() || !teamId) return
  errorMessage.value = null
  saving.value = true
  try {
    const { error } = await supabase.rpc('create_own_player_profile', {
      p_name: name.value.trim(),
      p_team_id: teamId,
      p_position: position.value.trim() || null,
      p_number: number.value.trim() ? Number(number.value.trim()) : null,
    })
    if (error) throw error
    clubsStore.markPlayerProfileClaimed()
    router.push({ name: 'home' })
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de la création du profil.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-app text-ink flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <h1 class="text-lg font-semibold text-ink mb-2 text-center">Qui es-tu ?</h1>
      <p class="text-sm text-ink-meta mb-6 text-center">
        Relie ton compte à ta fiche dans l'effectif{{ teamName ? ` de ${teamName}` : '' }} pour accéder à tes stats.
      </p>

      <div v-if="loading" class="py-10 text-center text-sm text-ink-meta">Chargement…</div>

      <template v-else-if="!showCreateForm">
        <div v-if="unclaimedPlayers.length > 0" class="flex flex-col gap-1.5 mb-4">
          <button
            v-for="p in unclaimedPlayers"
            :key="p.id"
            :disabled="saving"
            class="w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-card bg-surface border border-line hover:border-line-strong hover:bg-surface-hover transition-colors text-left disabled:opacity-50"
            @click="pendingClaim = p"
          >
            <span class="text-sm text-ink font-medium">{{ p.name }}</span>
            <span class="text-xs text-ink-meta">{{ p.position || '—' }}<span v-if="p.number != null"> · #{{ p.number }}</span></span>
          </button>
        </div>
        <p v-else class="text-sm text-ink-meta text-center mb-4">
          Aucune fiche disponible dans l'effectif pour l'instant.
        </p>

        <button
          type="button"
          class="w-full h-11 rounded-btn border border-dashed border-line-strong text-ink-secondary text-sm font-medium hover:text-ink hover:bg-surface transition-colors"
          @click="showCreateForm = true"
        >
          Je ne me trouve pas — créer ma fiche
        </button>
      </template>

      <form v-else class="flex flex-col gap-3.5 bg-surface border border-line rounded-card p-5" @submit.prevent="handleCreate">
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Nom</label>
          <input
            v-model="name"
            type="text"
            required
            placeholder="Ton nom"
            class="h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta text-sm outline-none focus:border-brand transition-colors"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Poste</label>
            <input
              v-model="position"
              type="text"
              placeholder="Ex: Attaquant"
              class="h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta text-sm outline-none focus:border-brand transition-colors"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Numéro</label>
            <input
              v-model="number"
              type="number"
              placeholder="Ex: 9"
              class="h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta text-sm outline-none focus:border-brand transition-colors [color-scheme:dark]"
            />
          </div>
        </div>
        <div class="flex gap-3 pt-1">
          <button
            type="button"
            class="flex-1 h-11 rounded-btn border border-line text-ink-secondary text-sm font-medium hover:text-ink transition-colors"
            @click="showCreateForm = false"
          >
            Retour
          </button>
          <button
            type="submit"
            :disabled="saving || !name.trim()"
            class="flex-1 h-11 rounded-btn bg-brand text-brand-soft text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {{ saving ? 'Enregistrement…' : 'Valider' }}
          </button>
        </div>
      </form>

      <p v-if="errorMessage" class="mt-4 text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-2.5 py-2 text-center">
        {{ errorMessage }}
      </p>
    </div>

    <!-- Confirmation avant liaison : aucune autre verification n'existe entre le
         compte connecte et le joueur choisi, ce recap evite de se lier a la
         mauvaise fiche par erreur de clic. -->
    <div
      v-if="pendingClaim"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      @click.self="pendingClaim = null"
    >
      <div class="w-full max-w-sm bg-surface border border-line rounded-card p-6">
        <h2 class="text-base font-semibold text-ink mb-1">
          Salut {{ firstName(pendingClaim.name) }}, c'est bien toi ?
        </h2>
        <p class="text-sm text-ink-secondary mb-5">
          Tu es sur le point de lier ton compte à la fiche
          <span class="text-ink font-medium">{{ pendingClaim.name }}</span>{{ playerDetail(pendingClaim) }}.
          Tu ne pourras plus le faire toi-même ensuite — si ce n'est pas toi, choisis une autre fiche.
        </p>
        <div class="flex gap-3">
          <button
            class="flex-1 h-11 rounded-btn border border-line text-ink-secondary text-sm font-medium hover:text-ink transition-colors"
            :disabled="saving"
            @click="pendingClaim = null"
          >
            Ce n'est pas moi
          </button>
          <button
            :disabled="saving"
            class="flex-1 h-11 rounded-btn bg-brand text-brand-soft text-sm font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors"
            @click="confirmClaim"
          >
            {{ saving ? 'Liaison…' : "Oui, c'est moi" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
