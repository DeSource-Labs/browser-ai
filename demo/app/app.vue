<template>
  <div class="app-shell">
    <Background />
    <div class="app-content">
      <NuxtPage />
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100svh;
  isolation: isolate;
}

.app-content {
  position: relative;
  z-index: 1;
  min-height: 100svh;
}
</style>
