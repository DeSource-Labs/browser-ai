# browser-ai-kit

Vue and Nuxt helpers for Chrome built-in AI APIs, starting with the Prompt API powered by Gemini Nano in the browser.

## Status

The Prompt API implementation targets the current `LanguageModel` API:

- `LanguageModel.availability()`
- `LanguageModel.create()`
- `session.prompt()` and `session.promptStreaming()`
- `session.measureContextUsage()`
- `session.contextUsage` and `session.contextWindow`
- `contextoverflow` events
- `responseConstraint` prompt options for structured output

Deprecated extension-only aliases such as `measureInputUsage`, `inputUsage`, `inputQuota`, and `quotaoverflow` are kept only as compatibility aliases where practical.

## Packages

- `@desource/browser-ai-vue`: Vue components and composables.
- `@desource/browser-ai-nuxt`: Nuxt module that auto-imports the Vue helpers and registers client components.

## Chrome Requirements

Use a desktop Chrome build with the built-in AI flags enabled. For localhost development, Chrome currently documents:

- `chrome://flags/#optimization-guide-on-device-model`
- `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`

The API is available only in supported Chrome desktop environments and only when Gemini Nano is available for the current profile/device.

## Vue

```bash
npm install @desource/browser-ai-vue
```

```vue
<template>
  <PromptApi />
</template>

<script setup lang="ts">
import { PromptApi } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>
```

Composable usage:

```ts
import { usePromptApi } from '@desource/browser-ai-vue';

const ai = usePromptApi();

await ai.init({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
});

await ai.create();
const response = await ai.prompt('Reply with one short sentence.');
```

## Nuxt

```bash
npm install @desource/browser-ai-nuxt
```

```ts
export default defineNuxtConfig({
  modules: ['@desource/browser-ai-nuxt'],
});
```

The module registers `<PromptApi />`, `<BrowserAiPromptApi />`, `<BrowserAiChatHistory />`, `<BrowserAiChatSidebar />`, and `<BrowserAiPromptInput />` as client components. It also auto-imports `usePromptApi()` and `useAiChats()`.

## Demo

```bash
pnpm install
pnpm dev:demo
```

Open `http://localhost:3000` in Chrome with the built-in AI flags enabled.

## Verification

```bash
pnpm --filter @desource/browser-ai-vue typecheck
pnpm --filter @desource/browser-ai-vue build
pnpm --filter @desource/browser-ai-nuxt build
pnpm build:demo
pnpm lint
```

## Roadmap

- Add the remaining Chrome built-in AI APIs: Summarizer, Translator, Language Detector, Writer, Rewriter, and Proofreader.
- Add framework packages for React and plain TypeScript once the Prompt API surface is stable.
- Add automated browser smoke tests that can attach to a Chrome profile with Gemini Nano enabled.
