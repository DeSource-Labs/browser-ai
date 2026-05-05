# browser-ai-kit

Vue and Nuxt helpers for Chrome built-in AI APIs, starting with Prompt API, Summarizer API, Writer API, Rewriter API, Translator API, Language Detector API, and Proofreader API powered by local Chrome AI models.

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

The Translator implementation targets the current `Translator` API:

- `Translator.availability()`
- `Translator.create({ sourceLanguage, targetLanguage })`
- `translator.translate()` and `translator.translateStreaming()`
- `translator.measureInputUsage()`
- `translator.inputQuota`
- BCP 47 source/target language pair options

The Language Detector implementation targets the current `LanguageDetector` API:

- `LanguageDetector.availability({ expectedInputLanguages })`
- `LanguageDetector.create({ expectedInputLanguages })`
- `detector.detect()`
- `detector.measureInputUsage()`
- `detector.inputQuota`
- ranked `{ detectedLanguage, confidence }` results and BCP 47 expected-language hints

The Proofreader implementation targets the current `Proofreader` API from `@types/dom-chromium-ai@0.0.16`:

- `Proofreader.availability({ expectedInputLanguages })`
- `Proofreader.create({ expectedInputLanguages, includeCorrectionTypes, includeCorrectionExplanations, correctionExplanationLanguage })`
- `proofreader.proofread()`
- `proofreader.expectedInputLanguages`
- `proofreader.includeCorrectionTypes`, `proofreader.includeCorrectionExplanations`, and `proofreader.correctionExplanationLanguage`
- `correctedInput`, correction ranges, optional correction types, and optional explanations

## Packages

- `@desource/browser-ai-vue`: Vue components and composables.
- `@desource/browser-ai-nuxt`: Nuxt module that auto-imports the Vue helpers and registers client components.

## Chrome Requirements

Use a desktop Chrome build with the built-in AI flags enabled. For localhost development, Chrome currently documents:

- `chrome://flags/#optimization-guide-on-device-model`
- `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
- `chrome://flags/#writer-api-for-gemini-nano`
- `chrome://flags/#rewriter-api-for-gemini-nano`
- `chrome://flags/#translation-api`
- `chrome://flags/#language-detection-api`
- `chrome://flags/#proofreader-api-for-gemini-nano`

Prompt API, Summarizer, Writer, Rewriter, and Proofreader require Gemini Nano to be available for the current Chrome profile/device. Translator uses Chrome's on-device translation language packs instead of the Gemini Nano model lifecycle. Language Detector uses a small local language-detection model and related language resources.

## Chrome Model Management

Chrome owns the storage, update, and deletion lifecycle for built-in AI models. Browser AI Kit cannot list installed models, pin models, uninstall models, or read model file paths from JavaScript. Use the Chrome internal pages below while debugging a local profile.

| API | Chrome resource | Inspect or manage in Chrome | Install trigger | Uninstall / purge behavior |
| --- | --- | --- | --- | --- |
| Prompt API | Gemini Nano base model | `chrome://on-device-internals` for model/debug state and event logs | `LanguageModel.create()` from a meaningful user interaction when `LanguageModel.availability()` is `downloadable` | No documented per-API uninstall. Chrome can purge the shared model automatically under storage pressure, policy changes, or eligibility changes. Disabling the related flags/policies or using a fresh Chrome profile prevents reuse. |
| Summarizer | Gemini Nano base model, shared with Prompt API, plus API-specific runtime configuration | `chrome://on-device-internals` | `Summarizer.create()` from a user interaction when `Summarizer.availability()` is `downloadable` | Same shared Gemini Nano lifecycle; there is no separate Summarizer model to uninstall from web code. |
| Writer | Gemini Nano base model, shared with Prompt API, plus API-specific runtime configuration | `chrome://on-device-internals` | `Writer.create()` from a user interaction when `Writer.availability()` is `downloadable` | Same shared Gemini Nano lifecycle; there is no separate Writer model to uninstall from web code. |
| Rewriter | Gemini Nano base model, shared with Prompt API, plus API-specific runtime configuration | `chrome://on-device-internals` | `Rewriter.create()` from a user interaction when `Rewriter.availability()` is `downloadable` | Same shared Gemini Nano lifecycle; there is no separate Rewriter model to uninstall from web code. |
| Proofreader | Gemini Nano base model, shared with Prompt API, plus API-specific runtime configuration | `chrome://on-device-internals` | `Proofreader.create()` from a user interaction when `Proofreader.availability()` is `downloadable` | Same shared Gemini Nano lifecycle; there is no separate Proofreader model to uninstall from web code. |
| Translator | On-device translation language packs for a `sourceLanguage` and `targetLanguage` pair | `chrome://on-device-translation-internals/` for manual language-pack install/uninstall in supported Chrome builds | `Translator.create({ sourceLanguage, targetLanguage })` from a real user gesture when `Translator.availability()` is `downloadable` | Manage packs in `chrome://on-device-translation-internals/`. Chrome may also evict packs automatically. Treat `en -> ru` and `ru -> en` as separate API capabilities. |
| Language Detector | Small local language-detection model and language resources | `chrome://on-device-translation-internals/` exposes TranslateKit language resources in supported Chrome builds; use `LanguageDetector.availability()` for detector readiness | `LanguageDetector.create({ expectedInputLanguages })` from a real user gesture when `LanguageDetector.availability()` is `downloadable` | Chrome manages detector resources. Language coverage is browser-defined, and not every BCP 47 language is supported. |

Important Chrome behavior:

- `available`, `downloadable`, `downloading`, and `unavailable` are browser-owned states returned by each API's `availability()` method.
- `create()` is the operation that prepares a usable local session and starts downloads when needed.
- Downloadable or downloading resources require a real user activation. Programmatic `.click()` calls from tests are not enough.
- Translator availability is intentionally privacy-masked. Chrome may report language pairs as `downloadable` until the site creates a translator for that pair, even if related language resources already exist.
- Language Detector returns ranked candidates with confidence scores. Very short text and unsupported languages should be treated as `und`/unknown below your chosen confidence threshold.
- Proofreader currently has no `inputQuota`, `measureInputUsage()`, or streaming method in `@types/dom-chromium-ai@0.0.16`; Browser AI Kit chunks long proofreader input by character boundaries.
- `chrome://on-device-internals` does not show Translator language packs. Use `chrome://on-device-translation-internals/` for Translator.
- Model and language-pack files are stored in Chrome-managed profile storage. Exact paths are implementation details and should not be used by apps.
- Chrome can remove Gemini Nano when free disk space drops below its threshold or when policies/eligibility change; after purge, a later `create()` must trigger a new download.

References: [Prompt API](https://developer.chrome.com/docs/ai/prompt-api), [Debug Gemini Nano](https://developer.chrome.com/docs/ai/debug-gemini-nano), [Chrome model management](https://developer.chrome.com/docs/ai/understand-built-in-model-management), [Translator API](https://developer.chrome.com/docs/ai/translator-api), [Language Detector API](https://developer.chrome.com/docs/ai/language-detection), [Proofreader API](https://developer.chrome.com/docs/ai/proofreader-api), [Translator playground](https://chrome.dev/web-ai-demos/built-in-ai-playground/translator-api/), [Language Detector playground](https://chrome.dev/web-ai-demos/built-in-ai-playground/language-detector-api/), [Proofreader API draft](https://webmachinelearning.github.io/proofreader-api/).

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
  <Translator />
  <LanguageDetector />
  <Proofreader />
</template>

<script setup lang="ts">
import { LanguageDetector, Proofreader, PromptApi, Rewriter, Summarizer, Translator, Writer } from '@desource/browser-ai-vue';
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

Translator usage:

```ts
import { useTranslator } from '@desource/browser-ai-vue';

const translator = useTranslator({
  sourceLanguage: 'en',
  targetLanguage: 'fr',
});

const translated = await translator.translateStreamingToText('Where is the next bus stop?', {
  createOptions: { sourceLanguage: 'en', targetLanguage: 'fr' },
  chunking: 'auto',
});
```

`useTranslator()` checks language-pair availability, reports language-pack download progress, bypasses same-language translations, measures input quota, chunks long text on paragraph/sentence boundaries, streams output, and supports batch translation.

Language Detector usage:

```ts
import { useLanguageDetector } from '@desource/browser-ai-vue';

const detector = useLanguageDetector({
  expectedInputLanguages: ['en', 'fr', 'de'],
});

const result = await detector.detectWithDetails('Bonjour et bienvenue dans notre application.', {
  minConfidence: 0.45,
  largeInputStrategy: 'chunk',
});
```

`useLanguageDetector()` checks detector availability, reports download progress, measures input quota, filters low-confidence results, returns ranked language candidates, chunks long input and merges weighted confidences, and supports batch detection.

Proofreader usage:

```ts
import { useProofreader } from '@desource/browser-ai-vue';

const proofreader = useProofreader({
  expectedInputLanguages: ['en'],
});

const result = await proofreader.proofreadWithDetails(
  'I seen him yesterday at the store, and he bought two loafs of bread.',
  { largeInputStrategy: 'auto' }
);
```

`useProofreader()` checks availability, reports model download progress, returns the corrected text plus normalized correction ranges, supports optional correction labels/explanations when Chrome supports those options, chunks long input by sentence/word boundaries, and supports batch proofreading.

## Nuxt

```bash
npm install @desource/browser-ai-nuxt
```

```ts
export default defineNuxtConfig({
  modules: ['@desource/browser-ai-nuxt'],
});
```

The module registers `<PromptApi />`, `<Summarizer />`, `<Writer />`, `<Rewriter />`, `<Translator />`, `<LanguageDetector />`, `<Proofreader />`, `<BrowserAiPromptApi />`, `<BrowserAiSummarizer />`, `<BrowserAiWriter />`, `<BrowserAiRewriter />`, `<BrowserAiTranslator />`, `<BrowserAiLanguageDetector />`, `<BrowserAiProofreader />`, `<BrowserAiChatHistory />`, `<BrowserAiChatSidebar />`, and `<BrowserAiPromptInput />` as client components. It also auto-imports `usePromptApi()`, `useSummarizer()`, `useWriter()`, `useRewriter()`, `useTranslator()`, `useLanguageDetector()`, `useProofreader()`, and `useAiChats()`.

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

- Add framework packages for React and plain TypeScript once the current API surfaces are stable.
- Add automated browser smoke tests that can attach to a Chrome profile with Gemini Nano enabled.
