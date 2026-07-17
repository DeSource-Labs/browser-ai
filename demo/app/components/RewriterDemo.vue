<template>
  <div class="rewriter-demo">
    <Rewriter
      v-model="source"
      placeholder="Paste text that should become clearer, shorter, longer, more formal, or more casual..."
      empty-output-message="The rewritten version will appear here. Pick a tone and length in Settings before running it."
    />
  </div>
</template>

<script setup lang="ts">
const source = ref(
  "Our library makes it easier for people who build applications with Vue to use all of the different artificial intelligence features that are already available inside the Chrome browser without having to write all of the complicated lifecycle code themselves.",
);
</script>

<style scoped>
.rewriter-demo {
  width: 100%;
  height: 100%;
  min-height: 0;
  pointer-events: all;
}
</style>
