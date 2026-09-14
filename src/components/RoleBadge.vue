<script setup lang="ts">
import { computed } from 'vue'
import { Crown, ClipboardList, UserCheck, Landmark, Layers, Footprints, User } from 'lucide-vue-next'
import { ROLE_BADGES } from '@/lib/roleBadge'
import type { MemberRole } from '@/stores/clubs.store'

const props = defineProps<{ role: MemberRole; pending?: boolean }>()

const style = computed(() => ROLE_BADGES[props.role])

const ICONS = {
  crown: Crown,
  'clipboard-list': ClipboardList,
  'user-check': UserCheck,
  landmark: Landmark,
  layers: Layers,
  footprints: Footprints,
  user: User,
} as const

const icon = computed(() => ICONS[style.value.icon])
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <span
      class="inline-flex items-center gap-1 h-[19px] px-2 rounded-full border font-data text-[9.5px] font-medium tracking-[.3px]"
      :style="{ background: style.bg, borderColor: style.border, color: style.fg }"
    >
      <component :is="icon" :size="11" :stroke-width="2" />
      {{ style.label }}
    </span>
    <span v-if="pending" class="font-data text-[9px] font-medium text-warning">en attente</span>
  </span>
</template>
