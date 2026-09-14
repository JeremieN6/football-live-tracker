<script setup lang="ts">
import { computed } from 'vue'
import { deriveInitials } from '@/lib/displayName'

const props = withDefaults(defineProps<{
  logoUrl?: string | null
  name?: string | null
  size?: 'sm' | 'md'
}>(), {
  logoUrl: null,
  name: null,
  size: 'md',
})

const initials = computed(() => deriveInitials((props.name ?? '').replace(/\s+/, '.') || null))
</script>

<template>
  <img
    v-if="logoUrl"
    :src="logoUrl"
    alt=""
    class="flex-none rounded-[10px] object-cover border-2"
    :class="size === 'sm' ? 'w-9 h-9' : 'w-[58px] h-[65px]'"
    style="border-color: #16A34A"
  />
  <div
    v-else
    class="flex-none rounded-[10px] flex items-center justify-center border-2"
    :class="size === 'sm' ? 'w-9 h-9' : 'w-[58px] h-[65px]'"
    style="background: #0d2810; border-color: #16A34A"
  >
    <span class="font-score font-bold text-ink" :class="size === 'sm' ? 'text-sm' : 'text-lg'">{{ initials }}</span>
  </div>
</template>
