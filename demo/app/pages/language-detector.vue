<template>
  <section class="page">
    <Header
      compact
      title="Language Detector API"
      :subtitle="languageDetector.description"
      leading-label="API directory"
      leading-icon=""
      leading-to="/"
    />
    <main class="page__main">
      <LanguageDetectorDemo />
    </main>
  </section>
</template>

<script setup lang="ts">
import "@desource/browser-ai-vue/assets/lib.css";

const languageDetector = ToolItems.find(
  (item) => item.id === "language-detector",
)!;
</script>

<style scoped>
.page {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  height: 100svh;
  width: 100svw;
  padding-bottom: 1rem;
}

.page__main {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1rem;
}

@media (max-width: 760px) {
  .page {
    padding-bottom: 0.5rem;
  }

  .page__main {
    padding: 0 0.5rem;
  }
}
</style>
