<div align="center">
  <img src="demo/public/logo/android-chrome-192x192.png" alt="Browser AI Kit" width="88" height="88" />

# Browser AI Kit

Private, on-device AI for Vue, React, Svelte, Angular, Nuxt, and TypeScript.

[Website](https://ai.desourcelabs.com) · [Live examples](https://ai.desourcelabs.com/#apis) · [Documentation](https://ai.desourcelabs.com/docs)

[![Core](https://img.shields.io/npm/v/@desource/browser-ai?color=blue&logo=typescript)](https://www.npmjs.com/package/@desource/browser-ai)
[![Vue](https://img.shields.io/npm/v/@desource/browser-ai-vue?color=blue&logo=vue.js)](https://www.npmjs.com/package/@desource/browser-ai-vue)
[![Nuxt](https://img.shields.io/npm/v/@desource/browser-ai-nuxt?color=blue&logo=nuxt)](https://www.npmjs.com/package/@desource/browser-ai-nuxt)
[![React](https://img.shields.io/npm/v/@desource/browser-ai-react?color=blue&logo=react)](https://www.npmjs.com/package/@desource/browser-ai-react)
[![Svelte](https://img.shields.io/npm/v/@desource/browser-ai-svelte?color=blue&logo=svelte)](https://www.npmjs.com/package/@desource/browser-ai-svelte)
[![Angular](https://img.shields.io/npm/v/@desource/browser-ai-angular?color=blue&logo=angular&logoColor=white)](https://www.npmjs.com/package/@desource/browser-ai-angular)
<br />
[![Coverage](https://codecov.io/gh/DeSource-Labs/browser-ai/branch/main/graph/badge.svg)](https://codecov.io/gh/DeSource-Labs/browser-ai)
[![SonarCloud](https://sonarcloud.io/api/project_badges/measure?project=DeSource-Labs_browser-ai&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DeSource-Labs_browser-ai)
[![Ask Context7](https://img.shields.io/badge/Ask%20Context7-059669.svg?logo=data:image/svg%2bxml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI0IDBINEMxLjc5MDg2IDAgMCAxLjc5MDg2IDAgNFYyNEMwIDI2LjIwOTEgMS43OTA4NiAyOCA0IDI4SDI0QzI2LjIwOTEgMjggMjggMjYuMjA5MSAyOCAyNFY0QzI4IDEuNzkwODYgMjYuMjA5MSAwIDI0IDBaIiBmaWxsPSIjRjdGMkU4IiBmaWxsLW9wYWNpdHk9IjAuNjUiLz4KPHBhdGggZD0iTTEwLjYgMTUuMjk5MkMxMC42IDE3LjQ5OTIgOS43MDAwNSAxOS4zOTkyIDguMjAwMDUgMjEuMDk5MkgxMS42VjIyLjc5OTJINi4zMDAwNVYyMS4xOTkyQzguMDAwMDUgMTkuMzk5MiA4LjYwMDA1IDE3Ljg5OTIgOC42MDAwNSAxNS4yOTkySDEwLjZaTTE3LjQgMTUuMjk5MkMxNy40IDE3LjQ5OTIgMTguMyAxOS4zOTkyIDE5LjggMjEuMDk5MkgxNi40VjIyLjc5OTJIMjEuN1YyMS4xOTkyQzIwIDE5LjM5OTIgMTkuNCAxNy44OTkyIDE5LjQgMTUuMjk5MkgxNy40Wk0xMC42IDEyLjY5OTJDMTAuNiAxMC40OTkyIDkuNzAwMDUgOC41OTkyMiA4LjIwMDA1IDYuODk5MjJIMTEuNlY1LjE5OTIySDYuMzAwMDVWNi43OTkyMkM4LjAwMDA1IDguNTk5MjIgOC42MDAwNSAxMC4wOTkyIDguNjAwMDUgMTIuNjk5MkgxMC42Wk0xNy40IDEyLjY5OTJDMTcuNCAxMC40OTkyIDE4LjMgOC41OTkyMiAxOS44IDYuODk5MjJIMTYuNFY1LjE5OTIySDIxLjdWNi43OTkyMkMyMCA4LjU5OTIyIDE5LjQgMTAuMDk5MiAxOS40IDEyLjY5OTJIMTcuNFoiIGZpbGw9ImJsYWNrIi8+Cjwvc3ZnPgo=)](https://context7.com/desource-labs/browser-ai)
[![Ask DeepWiki](https://img.shields.io/badge/Ask%20DeepWiki-1c398e.svg?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0iI2NiY2JjYiIgYXJpYS1oaWRkZW49InRydWUiPjxwYXRoIGQ9Ik0xOC42IDIwLjFxMS0uNiAyLjItLjZoLjNhNCA0IDAgMCAxIDIgLjdoLjJ2LjFsMSAxaC4xdi4yaC4xbC4xLjF2LjFxLjcgMSAuNyAyLjN0LS42IDIuMnYuMWwtLjIuMkE0IDQgMCAwIDEgMjMgMjhoLS4ydi4xbC0xLjQuNGgtLjVxLTEuMyAwLTIuMy0uNWwtNC4xLTIuNC04LjMgNC44djkuNWw4LjMgNC44IDguMi00LjhWMzVxMC0xLjIuNi0yLjJ2LS4xbC4yLS4yYTQgNCAwIDAgMSAxLjctMS41bDEuMy0uNGguNnExLjMgMCAyLjMuNmw0LjIgMi4zIDguMi00Ljd2LTkuNmwtOC4yLTQuNy00LjIgMi4zcS0xIC42LTIuMi42aC0uM2E0IDQgMCAwIDEtMi0uNmwtLjItLjEtMS0xaC0uMXYtLjJoLS4xbC0uMS0uMnYtLjFxLS43LTEtLjctMi4yVjguMmwtOC4yLTQuNy04LjMgNC43djkuNWw4LjIgNC44eiIvPjwvc3ZnPg==)](https://deepwiki.com/DeSource-Labs/browser-ai)
[![MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE)

</div>

Add chat, summaries, writing assistance, and translation to your app while keeping model processing on the user's device. Browser AI Kit uses Chrome's built-in AI models: prompts and responses are processed locally, with no inference server or API key to set up.

Start with a ready-made component or build your own interface with typed APIs. The kit handles availability, model downloads, streaming, cancellation, and cleanup. Optional WebMCP adapters also let browser agents use tools exposed by your application.

## Why Browser AI Kit

- **Keep AI processing local.** Run prompts on the user's device without sending them to an inference service. The library adds no telemetry or per-request fee.
- **Start with a working interface.** Chat and text components include download progress, streaming responses, and stop controls. Use composables, hooks, stores, or signals when you want your own UI.
- **Keep conversations useful.** Save chats locally, restore context, and process long inputs with workflows that account for the model's limits.
- **Work with files.** Add images, audio, and text files to Prompt API requests where the browser supports them. Text tools can read text files locally.
- **Let agents use your app.** WebMCP tools call the same application actions as your visible interface, with registration and cleanup tied to their owner.

A direct native call can be enough for a small experiment. The kit is useful when you need download progress, a responsive streaming interface, saved chats, or the same behavior across frameworks. Each framework package uses its own runtime; a React app does not need Vue or Svelte.

## Packages

Choose the package for your framework. Each package guide includes components, custom interfaces, and API examples. Add the core package directly when importing its helpers or optional entries.

| Package                                                     | Integration                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| [@desource/browser-ai](packages/core)                       | Framework-independent controllers and external stores        |
| [@desource/browser-ai-vue](packages/browser-ai-vue)         | Vue 3 components and composables                             |
| [@desource/browser-ai-react](packages/browser-ai-react)     | React hooks and components                                   |
| [@desource/browser-ai-svelte](packages/browser-ai-svelte)   | Svelte 5 stores and components                               |
| [@desource/browser-ai-angular](packages/browser-ai-angular) | Angular signals, services, and standalone components         |
| [@desource/browser-ai-nuxt](packages/browser-ai-nuxt)       | Nuxt module with client components, auto-imports, and styles |

## Quick start

Try the [live examples](https://ai.desourcelabs.com/#apis), or install one package in your app:

```sh
npm install @desource/browser-ai-vue      # Vue
npm install @desource/browser-ai-react    # React
npm install @desource/browser-ai-svelte   # Svelte
npm install @desource/browser-ai-angular  # Angular
npm install @desource/browser-ai-nuxt     # Nuxt
npm install @desource/browser-ai          # Plain TypeScript
```

Use Chrome on HTTPS or localhost. Support depends on the API, device, and language; the first use may need a model download. The components show availability and download progress. See [Browser setup](docs/browser-support.md#try-it-in-your-browser) if an API is unavailable.

Choose your framework below. Import the stylesheet once when using components; the Nuxt module includes it by default.

### Vue

```vue
<script setup lang="ts">
import { PromptApi } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>

<template>
  <PromptApi />
</template>
```

### React

```tsx
import { PromptApi } from '@desource/browser-ai-react';
import '@desource/browser-ai-react/assets/lib.css';

export function Assistant() {
  return <PromptApi />;
}
```

### Svelte

```svelte
<script lang="ts">
  import { PromptApi } from '@desource/browser-ai-svelte';
  import '@desource/browser-ai-svelte/assets/lib.css';
</script>

<PromptApi />
```

### Angular

```ts
import { Component } from '@angular/core';
import { BrowserAiPromptApiComponent } from '@desource/browser-ai-angular';
import '@desource/browser-ai-angular/assets/lib.css';

@Component({
  selector: 'app-assistant',
  imports: [BrowserAiPromptApiComponent],
  template: '<browser-ai-prompt-api />'
})
export class AssistantComponent {}
```

### Nuxt

```ts
export default defineNuxtConfig({
  modules: ['@desource/browser-ai-nuxt']
});
```

```vue
<template>
  <PromptApi />
</template>
```

Nuxt registers browser-dependent components in client mode and auto-imports composables, helpers, and types.

These chat components include saved conversations, streaming Markdown, attachments, stop controls, and context restoration. Set a distinct `chatKey` for assistants that should keep separate histories.

### TypeScript

```ts
import { createPromptApi } from '@desource/browser-ai';

const ai = createPromptApi();
await ai.init(); // Check availability without starting a download.

// Connect this function to a user action when a download may be required.
async function ask(message: string) {
  return ai.prompt(message);
}

// Connect this cleanup to the owning screen or application's lifecycle.
function disposeAssistant() {
  ai.dispose();
}
```

`prompt()` creates a session when needed and reuses it for later requests. For availability, progress, streaming, and error handling in a custom UI, see the [core quick start](packages/core/README.md#quick-start).

## APIs

| Capability        | Use it for                                                        |
| ----------------- | ----------------------------------------------------------------- |
| Prompt API        | Chats, streaming, image/audio inputs, and constrained JSON output |
| Summarizer        | Summaries, key points, headlines, and teasers                     |
| Writer / Rewriter | Drafting and revising text                                        |
| Translator        | Translation between supported language pairs                      |
| Language Detector | Ranked language results with confidence scores                    |
| Proofreader       | Corrections with ranges and explanations                          |
| WebMCP            | Tools that act on the same application state as the visible UI    |

Vue, React, Svelte, and Angular provide the same 11 components: `PromptApi`, `Summarizer`, `Writer`, `Rewriter`, `Translator`, `LanguageDetector`, `Proofreader`, `MarkdownRenderer`, `PromptInput`, `ChatHistory`, and `ChatSidebar`. Angular exports standalone classes with `BrowserAi` and `Component` around those names. Nuxt registers the Vue components in client mode.

## Attachments and long inputs

Prompt API can work with text, images, and audio supported by the browser. Text files are decoded locally; images and audio use the browser's native input types.

```ts
const answer = await ai.promptWithAttachments('Compare these inputs.', [
  { name: 'notes.md', value: notesFile },
  { name: 'reference.png', value: imageFile },
  { name: 'voice.webm', value: audioBlob }
]);
```

Optional workflows handle content that does not fit into one request. Summarizer combines summaries from measured chunks; Translator preserves chunk order; Proofreader keeps correction ranges aligned with the original text. Writer and Rewriter fit supporting context around the main task.

```ts
import { createSummarizerWorkflow } from '@desource/browser-ai/workflows';

// Call from a user action when a model download may be required.
async function summarizeArticle(article: string) {
  const summarizer = createSummarizerWorkflow();
  try {
    const result = await summarizer.summarizeWithDetails(article, { chunking: 'auto' });
    return result.summary;
  } finally {
    summarizer.dispose();
  }
}
```

See the [attachment examples](packages/core/README.md#attachments-and-text-files) and [workflow guide](packages/core/README.md#optional-advanced-workflows) for streaming, batches, and detailed results.

## Build a custom interface

Import only the parts your app needs. Components and their styles are optional; the core package works without a UI framework.

| Import                              | Purpose                                               |
| ----------------------------------- | ----------------------------------------------------- |
| `@desource/browser-ai`              | Native controllers, attachments, and WebMCP           |
| `@desource/browser-ai/workflows`    | Long-input handling, batches, and history restoration |
| `@desource/browser-ai/chats`        | Saved text histories and summary storage              |
| `@desource/browser-ai/conversation` | Chat orchestration for custom interfaces              |

Vue's AI composables use the advanced workflows. React and Svelte expose optional `/workflows` bindings; Angular exposes headless factories from `/controllers`. See the [core guide](packages/core/README.md) for operations, state subscriptions, and ownership.

For a custom chat UI, [`createConversation()`](packages/core/README.md#saved-conversations-and-custom-chat-interfaces) combines sending, stopping, saved chats, and context restoration. Completed chat text and extracted file text can persist in local IndexedDB. Raw image/audio attachments stay in memory and do not survive a reload.

## Browser-agent tools with WebMCP

Let compatible browser agents search your catalog, add a task, or fill a form through actions your app already supports. Register a typed tool or annotate an existing HTML form; people and agents use the same application state.

The [WebMCP demo](https://ai.desourcelabs.com/webmcp) lets an agent search workspaces, build a visible shortlist, and save a local visit draft. The [WebMCP guide](docs/webmcp.md) covers registration, validation, cleanup, and deployment. WebMCP is a separate browser capability: the agent and your tool code determine where tool data is processed.

## Browser support

Chrome manages the local models and language packs. Once the required resources are installed, model processing can work offline; downloads and updates still need a connection. Availability varies by API, hardware, language, and browser configuration.

Components handle the browser states for you. In a custom interface, check availability with the options your application will use, show download progress, and start required downloads from a user action. Keep essential work usable when an API is unavailable. The kit does not silently switch to a cloud model.

See [Browser support](docs/browser-support.md) for availability and resource handling, and the [WebMCP guide](docs/webmcp.md) for tool registration, input validation, and deployment requirements.

## Development

Use Node.js 26 and the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev:prepare
pnpm dev:demo
```

```sh
pnpm build:all           # Packages, Nuxt demo, and framework fixtures
pnpm typecheck
pnpm test:unit:coverage
pnpm check:release      # Format, lint, builds, types, package checks, and coverage
```

Every public package requires at least 95% unit coverage. See [Contributing](CONTRIBUTING.md#quality-checks) for CI and Codecov details.

E2e tests run locally only:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
BROWSER_AI_CDP_ENDPOINT=http://127.0.0.1:9222 pnpm test:e2e:live
```

The live suite needs an existing Chrome profile with the relevant APIs enabled. See [Contributing](CONTRIBUTING.md) for setup, local browser tests, and releases, or the [demo guide](demo/README.md) for focused development.

## Contributing and support

Use [GitHub Discussions](https://github.com/DeSource-Labs/browser-ai/discussions) for questions and [issues](https://github.com/DeSource-Labs/browser-ai/issues) for reproducible bugs. Include the package version, browser version, availability state, and a minimal reproduction.

Read [Contributing](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md), and the private reporting instructions in [Security](SECURITY.md).

## License

[MIT](LICENSE) © DeSource Labs
