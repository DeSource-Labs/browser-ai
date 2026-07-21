<template>
  <div class="summarizer-demo">
    <Summarizer
      v-model="source"
      placeholder="Paste a long article, transcript, document, or chat conversation to summarize..."
      empty-output-message="Your local summary will appear here. Adjust the format in Settings, then select Summarize."
    />
  </div>
</template>

<script setup lang="ts">
const source = ref(
  "Browser AI Kit gives Vue and Nuxt teams a production layer for Chrome's built-in AI. It keeps native sessions outside deep reactivity, coalesces streaming updates by animation frame, and exposes downloads, quotas, cancellation, and errors as typed state. Long documents are measured against the browser's real token limits before they are split and merged. The package includes accessible components for fast delivery and composables for product teams that need a custom interface. Prompt, Summarizer, Writer, Rewriter, Translator, Language Detector, Proofreader, and WebMCP share a consistent lifecycle, while prompts and outputs remain on the user's device unless the host application deliberately adds a remote fallback."
);
</script>

<style scoped>
.summarizer-demo {
  width: 100%;
  height: 100%;
  min-height: 0;
  pointer-events: all;
}
</style>
