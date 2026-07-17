<template>
  <div class="translator-demo">
    <LiquidGlass width="100%" height="100%">
      <div class="translator-demo__tool">
        <Translator
          v-model="source"
          placeholder="Paste text to translate between supported local Chrome language packs..."
          empty-output-message="Choose a language pair to prepare its local pack and translate this sample on-device."
        />
      </div>
    </LiquidGlass>
  </div>
</template>

<script setup lang="ts">
const source = ref(
  "Private AI should feel like a native product feature, not an infrastructure project.",
);
</script>

<style scoped>
.translator-demo {
  width: min(1920px, calc(100vw - 2rem));
  height: 100%;
  min-height: 0;
  pointer-events: all;
}

.translator-demo__tool {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0.5rem;
  box-sizing: border-box;
}

@media (max-width: 760px) {
  .translator-demo {
    width: min(100%, calc(100vw - 1rem));
  }

  .translator-demo__tool {
    padding: 0.35rem;
  }
}
</style>
