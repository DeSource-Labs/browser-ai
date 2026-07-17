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
          Star
          <span v-if="typeof stars === 'number'" class="star">
            <span class="emoji">⭐️</span> {{ stars }}
          </span>
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
  subtitle:
    "The ultimate toolkit for building AI-powered web applications with ease.",
  leadingLabel: "Examples",
  leadingIcon: "🔥",
  leadingTo: "/",
  compact: false,
});

const stars = useGhStars();
</script>
