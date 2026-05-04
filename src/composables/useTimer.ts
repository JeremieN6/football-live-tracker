import { ref, computed, onUnmounted } from 'vue'
import type { Half } from '@/types/match.types'

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

  // Minute affichée (arrondie à l'entier supérieur, minimum 1)
  const currentMinute = computed(() => Math.max(1, Math.ceil(seconds.value / 60)))

  // Affichage MM:SS
  const display = computed(() => {
    const m = Math.floor(seconds.value / 60)
    const s = seconds.value % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  })

  // Nettoyage automatique si le composant qui utilise useTimer est démonté
  onUnmounted(() => {
    if (intervalId !== null) clearInterval(intervalId)
  })

  return { seconds, running, half, currentMinute, display, start, pause, switchHalf, reset }
}
