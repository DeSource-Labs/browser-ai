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
  <PromptApi />
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

The module auto-imports `usePromptApi()` and `useAiChats()` and registers the package CSS by default.
