<template>
  <div class="summarizer-demo">
    <Summarizer
      v-model="source"
      output-language="en"
      :expected-input-languages="['en']"
      placeholder="Paste a long article, transcript, document, or chat conversation to summarize..."
      empty-output-message="Your local summary will appear here. Adjust the format in Settings, then select Summarize."
    />
  </div>
</template>

<script setup lang="ts">
const source = ref(
  "Browser AI Kit gives Vue, React, Svelte, Angular, Nuxt, and TypeScript teams one production layer for Chrome's built-in AI. It keeps native sessions outside expensive framework reactivity and exposes downloads, quotas, cancellation, and errors as typed state. Long documents are measured against the browser's real token limits before they are split and merged. The package family includes accessible components for fast delivery and headless APIs for custom interfaces. Prompt, Summarizer, Writer, Rewriter, Translator, Language Detector, Proofreader, and WebMCP share a consistent lifecycle, while prompts and outputs remain on the user's device unless the host application deliberately adds a remote fallback."
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
