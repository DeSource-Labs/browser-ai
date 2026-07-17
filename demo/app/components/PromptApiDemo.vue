<template>
  <div class="prompt-demo">
    <LiquidGlass width="100%" height="100%">
      <div class="prompt-demo__tool">
        <PromptApi
          :initial-messages="starterMessages"
          placeholder="Ask about this project, draft copy, or test structured thinking..."
        />
      </div>
    </LiquidGlass>
  </div>
</template>

<script setup lang="ts">
const starterMessages = [
  {
    id: "browser-ai-welcome",
    role: "assistant" as const,
    content:
      "I run inside Chrome with no hosted inference endpoint. Ask me to explain an API, draft product copy, or transform some text.",
  },
];
</script>

<style scoped>
.prompt-demo {
  width: min(1920px, calc(100vw - 2rem));
  height: 100%;
  min-height: 0;
  pointer-events: all;
}

.prompt-demo__tool {
  height: 100%;
  width: 100%;
  min-height: 0;
  padding: 0.5rem;
}

@media (max-width: 760px) {
  .prompt-demo {
    width: min(100%, calc(100vw - 1rem));
  }

  .prompt-demo__tool {
    padding: 0.35rem;
  }
}
</style>
