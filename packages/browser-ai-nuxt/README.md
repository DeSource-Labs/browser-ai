# @desource/browser-ai-nuxt

The Nuxt module for Browser AI Kit: Chrome's on-device Prompt API, Summarizer, Writer, Rewriter, Translator, Language Detector, Proofreader, and WebMCP—with auto-imports and SSR-safe client components.

[Live examples](https://ai.desource-labs.org/#apis) · [Documentation](https://ai.desource-labs.org/docs) · [GitHub](https://github.com/DeSource-Labs/browser-ai) · [Vue core](https://www.npmjs.com/package/@desource/browser-ai-vue)

## What the module solves

Native AI globals only exist in supported browsers. Nuxt renders on the server, manages imports, splits routes, and hydrates on the client. This module connects those worlds without forcing browser guards into every component.

- registers every Browser AI Kit component in client mode;
- auto-imports composables, helpers, constants, and TypeScript types;
- includes the component stylesheet by default;
- preserves native download, progress, abort, quota, streaming, and cleanup behavior;
- adds no inference server, proxy, account, or API key.

## Install

```bash
npm install @desource/browser-ai-nuxt
```

Add the module:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@desource/browser-ai-nuxt"],
});
```

Use a complete interface immediately:

```vue
<template>
  <PromptApi context-strategy="summarize" />
</template>
```

Or build a product-specific interface around an auto-imported composable:

```vue
<script setup lang="ts">
const ai = usePromptApi();
const answer = ref("");

async function start() {
  await ai.init({
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
  });
  await ai.create();
}

async function send(prompt: string) {
  answer.value = "";
  const stream = ai.promptStreaming(prompt);
  for await (const chunk of stream) {
    answer.value += chunk;
  }
}
</script>
```

When Chrome reports `downloadable`, call `create()` from a genuine user action. Programmatic clicks do not satisfy Chrome's activation requirement.

## Configuration

```ts
export default defineNuxtConfig({
  modules: ["@desource/browser-ai-nuxt"],
  browserAi: {
    css: true,
    component: true,
    helpers: true,
  },
});
```

| Option      | Default | Purpose                                                |
| ----------- | ------- | ------------------------------------------------------ |
| `css`       | `true`  | Add the themeable component stylesheet                 |
| `component` | `true`  | Register client-only components                        |
| `helpers`   | `true`  | Auto-import composables, constants, helpers, and types |

Disable `css` when you only use composables or want to load the stylesheet in selected routes. Disable `component` for a headless integration.

## Auto-imported components

- `<PromptApi />`, `<Summarizer />`, `<Writer />`, `<Rewriter />`
- `<Translator />`, `<LanguageDetector />`, `<Proofreader />`
- `<BrowserAiPromptInput />`, `<BrowserAiChatHistory />`, `<BrowserAiChatSidebar />`
- `BrowserAi`-prefixed aliases for every primary component

## Auto-imported composables

- `usePromptApi()` and `useAiChats()`
- `useSummarizer()`, `useWriter()`, and `useRewriter()`
- `useTranslator()`, `useLanguageDetector()`, and `useProofreader()`
- `useWebMcp()` and its support/declarative helpers
- language option collections and display-name helpers

All public types from the Vue core are available to Nuxt's generated type system.

## Deployment headers for WebMCP

WebMCP is experimental and requires an origin-isolated production document plus a `tools` Permissions Policy. With Nitro:

```ts
export default defineNuxtConfig({
  routeRules: {
    "/**": {
      headers: {
        "origin-agent-cluster": "?1",
        "permissions-policy": "tools=(self)",
      },
    },
  },
});
```

If your reverse proxy or hosting platform overwrites headers, configure them at that layer too. Cross-origin tool discovery needs a deliberately broader policy. Every tool must validate input and re-check authorization inside `execute`; registration is not an authorization boundary.

Read the complete [WebMCP guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md).

## Performance notes

Browser AI Kit keeps native sessions out of Vue's deep-reactivity graph and coalesces high-frequency stream updates to animation frames. Prompt history restoration measures the real browser context window, caches summaries in IndexedDB, and can warm missing summaries in the background so a long saved chat does not block the input.

For the smallest public route, set `css: false` globally and import `@desource/browser-ai-vue/assets/lib.css` only in layouts or routes that render the components.

## Browser support and fallbacks

Availability depends on Chrome version, channel, platform, device eligibility, storage, language, region, enterprise policy, and downloaded resources. The module exposes browser state; it cannot install a model without user activation or enable an unsupported browser.

Keep a non-AI path for essential workflows. If you add a hosted fallback, disclose that prompts will leave the device and ask for consent before switching.

See [Getting started](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/getting-started.md) and the [verified API status](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md).

## Why not call the native API directly?

You can—and for a small client-only experiment, that may be enough. The module becomes valuable when you need SSR-safe access, auto-imports, production download and error states, long-input handling, persisted chat context, consistent cancellation, or a maintained boundary around Chrome's evolving APIs.

## License

[MIT](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE) © DeSource Labs
