import { ref, onMounted, onUnmounted } from 'vue'
import type { MatchEvent } from '@/types/match.types'
import { useEventsStore } from '@/stores/events.store'

const STORAGE_KEY = 'offline_queue'

// Charge la file depuis localStorage
function loadQueue(): MatchEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as MatchEvent[]) : []
  } catch {
    return []
  }
}

// Persiste la file dans localStorage
function saveQueue(queue: MatchEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export function useOfflineQueue() {
  const eventsStore = useEventsStore()
  const pendingCount = ref(loadQueue().length)

  // Flush : tente d'envoyer tous les événements en attente
  async function flush() {
    const queue = loadQueue()
    if (queue.length === 0) return

    const remaining: MatchEvent[] = []

    for (const event of queue) {
      try {
        // addEvent est déjà optimiste — on évite le double ajout au store
        await eventsStore.addEvent(event)
      } catch {
        // Toujours en erreur → on garde dans la file
        remaining.push(event)
      }
    }

    saveQueue(remaining)
    pendingCount.value = remaining.length
  }

  // Ajoute un événement : tente Supabase, sinon met en file
  async function addEventWithFallback(event: MatchEvent) {
    try {
      await eventsStore.addEvent(event)
    } catch {
      // Supabase inaccessible — on met en file d'attente
      const queue = loadQueue()
      if (!queue.find((e) => e.id === event.id)) {
        queue.push(event)
        saveQueue(queue)
        pendingCount.value = queue.length
      }
    }
  }

  // Écoute window.online pour flusher automatiquement
  function handleOnline() {
    flush()
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    // Tente un flush au montage si des événements sont en attente
    if (loadQueue().length > 0) flush()
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
  })

  return { pendingCount, addEventWithFallback, flush }
}
