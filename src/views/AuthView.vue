<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import NrvLogo from '@/components/NrvLogo.vue'

const router = useRouter()
const authStore = useAuthStore()

// Mode : 'login' ou 'register' (mot de passe), ou 'magic' (lien par email,
// sans mot de passe — pensé pour un joueur invité qui n'a rien à retenir)
const mode = ref<'login' | 'register' | 'magic'>('login')
const email = ref('')
const password = ref('')
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const loading = ref(false)

async function handleSubmit() {
  errorMessage.value = null
  successMessage.value = null

  if (mode.value === 'magic') {
    if (!email.value.trim()) {
      errorMessage.value = 'Email requis.'
      return
    }
    loading.value = true
    try {
      await authStore.signInWithMagicLink(email.value.trim())
      successMessage.value = 'Lien envoyé — vérifie ta boîte mail et clique dessus pour te connecter.'
    } catch (err: unknown) {
      errorMessage.value = err instanceof Error ? err.message : 'Une erreur est survenue.'
    } finally {
      loading.value = false
    }
    return
  }

  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Email et mot de passe requis.'
    return
  }
  if (password.value.length < 6) {
    errorMessage.value = 'Mot de passe trop court — 6 caractères minimum.'
    return
  }

  loading.value = true
  try {
    if (mode.value === 'login') {
      await authStore.signIn(email.value, password.value)
      await router.push({ name: 'home' })
    } else {
      const needsConfirmation = await authStore.signUp(email.value, password.value)
      if (needsConfirmation) {
        // Supabase a envoyé un email de confirmation — on reste sur la page
        successMessage.value = 'Compte créé — vérifie ton email pour confirmer ton inscription.'
      } else {
        // Confirmation email désactivée — session créée directement
        await router.push({ name: 'home' })
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      // Traduction des erreurs Supabase les plus courantes
      if (err.message.includes('Invalid login credentials')) {
        errorMessage.value = 'Email ou mot de passe incorrect.'
      } else if (err.message.includes('Email not confirmed')) {
        errorMessage.value = 'Email non confirmé — vérifie ta boîte mail.'
      } else if (err.message.includes('User already registered')) {
        errorMessage.value = 'Un compte existe déjà avec cet email.'
      } else {
        errorMessage.value = err.message
      }
    } else {
      errorMessage.value = 'Une erreur est survenue.'
    }
  } finally {
    loading.value = false
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  errorMessage.value = null
  successMessage.value = null
}

function toggleMagic() {
  mode.value = mode.value === 'magic' ? 'login' : 'magic'
  errorMessage.value = null
  successMessage.value = null
}
</script>

<template>
  <div class="min-h-screen bg-app flex flex-col justify-center px-6">
    <div class="w-full max-w-sm mx-auto">

      <!-- Logo / Titre -->
      <div class="flex flex-col items-center gap-2.5 mb-[34px]">
        <NrvLogo :width="98" />
        <p class="text-[13px] font-medium text-ink-meta">Nouveau Rectangle Vert</p>
        <p class="font-score text-[13px] font-bold text-ink mt-0.5">
          Analyse tactique. <span class="text-brand">Niveau énervé.</span>
        </p>
      </div>

      <h1 class="text-[22px] font-semibold text-ink text-center mb-4">
        {{ mode === 'magic' ? 'Recevoir un lien' : mode === 'login' ? 'Connexion' : 'Rejoindre' }}
      </h1>

      <!-- Formulaire -->
      <form class="flex flex-col gap-3.5 bg-surface border border-line rounded-card p-5" @submit.prevent="handleSubmit">

        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="vous@exemple.com"
            class="h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                   text-sm outline-none focus:border-brand transition-colors"
          />
        </div>

        <div v-if="mode !== 'magic'" class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary" for="password">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
            class="h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta
                   text-sm outline-none focus:border-brand transition-colors"
          />
        </div>
        <p v-else class="text-xs text-ink-meta -mt-1">
          Pas de mot de passe : tu reçois un lien de connexion par email, valable pour une seule connexion.
        </p>

        <!-- Message d'erreur -->
        <p v-if="errorMessage" class="text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-2.5 py-2">
          {{ errorMessage }}
        </p>

        <!-- Message de succès (confirmation email / lien envoyé) -->
        <p v-if="successMessage" class="text-[13px] text-brand-ink bg-brand-soft border border-brand-line rounded-input px-2.5 py-2">
          {{ successMessage }}
        </p>

        <!-- CTA -->
        <button
          type="submit"
          :disabled="loading"
          class="h-12 rounded-btn bg-brand text-brand-soft font-semibold text-sm
                 hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand/40
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="loading">Chargement…</span>
          <span v-else-if="mode === 'magic'">Recevoir le lien</span>
          <span v-else>{{ mode === 'login' ? 'Se connecter' : 'Créer le compte' }}</span>
        </button>
      </form>

      <!-- Toggle login / register -->
      <p v-if="mode !== 'magic'" class="mt-[18px] text-center text-sm text-ink-meta">
        {{ mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?' }}
        <button
          type="button"
          class="text-ink-secondary font-medium underline underline-offset-2 hover:text-brand-ink transition-colors ml-1"
          @click="toggleMode"
        >
          {{ mode === 'login' ? 'Rejoindre' : 'Se connecter' }}
        </button>
      </p>

      <!-- Toggle lien magique -->
      <p class="mt-2 text-center text-sm text-ink-meta">
        <button
          type="button"
          class="text-ink-secondary font-medium underline underline-offset-2 hover:text-brand-ink transition-colors"
          @click="toggleMagic"
        >
          {{ mode === 'magic' ? 'Se connecter avec un mot de passe' : 'Ou recevoir un lien par email, sans mot de passe' }}
        </button>
      </p>

    </div>
  </div>
</template>
