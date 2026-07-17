<template>
  <header class="header" :class="{ 'header--compact': compact }">
    <div class="header__title">
      <LiquidGlass actionable>
        <NuxtLink :to="leadingTo" class="examples">
          <span v-if="leadingIcon" class="emoji">{{ leadingIcon }}</span>
          {{ leadingLabel }}
        </NuxtLink>
      </LiquidGlass>
      <h1>{{ title }}</h1>
      <LiquidGlass actionable>
        <a
          class="stars"
          :href="Links.coreRepo"
          target="_blank"
          rel="noopener noreferrer"
        >
          Star on GitHub
        </a>
      </LiquidGlass>
    </div>
    <p class="header__subtitle h3">{{ subtitle }}</p>
  </header>
</template>

<script setup lang="ts">
interface Props {
  title?: string;
  subtitle?: string;
  leadingLabel?: string;
  leadingIcon?: string;
  leadingTo?: string;
  compact?: boolean;
}

withDefaults(defineProps<Props>(), {
  title: "Browser AI Kit",
  subtitle: "Production-ready Chrome built-in AI for Vue and Nuxt.",
  leadingLabel: "API directory",
  leadingIcon: "",
  leadingTo: "/",
  compact: false,
});
</script>
