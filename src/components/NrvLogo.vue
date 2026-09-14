<script setup lang="ts">
import { computed } from 'vue'

type LogoSize = 'compact' | 'medium' | 'large'

// `width` permet un format ponctuel (ex. 98×42 sur AuthView) sans ajouter une 4e
// variante figée : le ratio 120:52 du viewBox est toujours respecté.
const props = withDefaults(defineProps<{ size?: LogoSize; width?: number }>(), { size: 'medium' })

const dimensions: Record<LogoSize, { width: number; height: number }> = {
  compact: { width: 36, height: 16 },
  medium: { width: 52, height: 22 },
  large: { width: 120, height: 52 },
}

const dims = computed(() => {
  if (props.width) return { width: props.width, height: Math.round((props.width * 52) / 120) }
  return dimensions[props.size]
})
</script>

<template>
  <svg :width="dims.width" :height="dims.height" viewBox="0 0 120 52" role="img" aria-label="NRV">
    <g fill="none" stroke="#16A34A" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M8 21 V14 L19 3 H42" />
      <path d="M78 49 H101 L112 38 V31" />
    </g>
    <text
      x="60"
      y="36"
      text-anchor="middle"
      font-family="'Space Mono', 'IBM Plex Mono', monospace"
      font-size="31"
      font-weight="700"
      letter-spacing="-2.2"
      fill="#F9FAFB"
    >NRV</text>
  </svg>
</template>
