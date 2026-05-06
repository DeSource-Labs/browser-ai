# @desource/browser-ai-vue

Vue components and composables for Chrome built-in AI APIs.

## Install

```bash
npm install @desource/browser-ai-vue
```

## Chrome Model Management

Chrome stores built-in AI resources inside the current Chrome profile and manages downloads, updates, and deletion itself. The package can observe `availability()`, call `create()`, and display `downloadprogress`; it cannot list installed models, read model file paths, uninstall models, reset crash counts, toggle Chrome internals, or force Chrome to keep a model installed from JavaScript. Users can inspect and manage some Chrome-owned state manually in Chrome's internal pages.

| API | Local resource | Chrome page | Download trigger | Manual management |
| --- | --- | --- | --- | --- |
| Prompt API | Shared Gemini Nano model | `chrome://on-device-internals` | `LanguageModel.create()` | No documented per-API uninstall. Users can uninstall the shared foundational model and reset its crash count from Chrome internals; Chrome can also purge automatically under storage pressure, policy changes, or eligibility changes. |
| Summarizer | Shared Gemini Nano model | `chrome://on-device-internals` | `Summarizer.create()` | No separate Summarizer uninstall; it uses the shared Gemini Nano lifecycle. |
| Writer | Shared Gemini Nano model | `chrome://on-device-internals` | `Writer.create()` | No separate Writer uninstall; it uses the shared Gemini Nano lifecycle. |
| Rewriter | Shared Gemini Nano model | `chrome://on-device-internals` | `Rewriter.create()` | No separate Rewriter uninstall; it uses the shared Gemini Nano lifecycle. |
| Proofreader | Shared Gemini Nano model | `chrome://on-device-internals` | `Proofreader.create()` | No separate Proofreader uninstall; it uses the shared Gemini Nano lifecycle. |
| Translator | On-device translation language packs | `chrome://on-device-translation-internals/` | `Translator.create({ sourceLanguage, targetLanguage })` | Supported Chrome builds expose manual language-pack install/uninstall here. Direction can matter, so treat `en -> ru` and `ru -> en` as separate capabilities. |
| Language Detector | Small local language-detection model and language resources | `chrome://on-device-translation-internals/` for TranslateKit resources in supported Chrome builds | `LanguageDetector.create({ expectedInputLanguages })` | Chrome manages detector resources. Language coverage is browser-defined and not every BCP 47 language is supported. |

Notes:

- Availability states are Chrome-owned and reported as `available`, `downloadable`, `downloading`, or `unavailable`.
- Downloading resources requires a real user gesture when `availability()` returns `downloadable` or `downloading`.
- `chrome://on-device-internals` is for Gemini Nano debugging and event logs; it shows foundational model state, model name/version, backend type, file path, folder size, device criteria, feature adaptations, supplementary model status, shared model uninstall, and crash-count reset. It does not show Translator language packs.
- The Feature Adaptations `Recently Used` controls in `chrome://on-device-internals` are Chrome-internal debug/retention controls, not application-facing API enable/disable switches.
- Translator pair availability is privacy-masked by Chrome, so `availability()` may report `downloadable` until `create()` is called for a pair.
- Language Detector returns ranked candidates with confidence scores. Treat low-confidence results and `und` as unknown in product UI.
- Proofreader has no `inputQuota`, `measureInputUsage()`, or streaming method in `@types/dom-chromium-ai@0.0.16`; the package chunks long proofreader input by character boundaries.
- Exact storage paths are Chrome implementation details. App code should never depend on them.
- References: [Debug Gemini Nano](https://developer.chrome.com/docs/ai/debug-gemini-nano), [Chrome model management](https://developer.chrome.com/docs/ai/understand-built-in-model-management), [Translator API](https://developer.chrome.com/docs/ai/translator-api), [Language Detector API](https://developer.chrome.com/docs/ai/language-detection), [Proofreader API](https://developer.chrome.com/docs/ai/proofreader-api), [Translator playground](https://chrome.dev/web-ai-demos/built-in-ai-playground/translator-api/), [Language Detector playground](https://chrome.dev/web-ai-demos/built-in-ai-playground/language-detector-api/), [Proofreader API draft](https://webmachinelearning.github.io/proofreader-api/).

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

## Writer Component

```vue
<template>
  <Writer
    tone="formal"
    format="markdown"
    length="medium"
  />
</template>

<script setup lang="ts">
import { Writer } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>
```

`Writer` provides a local writing surface backed by Chrome's `Writer` API. It keeps task input and draft output visible, moves tone/length/format/context controls into settings, streams output by default, exposes download and token preflight state, and can fit long additional context without changing the user's writing task.

## Writer Composable

```ts
import { useWriter } from '@desource/browser-ai-vue';

const writer = useWriter();

await writer.requestAvailability({
  tone: 'formal',
  format: 'markdown',
  length: 'medium',
});

const draft = await writer.writeStreamingToText('Write a short product launch email.', {
  createOptions: {
    tone: 'formal',
    format: 'markdown',
    length: 'medium',
  },
  context: 'Audience: existing customers who care about privacy and local AI.',
  fitStrategy: 'truncate-context',
});

console.log(draft);
```

The composable wraps availability, creation, abort handling, download monitoring, input quota measurement, streaming and non-streaming writing, batch writing, cleanup, and explicit context fitting. By default it errors when a task plus context exceeds the configured budget; use `fitStrategy: 'truncate-context'` to preserve the task and fit only optional context.

## Rewriter Component

```vue
<template>
  <Rewriter
    tone="more-formal"
    format="plain-text"
    length="shorter"
  />
</template>

<script setup lang="ts">
import { Rewriter } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>
```

`Rewriter` provides a local revision surface backed by Chrome's `Rewriter` API. It keeps original and rewritten text side by side, moves tone/length/format/context controls into settings, streams output by default, exposes availability/download/token state, and can fit long rewrite guidance while preserving the source text.

## Rewriter Composable

```ts
import { useRewriter } from '@desource/browser-ai-vue';

const rewriter = useRewriter();

await rewriter.requestAvailability({
  tone: 'more-formal',
  format: 'plain-text',
  length: 'shorter',
});

const rewrite = await rewriter.rewriteStreamingToText('This message is too informal for the release note.', {
  createOptions: {
    tone: 'more-formal',
    format: 'plain-text',
    length: 'shorter',
  },
  context: 'Audience: enterprise administrators.',
  fitStrategy: 'truncate-context',
});

console.log(rewrite);
```

`useRewriter()` shares the same writing-assistant engine as `useWriter()`: availability, creation, abort handling, download monitoring, input quota measurement, streaming and non-streaming runs, batch rewriting, cleanup, and explicit optional-context fitting are implemented once.

## Translator Component

```vue
<template>
  <Translator />
</template>

<script setup lang="ts">
import { Translator } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>
```

`Translator` provides a local translation surface backed by Chrome's `Translator` API. It starts without a default language pair, keeps source and translated text side by side, exposes source/target language selectors, automatically translates debounced input once a pair is available, shows an explicit download button when Chrome needs a language-pack user gesture, streams translations by default, reports language-pack download and token state, bypasses same-language requests, and can chunk long input instead of failing once a native request is too large.

## Translator Composable

```ts
import { useTranslator } from '@desource/browser-ai-vue';

const translator = useTranslator({
  sourceLanguage: 'en',
  targetLanguage: 'fr',
});

await translator.requestAvailability({
  sourceLanguage: 'en',
  targetLanguage: 'fr',
});

const translated = await translator.translateStreamingToText('Where is the next bus stop?', {
  createOptions: {
    sourceLanguage: 'en',
    targetLanguage: 'fr',
  },
  chunking: 'auto',
  stripHtml: true,
});

console.log(translated);
```

The composable wraps availability, creation, abort handling, language-pack download monitoring, input quota measurement, streaming and non-streaming translation, batch translation, cleanup, same-language bypass, and measured long-text chunking. The package also exports `TRANSLATOR_LANGUAGE_OPTIONS` and `getTranslatorLanguageName()` for custom UIs.

## Language Detector Component

```vue
<template>
  <LanguageDetector :expected-input-languages="['en', 'fr', 'de']" />
</template>

<script setup lang="ts">
import { LanguageDetector } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>
```

`LanguageDetector` provides a local language identification surface backed by Chrome's `LanguageDetector` API. It keeps the input and ranked confidence results visible, exposes expected-language hints, confidence thresholds, HTML stripping, long-input strategy, download progress, and token usage.

## Language Detector Composable

```ts
import { useLanguageDetector } from '@desource/browser-ai-vue';

const detector = useLanguageDetector({
  expectedInputLanguages: ['en', 'fr', 'de'],
});

await detector.requestAvailability({
  expectedInputLanguages: ['en', 'fr', 'de'],
});

const result = await detector.detectWithDetails('Bonjour et bienvenue dans notre application.', {
  minConfidence: 0.45,
  maxResults: 5,
  largeInputStrategy: 'chunk',
  stripHtml: true,
});

console.log(result.detectedLanguage, result.confidence, result.results);
```

The composable wraps availability, creation, abort handling, download monitoring, input quota measurement, ranked confidence normalization, batch detection, cleanup, confidence thresholding, and measured long-input chunking. For text that exceeds the native quota, it can detect language per chunk and merge weighted confidence scores instead of truncating the input.

## Proofreader Component

```vue
<template>
  <Proofreader :expected-input-languages="['en']" />
</template>

<script setup lang="ts">
import { Proofreader } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>
```

`Proofreader` provides a local proofreading surface backed by Chrome's `Proofreader` API. It keeps the draft and corrected text side by side, exposes expected-language hints, optional correction labels/explanations, HTML stripping, long-input splitting, download progress, highlighted edits, and a correction list.

## Proofreader Composable

```ts
import { useProofreader } from '@desource/browser-ai-vue';

const proofreader = useProofreader({
  expectedInputLanguages: ['en'],
});

await proofreader.requestAvailability({
  expectedInputLanguages: ['en'],
});

const result = await proofreader.proofreadWithDetails(
  'I seen him yesterday at the store, and he bought two loafs of bread.',
  {
    largeInputStrategy: 'auto',
    stripHtml: true,
  }
);

console.log(result.correctedInput, result.corrections);
```

The composable wraps availability, creation, abort handling, download monitoring, corrected-output normalization, correction range normalization, batch proofreading, cleanup, and character-based long-input chunking. The current `@types/dom-chromium-ai@0.0.16` Proofreader surface does not include `inputQuota`, `measureInputUsage()`, or streaming, so those are not required for normal Proofreader usage.

## Exports

- `LanguageDetector`
- `Proofreader`
- `PromptApi`
- `PromptInput`
- `Rewriter`
- `Summarizer`
- `Translator`
- `Writer`
- `ChatHistory`
- `ChatSidebar`
- `usePromptApi`
- `useLanguageDetector`
- `useProofreader`
- `useRewriter`
- `useSummarizer`
- `useTranslator`
- `useWriter`
- `useAiChats`
- `TRANSLATOR_LANGUAGE_OPTIONS`
- `getTranslatorLanguageName`
- `LANGUAGE_DETECTOR_LANGUAGE_OPTIONS`
- `getLanguageDetectorLanguageName`
- `PROOFREADER_LANGUAGE_OPTIONS`
- `getProofreaderLanguageName`

The package uses `@types/dom-chromium-ai` for the current Chrome AI API types.
