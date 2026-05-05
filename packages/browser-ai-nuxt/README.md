# @desource/browser-ai-nuxt

Nuxt module for `@desource/browser-ai-vue`.

## Install

```bash
npm install @desource/browser-ai-nuxt
```

## Chrome Model Management

Nuxt components and composables use the same Chrome-managed local resources as `@desource/browser-ai-vue`.

| API | Chrome resource | Inspect/manage page |
| --- | --- | --- |
| Prompt API | Shared Gemini Nano model | `chrome://on-device-internals` |
| Summarizer | Shared Gemini Nano model | `chrome://on-device-internals` |
| Writer | Shared Gemini Nano model | `chrome://on-device-internals` |
| Rewriter | Shared Gemini Nano model | `chrome://on-device-internals` |
| Proofreader | Shared Gemini Nano model | `chrome://on-device-internals` |
| Translator | On-device translation language packs | `chrome://on-device-translation-internals/` |
| Language Detector | Small local language-detection model and language resources | `chrome://on-device-translation-internals/` for TranslateKit resources in supported Chrome builds |

Chrome reports API availability as `available`, `downloadable`, `downloading`, or `unavailable`. It requires a real user gesture to run `create()` when a model or language pack must be downloaded. Gemini Nano does not have documented per-API uninstall controls; Chrome purges it automatically under its own storage and policy rules. Translator language packs can be manually installed/uninstalled from `chrome://on-device-translation-internals/` in supported Chrome builds. `chrome://on-device-internals` does not list Translator language packs. Language Detector support is browser-defined, and low-confidence or `und` results should be treated as unknown in product UI. Proofreader has no `inputQuota`, `measureInputUsage()`, or streaming method in `@types/dom-chromium-ai@0.0.16`.

## Usage

```ts
export default defineNuxtConfig({
  modules: ['@desource/browser-ai-nuxt'],
});
```

Then use the client component:

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
```

## Module Options

```ts
export default defineNuxtConfig({
  modules: ['@desource/browser-ai-nuxt'],
  browserAi: {
    css: true,
    component: true,
    helpers: true,
  },
});
```

The module auto-imports `usePromptApi()`, `useSummarizer()`, `useWriter()`, `useRewriter()`, `useTranslator()`, `useLanguageDetector()`, `useProofreader()`, `TRANSLATOR_LANGUAGE_OPTIONS`, `getTranslatorLanguageName()`, `LANGUAGE_DETECTOR_LANGUAGE_OPTIONS`, `getLanguageDetectorLanguageName()`, `PROOFREADER_LANGUAGE_OPTIONS`, `getProofreaderLanguageName()`, and `useAiChats()` and registers the package CSS by default. It registers `<PromptApi />`, `<Summarizer />`, `<Writer />`, `<Rewriter />`, `<Translator />`, `<LanguageDetector />`, `<Proofreader />`, `<BrowserAiPromptApi />`, `<BrowserAiSummarizer />`, `<BrowserAiWriter />`, `<BrowserAiRewriter />`, `<BrowserAiTranslator />`, `<BrowserAiLanguageDetector />`, `<BrowserAiProofreader />`, `<BrowserAiChatHistory />`, `<BrowserAiChatSidebar />`, and `<BrowserAiPromptInput />` as client components.

Prompt API restore helpers, including `restoreSession()` and `promptWithTemporarySession()`, are available through the auto-imported composable. Saved chats also keep cached restore summaries in IndexedDB so unchanged long histories do not need to be summarized again on every reload. Missing summaries are warmed in the background by default instead of blocking the restored chat input.

`useSummarizer()` wraps Chrome's native Summarizer API with availability checks, download progress, abort handling, input quota measurement, batch and streaming output, and measured chunk/rollup summarization for long inputs.

`useWriter()` wraps Chrome's native Writer API with availability checks, download progress, abort handling, input quota measurement, streaming and non-streaming drafts, batch output, and explicit optional-context fitting.

`useRewriter()` wraps Chrome's native Rewriter API with the same shared writing-assistant engine: availability checks, download progress, abort handling, input quota measurement, streaming and non-streaming rewrites, batch output, and explicit optional-context fitting.

`useTranslator()` wraps Chrome's native Translator API with language-pair availability checks, language-pack download progress, abort handling, input quota measurement, streaming and non-streaming translation, batch output, same-language bypass, and measured long-text chunking.

`useLanguageDetector()` wraps Chrome's native Language Detector API with availability checks, download progress, abort handling, input quota measurement, ranked confidence normalization, batch detection, confidence thresholding, and measured long-input chunking with weighted result merging.

`useProofreader()` wraps Chrome's native Proofreader API with availability checks, download progress, abort handling, corrected-output normalization, correction range normalization, batch proofreading, and character-based long-input chunking.
