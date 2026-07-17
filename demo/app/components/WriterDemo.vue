<template>
  <div class="writer-demo">
    <LiquidGlass width="100%" height="100%">
      <div class="writer-demo__tool">
        <Writer
          v-model="task"
          placeholder="Describe the email, review, blog intro, support request, or draft you need..."
          empty-output-message="Your draft will stream here. Use Settings to choose tone, length, and output format."
        />
      </div>
    </LiquidGlass>
  </div>
</template>

<script setup lang="ts">
const task = ref(
  "Write a concise launch announcement for developers introducing Browser AI Kit. Lead with private on-device inference, mention the ready-made Vue and Nuxt integrations, and close with an invitation to try the live Chrome demos.",
);
</script>

<style scoped>
.writer-demo {
  width: min(1920px, calc(100vw - 2rem));
  height: 100%;
  min-height: 0;
  pointer-events: all;
}

.writer-demo__tool {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0.5rem;
  box-sizing: border-box;
}

@media (max-width: 760px) {
  .writer-demo {
    width: min(100%, calc(100vw - 1rem));
  }

  .writer-demo__tool {
    padding: 0.35rem;
  }
}
</style>
