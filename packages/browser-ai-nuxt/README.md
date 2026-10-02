# @desource/browser-ai-nuxt

[![Nuxt](https://img.shields.io/npm/v/@desource/browser-ai-nuxt?color=blue&logo=nuxt)](https://www.npmjs.com/package/@desource/browser-ai-nuxt)
[![Coverage](https://codecov.io/gh/DeSource-Labs/browser-ai/branch/main/graph/badge.svg)](https://codecov.io/gh/DeSource-Labs/browser-ai)
[![SonarCloud](https://sonarcloud.io/api/project_badges/measure?project=DeSource-Labs_browser-ai&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DeSource-Labs_browser-ai)
[![Ask Context7](https://img.shields.io/badge/Ask%20Context7-059669.svg?logo=data:image/svg%2bxml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI0IDBINEMxLjc5MDg2IDAgMCAxLjc5MDg2IDAgNFYyNEMwIDI2LjIwOTEgMS43OTA4NiAyOCA0IDI4SDI0QzI2LjIwOTEgMjggMjggMjYuMjA5MSAyOCAyNFY0QzI4IDEuNzkwODYgMjYuMjA5MSAwIDI0IDBaIiBmaWxsPSIjRjdGMkU4IiBmaWxsLW9wYWNpdHk9IjAuNjUiLz4KPHBhdGggZD0iTTEwLjYgMTUuMjk5MkMxMC42IDE3LjQ5OTIgOS43MDAwNSAxOS4zOTkyIDguMjAwMDUgMjEuMDk5MkgxMS42VjIyLjc5OTJINi4zMDAwNVYyMS4xOTkyQzguMDAwMDUgMTkuMzk5MiA4LjYwMDA1IDE3Ljg5OTIgOC42MDAwNSAxNS4yOTkySDEwLjZaTTE3LjQgMTUuMjk5MkMxNy40IDE3LjQ5OTIgMTguMyAxOS4zOTkyIDE5LjggMjEuMDk5MkgxNi40VjIyLjc5OTJIMjEuN1YyMS4xOTkyQzIwIDE5LjM5OTIgMTkuNCAxNy44OTkyIDE5LjQgMTUuMjk5MkgxNy40Wk0xMC42IDEyLjY5OTJDMTAuNiAxMC40OTkyIDkuNzAwMDUgOC41OTkyMiA4LjIwMDA1IDYuODk5MjJIMTEuNlY1LjE5OTIySDYuMzAwMDVWNi43OTkyMkM4LjAwMDA1IDguNTk5MjIgOC42MDAwNSAxMC4wOTkyIDguNjAwMDUgMTIuNjk5MkgxMC42Wk0xNy40IDEyLjY5OTJDMTcuNCAxMC40OTkyIDE4LjMgOC41OTkyMiAxOS44IDYuODk5MjJIMTYuNFY1LjE5OTIySDIxLjdWNi43OTkyMkMyMCA4LjU5OTIyIDE5LjQgMTAuMDk5MiAxOS40IDEyLjY5OTJIMTcuNFoiIGZpbGw9ImJsYWNrIi8+Cjwvc3ZnPgo=)](https://context7.com/desource-labs/browser-ai)
[![Ask DeepWiki](https://img.shields.io/badge/Ask%20DeepWiki-1c398e.svg?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0iI2NiY2JjYiIgYXJpYS1oaWRkZW49InRydWUiPjxwYXRoIGQ9Ik0xOC42IDIwLjFxMS0uNiAyLjItLjZoLjNhNCA0IDAgMCAxIDIgLjdoLjJ2LjFsMSAxaC4xdi4yaC4xbC4xLjF2LjFxLjcgMSAuNyAyLjN0LS42IDIuMnYuMWwtLjIuMkE0IDQgMCAwIDEgMjMgMjhoLS4ydi4xbC0xLjQuNGgtLjVxLTEuMyAwLTIuMy0uNWwtNC4xLTIuNC04LjMgNC44djkuNWw4LjMgNC44IDguMi00LjhWMzVxMC0xLjIuNi0yLjJ2LS4xbC4yLS4yYTQgNCAwIDAgMSAxLjctMS41bDEuMy0uNGguNnExLjMgMCAyLjMuNmw0LjIgMi4zIDguMi00Ljd2LTkuNmwtOC4yLTQuNy00LjIgMi4zcS0xIC42LTIuMi42aC0uM2E0IDQgMCAwIDEtMi0uNmwtLjItLjEtMS0xaC0uMXYtLjJoLS4xbC0uMS0uMnYtLjFxLS43LTEtLjctMi4yVjguMmwtOC4yLTQuNy04LjMgNC43djkuNWw4LjIgNC44eiIvPjwvc3ZnPg==)](https://deepwiki.com/DeSource-Labs/browser-ai)
[![MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE)

[Documentation](https://ai.desourcelabs.com/docs) · [Examples](https://ai.desourcelabs.com/#apis) · [GitHub](https://github.com/DeSource-Labs/browser-ai)

Add private, on-device AI to Nuxt with one module. Build chat, summaries, writing assistance, and translation using Chrome's local models. Prompts are processed on the user's device, with no inference server or API key to set up.

The module connects Browser AI Kit's Vue components and composables to Nuxt's server rendering and auto-imports. It also includes WebMCP helpers for exposing application tools to browser agents.

## What the module handles

- Registers the chat and text components in client mode, so browser globals stay out of server rendering.
- Auto-imports composables, helpers, language options, and TypeScript types.
- Includes component styles by default.
- Provides the Vue package's download progress, streaming, stop controls, saved chats, and session cleanup.

## Install

```bash
npm install @desource/browser-ai-nuxt
```

Nuxt 3.17 or 4 with Vue 3.4.33 or newer is supported.

Open your app in Chrome on HTTPS or localhost. The components check availability and guide the user through any required model download. See [Browser setup](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/browser-support.md#try-it-in-your-browser).

## Quick start

Add the module:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@desource/browser-ai-nuxt']
});
```

Add a complete chat interface to a page. Components and styles are registered automatically:

```vue
<template>
  <PromptApi context-strategy="summarize" />
</template>
```

The chat includes saved conversations, streaming Markdown, attachments, stop controls, and context restoration. Or build your own interface around an auto-imported composable:

```vue
<script setup lang="ts">
const ai = usePromptApi();
const answer = ref('');

async function start() {
  await ai.init({
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }]
  });
  await ai.create();
}

async function send(prompt: string) {
  answer.value = '';
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
  modules: ['@desource/browser-ai-nuxt'],
  browserAi: {
    css: true,
    component: true,
    helpers: true
  }
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
- `<MarkdownRenderer />` for product-specific model output
- `<BrowserAiPromptInput />`, `<BrowserAiChatHistory />`, `<BrowserAiChatSidebar />`
- `BrowserAi`-prefixed aliases for every primary component

## Auto-imported composables

- `usePromptApi()` and `useAiChats()`
- `useSummarizer()`, `useWriter()`, and `useRewriter()`
- `useTranslator()`, `useLanguageDetector()`, and `useProofreader()`
- `useWebMcp()` and its support/declarative helpers
- language option collections and display-name helpers

All public types from the Vue package are available to Nuxt's generated type system.

The same 11 components and eight capability adapters are available as native React, Svelte, and Angular packages. All adapters share `@desource/browser-ai` lifecycle behavior, common component tests, and common compiled styles; Nuxt adds SSR-safe Vue registration rather than a separate implementation.

Generated prose in the starter components is Markdown-aware by default. Use `:render-markdown="false"` for literal output; Proofreader keeps its correction highlights unless `render-markdown` is enabled.

## Deployment headers for WebMCP

WebMCP is experimental and requires an origin-isolated production document plus a `tools` Permissions Policy. With Nitro:

```ts
export default defineNuxtConfig({
  routeRules: {
    '/**': {
      headers: {
        'origin-agent-cluster': '?1',
        'permissions-policy': 'tools=(self)'
      }
    }
  }
});
```

If your reverse proxy or hosting platform overwrites headers, configure them at that layer too. Cross-origin tool discovery needs a deliberately broader policy. Every tool must validate input and re-check authorization inside `execute`; registration is not an authorization boundary.

Read the complete [WebMCP guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md).

## Performance notes

Browser AI Kit keeps native sessions out of Vue's deep-reactivity graph and coalesces high-frequency stream updates to animation frames. Prompt history restoration measures the real browser context window, caches summaries in IndexedDB, and can warm missing summaries in the background so a long saved chat does not block the input.

For the smallest public route, set `css: false` globally and import `@desource/browser-ai-vue/assets/lib.css` only in layouts or routes that render the components.

## Browser support

Availability depends on Chrome version, channel, platform, device eligibility, storage, language, region, enterprise policy, and downloaded resources. The module exposes browser state; it cannot install a model without user activation or enable an unsupported browser.

Keep a non-AI path for essential workflows. If you add a hosted fallback, disclose that prompts will leave the device and ask for consent before switching.

See [Browser support](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/browser-support.md) for availability and download behavior.

## Development

See [Contributing](https://github.com/DeSource-Labs/browser-ai/blob/main/CONTRIBUTING.md) for setup, checks, and local browser tests. Package releases are listed in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE) © DeSource Labs
