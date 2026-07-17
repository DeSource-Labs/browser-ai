<template>
  <div
    class="glass-surface"
    :class="{ 'glass-surface--actionable': actionable }"
    :style="containerStyles"
  >
    <div class="glass-surface__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";

interface Props {
  actionable?: boolean;
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  style?: CSSProperties;
}

const props = withDefaults(defineProps<Props>(), {
  actionable: false,
  width: "unset",
  height: "unset",
  borderRadius: 20,
  style: () => ({}),
});

const containerStyles = computed<CSSProperties>(() => ({
  ...props.style,
  width: typeof props.width === "number" ? `${props.width}px` : props.width,
  height: typeof props.height === "number" ? `${props.height}px` : props.height,
  borderRadius: `${props.borderRadius}px`,
}));
</script>
