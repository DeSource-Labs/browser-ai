# @desource/browser-ai-vue

Vue components and composables for Chrome built-in AI APIs.

## Install

```bash
npm install @desource/browser-ai-vue
```

## Prompt API Component

```vue
<template>
  <PromptApi context-strategy="summarize" />
</template>

<script setup lang="ts">
import { PromptApi } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>
```

`PromptApi` provides a complete local chat UI backed by Chrome's `LanguageModel` Prompt API. It stores chats in IndexedDB, restores context with `initialPrompts`, streams responses, tracks `contextUsage/contextWindow`, and avoids creating an empty saved chat until the first user prompt is sent.

When a saved chat is restored, the component shows a loading state while `usePromptApi().restoreSession()` checks availability, measures history, optionally summarizes older messages, and starts the final browser AI session. The input is disabled during this phase with an explicit status message instead of silently blocking typing. Summarization uses separate temporary `LanguageModel` sessions that are destroyed before the final restored chat session is created.

Restore summaries are incremental and cached per chat. The composable summarizes only the older prefix that does not fit beside the latest turns, splits that prefix into measured `contextWindow` chunks, stores summaries in IndexedDB with message-range fingerprints, and reuses cached summaries when those messages have not changed. If the combined chunk summaries are still too large, it creates cached rollup summaries until the summary plus latest turns fit.

During an active chat, Chrome may emit `contextoverflow` when the live session has to drop older prompt/response pairs to continue. `PromptApi` does not show a blocking overflow dialog by default. Instead, it marks the session for compaction, finishes the current response, then rebuilds a fresh `LanguageModel` session from the saved chat using summarized older context. It also proactively compacts before a send when available context falls below the configured threshold.

Context restore options:

- `contextStrategy`: `'summarize'` by default. Use `'recent'` to skip summarization and keep only the newest messages that fit.
- `contextBudgetRatio`: `0.88` by default, leaving headroom for the next prompt.
- `contextSummaryChunkBudgetRatio`: `0.18` by default, keeping each temporary summarization request small enough for responsive local-model restores.
- `contextSummaryMaxCharacters`: `0` by default, meaning no character truncation before summarization. Set a positive value only if you need a hard cap for very large messages.
- `contextSummaryTimeoutMs`: `15000` by default for restore-time eager summarization. On timeout, restore falls back to recent messages.
- `contextSummaryBackgroundTimeoutMs`: `60000` by default for cache-first background summary warming. It does not keep the input disabled.
- `autoCompactContext`: `true` by default, automatically rebuilding the active session after `contextoverflow`.
- `contextCompactionThresholdRatio`: `0.22` by default, proactively compacting before sends when the remaining context falls below 22% of the browser-reported window.
- `contextCompactionSummaryMode`: `'eager'` by default, so overflow recovery actually waits for compressed context before the next prompt.

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

Advanced restore helpers live in the composable too: `restoreSession()` performs measured chat hydration, and `promptWithTemporarySession()` is available for isolated one-off model tasks that should not consume the active chat session context.

## Summarizer Component

```vue
<template>
  <Summarizer
    type="key-points"
    format="markdown"
    length="medium"
  />
</template>

<script setup lang="ts">
import { Summarizer } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>
```

`Summarizer` provides a complete local summarization UI backed by Chrome's `Summarizer` API. It checks availability for the selected configuration, exposes download progress, measures input usage against `inputQuota`, supports context and shared context, and shows progress while large inputs are chunked and rolled up.

## Summarizer Composable

```ts
import { useSummarizer } from '@desource/browser-ai-vue';

const summarizer = useSummarizer();

await summarizer.requestAvailability({
  type: 'key-points',
  format: 'markdown',
  length: 'medium',
});

const result = await summarizer.summarizeWithDetails(articleText, {
  createOptions: {
    type: 'key-points',
    format: 'markdown',
    length: 'medium',
  },
  context: 'Audience: product engineers',
  stripHtml: true,
});

console.log(result.summary);
```

The composable keeps native API details in one place: availability, creation, abort handling, download monitoring, measuring, batch summarization, streaming summarization, cleanup, and long-input summarization. When a text is larger than the configured budget, it splits on paragraph and sentence boundaries, measures chunks with `measureInputUsage()`, summarizes each chunk, and recursively summarizes the chunk summaries until the final request fits.

## Exports

- `PromptApi`
- `PromptInput`
- `Summarizer`
- `ChatHistory`
- `ChatSidebar`
- `usePromptApi`
- `useSummarizer`
- `useAiChats`

The package uses `@types/dom-chromium-ai` for the current Chrome AI API types.
