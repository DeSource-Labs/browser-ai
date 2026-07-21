<template>
  <div class="proofreader-demo">
    <Proofreader
      v-model="source"
      placeholder="Paste text to correct grammar, spelling, and punctuation with Chrome's local model..."
      empty-output-message="Run Proofread to review the corrected text and each suggested change side by side."
    />
  </div>
</template>

<script setup lang="ts">
const source = ref(
  'Browser AI Kit make local AI features easier to ship. It handle model downloads, streaming and long documents so your users gets a fast and private experience.'
);
</script>

<style scoped>
.proofreader-demo {
  width: 100%;
  height: 100%;
  min-height: 0;
  pointer-events: all;
}
</style>
