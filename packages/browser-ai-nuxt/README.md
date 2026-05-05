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

The module auto-imports `usePromptApi()` and `useAiChats()` and registers the package CSS by default. Prompt API restore helpers, including `restoreSession()` and `promptWithTemporarySession()`, are available through the auto-imported composable. Saved chats also keep cached restore summaries in IndexedDB so unchanged long histories do not need to be summarized again on every reload. Missing summaries are warmed in the background by default instead of blocking the restored chat input.
