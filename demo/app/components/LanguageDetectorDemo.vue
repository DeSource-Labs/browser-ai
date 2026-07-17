<template>
  <div class="language-detector-demo">
    <LanguageDetector
      v-model="source"
      placeholder="Paste text to detect its language with Chrome's local model..."
      empty-output-message="Run detection to see ranked language candidates and confidence scores."
    />
  </div>
</template>

<script setup lang="ts">
const source = ref(
  "La inteligencia artificial privada puede ejecutarse directamente en el navegador, sin enviar el texto a un servidor de inferencia.",
);
</script>

<style scoped>
.language-detector-demo {
  width: 100%;
  height: 100%;
  min-height: 0;
  pointer-events: all;
}
</style>
