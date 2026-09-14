import { ref, computed, onUnmounted } from 'vue'
import type { Half } from '@/types/match.types'

// Durée réglementaire d'une mi-temps, au-delà de laquelle le chrono affiché
// se fige à 45:00 et un compteur de temps additionnel séparé démarre (comme
// à l'arbitrage réel — l'arbitre siffle la fin à un moment qu'on ne connaît
// pas à l'avance, donc le chrono continue de tourner en interne).
const HALF_LENGTH_SECONDS = 45 * 60

export function useTimer() {
  const seconds = ref(0)
  const running = ref(false)
  const half = ref<Half>(1)

  let intervalId: ReturnType<typeof setInterval> | null = null

  function start() {
    if (running.value) return
    running.value = true
    intervalId = setInterval(() => {
      seconds.value++
    }, 1000)
  }

  function pause() {
    if (!running.value) return
    running.value = false
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function switchHalf() {
    pause()
    half.value = 2
    seconds.value = 0
  }

  function reset() {
    pause()
    seconds.value = 0
    half.value = 1
  }

  // Minute affichée (arrondie à l'entier supérieur, minimum 1) — continue au-delà
  // de 45 pour que les événements saisis en temps additionnel gardent la bonne minute réelle.
  const currentMinute = computed(() => Math.max(1, Math.ceil(seconds.value / 60)))

  const inAddedTime = computed(() => seconds.value > HALF_LENGTH_SECONDS)
  const addedTimeSeconds = computed(() => Math.max(0, seconds.value - HALF_LENGTH_SECONDS))
  // "+1'", "+2'"... dès que la minute additionnelle est entamée.
  const addedTimeDisplay = computed(() =>
    inAddedTime.value ? `+${Math.floor(addedTimeSeconds.value / 60) + 1}'` : null,
  )

  // Affichage MM:SS — se fige à 45:00 pendant le temps additionnel, le compteur
  // séparé (addedTimeDisplay) prend le relais visuellement.
  const display = computed(() => {
    const capped = Math.min(seconds.value, HALF_LENGTH_SECONDS)
    const m = Math.floor(capped / 60)
    const s = capped % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  })

  // Nettoyage automatique si le composant qui utilise useTimer est démonté
  onUnmounted(() => {
    if (intervalId !== null) clearInterval(intervalId)
  })

  return { seconds, running, half, currentMinute, display, inAddedTime, addedTimeDisplay, start, pause, switchHalf, reset }
}
