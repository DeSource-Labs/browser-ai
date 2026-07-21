<template>
  <div class="translator-demo">
    <Translator
      v-model="source"
      placeholder="Paste text to translate between supported local Chrome language packs..."
      empty-output-message="Choose a language pair to prepare its local pack and translate this sample on-device."
    />
  </div>
</template>

<script setup lang="ts">
const source = ref('Private AI should feel like a native product feature, not an infrastructure project.');
</script>

<style scoped>
.translator-demo {
  width: 100%;
  height: 100%;
  min-height: 0;
  pointer-events: all;
}
</style>
