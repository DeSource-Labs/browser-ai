# @desource/browser-ai-vue

Vue components and composables for Chrome built-in AI APIs.

## Install

```bash
npm install @desource/browser-ai-vue
```

## Prompt API Component

```vue
<template>
  <PromptApi />
</template>

<script setup lang="ts">
import { PromptApi } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>
```

`PromptApi` provides a complete local chat UI backed by Chrome's `LanguageModel` Prompt API. It stores chats in IndexedDB, restores context with `initialPrompts`, streams responses, tracks `contextUsage/contextWindow`, and avoids creating an empty saved chat until the first user prompt is sent.

## Composable

```ts
import { usePromptApi } from '@desource/browser-ai-vue';

const ai = usePromptApi({
  onContextOverflow() {
    console.warn('Older context may be dropped.');
  },
});

await ai.init({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
});

await ai.create();

const stream = ai.promptStreaming('Write a short greeting.');
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Exports

- `PromptApi`
- `PromptInput`
- `ChatHistory`
- `ChatSidebar`
- `usePromptApi`
- `useAiChats`

The package uses `@types/dom-chromium-ai` for the current Chrome AI API types.
