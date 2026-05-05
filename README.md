# browser-ai-kit

Vue and Nuxt helpers for Chrome built-in AI APIs, starting with Prompt API, Summarizer API, Writer API, and Rewriter API powered by Gemini Nano in the browser.

## Status

The Prompt API implementation targets the current `LanguageModel` API:

- `LanguageModel.availability()`
- `LanguageModel.create()`
- `session.prompt()` and `session.promptStreaming()`
- `session.measureContextUsage()`
- `session.contextUsage` and `session.contextWindow`
- `contextoverflow` events
- `responseConstraint` prompt options for structured output

The Summarizer implementation targets the current `Summarizer` API:

- `Summarizer.availability()`
- `Summarizer.create()`
- `summarizer.summarize()` and `summarizer.summarizeStreaming()`
- `summarizer.measureInputUsage()`
- `summarizer.inputQuota`
- `type`, `format`, `length`, `preference`, language, shared context, and per-run context options

The Writer implementation targets the current `Writer` API:

- `Writer.availability()`
- `Writer.create()`
- `writer.write()` and `writer.writeStreaming()`
- `writer.measureInputUsage()`
- `writer.inputQuota`
- `tone`, `format`, `length`, language, shared context, and per-run context options

The Rewriter implementation targets the current `Rewriter` API:

- `Rewriter.availability()`
- `Rewriter.create()`
- `rewriter.rewrite()` and `rewriter.rewriteStreaming()`
- `rewriter.measureInputUsage()`
- `rewriter.inputQuota`
- `tone`, `format`, `length`, language, shared context, and per-run context options

## Packages

- `@desource/browser-ai-vue`: Vue components and composables.
- `@desource/browser-ai-nuxt`: Nuxt module that auto-imports the Vue helpers and registers client components.

## Chrome Requirements

Use a desktop Chrome build with the built-in AI flags enabled. For localhost development, Chrome currently documents:

- `chrome://flags/#optimization-guide-on-device-model`
- `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
- `chrome://flags/#writer-api-for-gemini-nano`
- `chrome://flags/#rewriter-api-for-gemini-nano`

The API is available only in supported Chrome desktop environments and only when Gemini Nano is available for the current profile/device.

## Vue

```bash
npm install @desource/browser-ai-vue
```

```vue
<template>
  <PromptApi context-strategy="summarize" />
  <Summarizer />
  <Writer />
  <Rewriter />
</template>

<script setup lang="ts">
import { PromptApi, Rewriter, Summarizer, Writer } from '@desource/browser-ai-vue';
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

For restored chats, `<PromptApi />` delegates to `usePromptApi().restoreSession()`, which creates one final `LanguageModel` session with `initialPrompts`; it does not append messages one by one. Large histories are measured against the browser-reported `contextWindow` with a binary-search fit. When the full chat does not fit, the default `contextStrategy="summarize"` summarizes only the omitted older prefix, splits that prefix into measured chunks, stores chunk and rollup summaries in IndexedDB, and reuses unchanged cached summaries on later reloads. The default `contextSummaryMode="cache-first"` restores immediately with recent messages when summaries are missing, then warms the cache in the background so the input is not blocked by local summarization. During an active session, `contextoverflow` triggers automatic compaction into a fresh summarized session instead of showing a blocking overflow dialog.

Summarizer usage:

```ts
import { useSummarizer } from '@desource/browser-ai-vue';

const summarizer = useSummarizer();

const result = await summarizer.summarizeWithDetails(longText, {
  createOptions: { type: 'key-points', format: 'markdown', length: 'medium' },
  context: 'Audience: product engineers',
});
```

`useSummarizer()` measures input against `inputQuota` before summarizing. When input is too large for one native request, it splits text on paragraph/sentence boundaries, summarizes measured chunks, and recursively summarizes combined chunk summaries until a final summary fits.

Writer usage:

```ts
import { useWriter } from '@desource/browser-ai-vue';

const writer = useWriter();

const draft = await writer.writeStreamingToText('Write a concise launch email.', {
  createOptions: { tone: 'formal', format: 'markdown', length: 'medium' },
  context: 'Audience: existing customers who value privacy and local AI.',
  fitStrategy: 'truncate-context',
});
```

`useWriter()` preflights tasks with `measureInputUsage()`, streams drafts, supports reusable writer sessions, and can explicitly fit long context while preserving the user task.

Rewriter usage:

```ts
import { useRewriter } from '@desource/browser-ai-vue';

const rewriter = useRewriter();

const rewrite = await rewriter.rewriteStreamingToText('This update is kind of confusing but should work.', {
  createOptions: { tone: 'more-formal', format: 'plain-text', length: 'shorter' },
  context: 'Make the text clear for a customer success email.',
  fitStrategy: 'truncate-context',
});
```

`useWriter()` and `useRewriter()` share the same production path for availability, download monitoring, abort handling, input quota preflight, streaming, batch runs, and optional-context fitting.

## Nuxt

```bash
npm install @desource/browser-ai-nuxt
```

```ts
export default defineNuxtConfig({
  modules: ['@desource/browser-ai-nuxt'],
});
```

The module registers `<PromptApi />`, `<Summarizer />`, `<Writer />`, `<Rewriter />`, `<BrowserAiPromptApi />`, `<BrowserAiSummarizer />`, `<BrowserAiWriter />`, `<BrowserAiRewriter />`, `<BrowserAiChatHistory />`, `<BrowserAiChatSidebar />`, and `<BrowserAiPromptInput />` as client components. It also auto-imports `usePromptApi()`, `useSummarizer()`, `useWriter()`, `useRewriter()`, and `useAiChats()`.

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

- Add the remaining Chrome built-in AI APIs: Translator, Language Detector, and Proofreader.
- Add framework packages for React and plain TypeScript once the current API surfaces are stable.
- Add automated browser smoke tests that can attach to a Chrome profile with Gemini Nano enabled.
