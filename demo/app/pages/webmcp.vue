<template>
  <section class="page">
    <Header
      compact
      title="WebMCP"
      :subtitle="webMcp.description"
      leading-label="API directory"
      leading-icon=""
      leading-to="/"
    />
    <main class="page__main">
      <WebMcpDemo />
    </main>
  </section>
</template>

<script setup lang="ts">
const webMcp = ToolItems.find((item) => item.id === "webmcp")!;
</script>

<style scoped>
.page {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  min-height: 100svh;
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
