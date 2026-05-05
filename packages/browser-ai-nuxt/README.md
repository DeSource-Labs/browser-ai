# @desource/browser-ai-nuxt

Nuxt module for `@desource/browser-ai-vue`.

## Install

```bash
npm install @desource/browser-ai-nuxt
```

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

The module auto-imports `usePromptApi()`, `useSummarizer()`, `useWriter()`, `useRewriter()`, and `useAiChats()` and registers the package CSS by default. It registers `<PromptApi />`, `<Summarizer />`, `<Writer />`, `<Rewriter />`, `<BrowserAiPromptApi />`, `<BrowserAiSummarizer />`, `<BrowserAiWriter />`, `<BrowserAiRewriter />`, `<BrowserAiChatHistory />`, `<BrowserAiChatSidebar />`, and `<BrowserAiPromptInput />` as client components.

Prompt API restore helpers, including `restoreSession()` and `promptWithTemporarySession()`, are available through the auto-imported composable. Saved chats also keep cached restore summaries in IndexedDB so unchanged long histories do not need to be summarized again on every reload. Missing summaries are warmed in the background by default instead of blocking the restored chat input.

`useSummarizer()` wraps Chrome's native Summarizer API with availability checks, download progress, abort handling, input quota measurement, batch and streaming output, and measured chunk/rollup summarization for long inputs.

`useWriter()` wraps Chrome's native Writer API with availability checks, download progress, abort handling, input quota measurement, streaming and non-streaming drafts, batch output, and explicit optional-context fitting.

`useRewriter()` wraps Chrome's native Rewriter API with the same shared writing-assistant engine: availability checks, download progress, abort handling, input quota measurement, streaming and non-streaming rewrites, batch output, and explicit optional-context fitting.
