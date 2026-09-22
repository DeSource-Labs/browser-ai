<template>
  <div class="writer-demo">
    <Writer
      v-model="task"
      output-language="en"
      :expected-input-languages="['en']"
      placeholder="Describe the email, review, blog intro, support request, or draft you need..."
      empty-output-message="Your draft will stream here. Use Settings to choose tone, length, and output format."
    />
  </div>
</template>

<script setup lang="ts">
const task = ref(
  'Write a concise launch announcement for developers introducing Browser AI Kit. Lead with private on-device inference, mention the Vue, React, Svelte, Angular, Nuxt, and TypeScript packages, and close with an invitation to try the live Chrome demos.'
);
</script>

<style scoped>
.writer-demo {
  width: 100%;
  height: 100%;
  min-height: 0;
  pointer-events: all;
}
</style>
