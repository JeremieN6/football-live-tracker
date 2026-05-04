<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()

// Mode : 'login' ou 'register'
const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const loading = ref(false)

async function handleSubmit() {
  errorMessage.value = null
  successMessage.value = null
  loading.value = true

  try {
    if (mode.value === 'login') {
      await authStore.signIn(email.value, password.value)
      await router.push({ name: 'history' })
    } else {
      const needsConfirmation = await authStore.signUp(email.value, password.value)
      if (needsConfirmation) {
        // Supabase a envoyé un email de confirmation — on reste sur la page
        successMessage.value = 'Compte créé ! Vérifiez votre email pour confirmer votre inscription.'
      } else {
        // Confirmation email désactivée — session créée directement
        await router.push({ name: 'history' })
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      // Traduction des erreurs Supabase les plus courantes
      if (err.message.includes('Invalid login credentials')) {
        errorMessage.value = 'Email ou mot de passe incorrect.'
      } else if (err.message.includes('Email not confirmed')) {
        errorMessage.value = 'Email non confirmé. Vérifiez votre boîte mail.'
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
</script>

<template>
  <div class="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">

      <!-- Logo / Titre -->
      <div class="mb-10 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 mb-4">
          <svg viewBox="0 0 24 24" fill="none" class="w-6 h-6 text-white" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20M2 12h20M12 2c-2.5 3-4 6.3-4 10s1.5 7 4 10M12 2c2.5 3 4 6.3 4 10s-1.5 7-4 10" />
          </svg>
        </div>
        <h1 class="text-2xl font-semibold text-white tracking-tight">Match Report AI</h1>
        <p class="text-sm text-neutral-400 mt-1">
          {{ mode === 'login' ? 'Connectez-vous à votre compte' : 'Créez votre compte' }}
        </p>
      </div>

      <!-- Formulaire -->
      <form class="space-y-4" @submit.prevent="handleSubmit">

        <div class="space-y-1">
          <label class="text-sm font-medium text-neutral-300" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="vous@exemple.com"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-500
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all"
          />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-neutral-300" for="password">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
            class="w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-500
                   text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all"
          />
        </div>

        <!-- Message d'erreur -->
        <p v-if="errorMessage" class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {{ errorMessage }}
        </p>

        <!-- Message de succès (confirmation email) -->
        <p v-if="successMessage" class="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
          {{ successMessage }}
        </p>

        <!-- Bouton submit -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full h-11 rounded-lg bg-white text-neutral-900 font-semibold text-sm
                 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-white/30
                 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <span v-if="loading">Chargement...</span>
          <span v-else>{{ mode === 'login' ? 'Se connecter' : 'Créer le compte' }}</span>
        </button>
      </form>

      <!-- Toggle login / register -->
      <p class="mt-6 text-center text-sm text-neutral-500">
        {{ mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?' }}
        <button
          class="text-neutral-300 font-medium hover:text-white underline underline-offset-2 transition-colors ml-1"
          @click="toggleMode"
        >
          {{ mode === 'login' ? 'Créer un compte' : 'Se connecter' }}
        </button>
      </p>

    </div>
  </div>
</template>