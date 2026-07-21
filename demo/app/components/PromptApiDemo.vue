<template>
  <div class="prompt-demo">
    <PromptApi
      :initial-messages="starterMessages"
      placeholder="Ask about this project, draft copy, or test structured thinking..."
    />
  </div>
</template>

<script setup lang="ts">
const starterMessages = [
  {
    id: 'browser-ai-welcome',
    role: 'assistant' as const,
    content:
      'I run inside Chrome with no hosted inference endpoint. Ask me to explain an API, draft product copy, or transform some text.'
  }
];
</script>

<style scoped>
.prompt-demo {
  width: 100%;
  height: 100%;
  min-height: 0;
  pointer-events: all;
}
</style>
