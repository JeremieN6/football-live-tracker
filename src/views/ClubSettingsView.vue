<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Upload } from 'lucide-vue-next'
import { useClubsStore } from '@/stores/clubs.store'
import { extractErrorMessage } from '@/lib/errors'
import ClubCrest from '@/components/ClubCrest.vue'

const router = useRouter()
const clubsStore = useClubsStore()

const name = ref('')
const foundedYear = ref('')
const location = ref('')
const logoUrl = ref('')
const loading = ref(true)
const saving = ref(false)
const uploadingLogo = ref(false)
const dragOver = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    const club = await clubsStore.ensureClub()
    if (!clubsStore.isOwner) {
      errorMessage.value = 'Seul le propriétaire du club peut modifier ces informations.'
      return
    }
    name.value = club.name
    foundedYear.value = club.foundedYear ? String(club.foundedYear) : ''
    location.value = club.location ?? ''
    logoUrl.value = club.logoUrl ?? ''
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors du chargement du club.')
  } finally {
    loading.value = false
  }
})

async function handleFile(file: File | undefined | null) {
  if (!file) return
  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Le logo doit être une image (PNG, JPG, SVG...).'
    return
  }
  errorMessage.value = null
  uploadingLogo.value = true
  try {
    const url = await clubsStore.uploadLogo(file)
    logoUrl.value = url
    await clubsStore.updateClubInfo({
      name: name.value.trim() || clubsStore.club!.name,
      foundedYear: clubsStore.club!.foundedYear,
      location: clubsStore.club!.location,
      logoUrl: url,
    })
    successMessage.value = 'Logo mis à jour.'
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, "Erreur lors de l'envoi du logo.")
  } finally {
    uploadingLogo.value = false
  }
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  handleFile(event.dataTransfer?.files?.[0])
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  handleFile(input.files?.[0])
  input.value = ''
}

async function handleSubmit() {
  errorMessage.value = null
  successMessage.value = null
  if (!name.value.trim()) {
    errorMessage.value = 'Le nom du club est requis.'
    return
  }
  const yearTrimmed = String(foundedYear.value).trim()
  const yearValue = yearTrimmed ? Number(yearTrimmed) : null
  if (yearTrimmed && (!Number.isInteger(yearValue) || yearValue! < 1850 || yearValue! > 2100)) {
    errorMessage.value = 'Année de fondation invalide.'
    return
  }

  saving.value = true
  try {
    await clubsStore.updateClubInfo({
      name: name.value.trim(),
      foundedYear: yearValue,
      location: location.value.trim() || null,
      logoUrl: logoUrl.value.trim() || null,
    })
    successMessage.value = 'Informations enregistrées.'
  } catch (err: unknown) {
    errorMessage.value = extractErrorMessage(err, 'Erreur lors de l\'enregistrement.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-app flex flex-col text-ink">

    <div class="flex-none flex items-center gap-1 px-4 pt-3.5 pb-2">
      <button class="p-1 -ml-1 text-ink-meta hover:text-ink transition-colors" @click="router.push({ name: 'home' })">
        <ArrowLeft :size="18" :stroke-width="2" />
      </button>
      <h1 class="text-[20px] font-semibold text-ink">Réglages du club</h1>
    </div>

    <main class="flex-1 px-4 pb-8 max-w-sm w-full mx-auto">

      <div v-if="loading" class="py-10 text-center text-sm text-ink-meta">Chargement…</div>

      <p v-else-if="errorMessage && !clubsStore.isOwner" class="text-sm text-ink-secondary bg-surface border border-line rounded-card px-3 py-3">
        {{ errorMessage }}
      </p>

      <form v-else class="flex flex-col gap-3.5 mt-2" @submit.prevent="handleSubmit">

        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary">Logo du club</label>
          <div class="flex items-center gap-3">
            <ClubCrest :logo-url="logoUrl || null" :name="name" />
            <label
              class="flex-1 flex flex-col items-center justify-center gap-1 h-[65px] rounded-input border border-dashed text-center cursor-pointer transition-colors"
              :class="dragOver ? 'border-brand bg-brand-soft' : 'border-line text-ink-meta hover:border-line-strong'"
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="onDrop"
            >
              <Upload :size="16" :stroke-width="2" />
              <span class="text-[11px]">{{ uploadingLogo ? 'Envoi…' : 'Glisser une image ou cliquer' }}</span>
              <input type="file" accept="image/*" class="hidden" :disabled="uploadingLogo" @change="onFileInput" />
            </label>
          </div>
          <input
            v-model="logoUrl"
            type="url"
            placeholder="Ou coller une URL d'image (.png, .jpg, .svg...)"
            class="h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta text-sm outline-none focus:border-brand transition-colors"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary" for="club-name">Nom du club</label>
          <input
            id="club-name"
            v-model="name"
            type="text"
            required
            maxlength="80"
            class="h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta text-sm outline-none focus:border-brand transition-colors"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary" for="club-founded">Année de fondation</label>
          <input
            id="club-founded"
            v-model="foundedYear"
            type="number"
            inputmode="numeric"
            min="1850"
            max="2100"
            placeholder="Ex : 1924"
            class="h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta text-sm outline-none focus:border-brand transition-colors"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium tracking-[.5px] text-ink-secondary" for="club-location">Localisation</label>
          <input
            id="club-location"
            v-model="location"
            type="text"
            maxlength="80"
            placeholder="Ex : Seine-Saint-Denis"
            class="h-11 px-3 rounded-input bg-surface-sub border border-line text-ink placeholder:text-ink-meta text-sm outline-none focus:border-brand transition-colors"
          />
        </div>

        <p v-if="errorMessage" class="text-[13px] text-danger bg-danger-soft border border-danger-line rounded-input px-2.5 py-2">
          {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="text-[13px] text-brand-ink bg-brand-soft border border-brand-line rounded-input px-2.5 py-2">
          {{ successMessage }}
        </p>

        <button
          type="submit"
          :disabled="saving"
          class="h-12 rounded-btn bg-brand text-brand-soft font-semibold text-sm hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
        >
          <span v-if="saving">Enregistrement…</span>
          <span v-else>Enregistrer</span>
        </button>
      </form>
    </main>
  </div>
</template>
