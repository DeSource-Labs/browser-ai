<div align="center">
  <img src="demo/public/logo/android-chrome-192x192.png" alt="Browser AI Kit" width="88" height="88" />

# Browser AI Kit

**Chrome's on-device AI, shaped into framework APIs you can ship.**

Typed Vue components, composables, and a zero-config Nuxt module for Prompt API, Summarizer, Writer, Rewriter, Translator, Language Detector, Proofreader, and WebMCP.

[Website](https://ai.desource-labs.org) · [Documentation](https://ai.desource-labs.org/docs) · [Interactive examples](https://ai.desource-labs.org/#apis) · [API status](docs/api-status.md)

[![CI](https://github.com/DeSource-Labs/browser-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/DeSource-Labs/browser-ai/actions/workflows/ci.yml)
[![npm Vue](https://img.shields.io/npm/v/@desource/browser-ai-vue?label=Vue)](https://www.npmjs.com/package/@desource/browser-ai-vue)
[![npm Nuxt](https://img.shields.io/npm/v/@desource/browser-ai-nuxt?label=Nuxt)](https://www.npmjs.com/package/@desource/browser-ai-nuxt)
[![MIT](https://img.shields.io/badge/license-MIT-7c3aed)](LICENSE)

</div>

## Local AI should not require browser-internals expertise

Chrome exposes powerful built-in models, but a production integration is more than calling `LanguageModel.create()`. Applications must account for browser support, model downloads, genuine user activation, quotas, aborts, streaming, long inputs, context overflow, session cleanup, SSR, persistence, and API changes between Chrome releases.

Browser AI Kit handles that operational layer while keeping the native browser API visible. Use a ready-made interface, build your own UI around the composables, or mix both approaches.

- **Private by design.** Inference stays in Chrome; the library has no inference server and no API key.
- **Production state management.** Availability, download progress, cancellation, quotas, overflow, errors, and cleanup are first-class states.
- **Fast where users notice.** Native sessions use shallow reactivity, streaming updates are frame-coalesced, and long work is chunked without blocking typing.
- **Markdown that is ready to render.** Generated headings, lists, links, tables, and code blocks are styled consistently, with raw HTML disabled by default.
- **SSR-safe.** Browser globals are accessed on the client, and the Nuxt module registers client components automatically.
- **Complete Prompt API coverage.** Streaming chat, system and multimodal prompts, structured JSON, tools, append, clone, measurement, persisted history, and context compaction.
- **Agent-ready with WebMCP.** Register, discover, observe, and execute tools with lifecycle cleanup and deployment diagnostics.
- **TypeScript-native.** Built against the current Chromium AI type surface with explicit result and error types.

## Browser AI Kit or the native API?

The native API is the only direct alternative we recommend. Browser AI Kit does not replace Chrome's models—it removes repeated application plumbing around them.

| Capability                         | Native browser API                | Browser AI Kit                                     |
| ---------------------------------- | --------------------------------- | -------------------------------------------------- |
| Model availability and download UX | Build it per API                  | Shared, reactive state and progress                |
| Streaming UI                       | Wire streams and rendering        | Components plus stream-to-text helpers             |
| Markdown output                    | Sanitize and style it yourself    | Safe renderer with raw HTML disabled               |
| Long inputs and quotas             | Measure, split, merge, retry      | Measured chunking and API-specific rollups         |
| Prompt context overflow            | Rebuild the session yourself      | Restore, summarize, cache, and compact             |
| Nuxt SSR                           | Guard every browser access        | Client-safe module and auto-imports                |
| Cancellation and cleanup           | Manage controllers and sessions   | Consistent abort and lifecycle handling            |
| WebMCP                             | Low-level `document.modelContext` | Registration, discovery, diagnostics, form helpers |
| UI                                 | Build every state                 | Accessible starter components you can theme        |

Choose the native API directly when you need a tiny, one-off call and are comfortable owning its full lifecycle. Choose Browser AI Kit when the feature needs to survive real users, long content, reloads, downloads, and framework rendering.

## Install

### Vue

```bash
npm install @desource/browser-ai-vue
```

```vue
<script setup lang="ts">
import { PromptApi } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>

<template>
  <PromptApi context-strategy="summarize" />
</template>
```

Or own the interface and use the composable:

```ts
import { usePromptApi } from '@desource/browser-ai-vue';

const ai = usePromptApi();

await ai.init({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }]
});
await ai.create(); // Call from a user action when the model is downloadable.

const answer = await ai.prompt('Explain view transitions in two sentences.');
```

[Vue package guide](packages/browser-ai-vue/README.md)

### Nuxt

```bash
npm install @desource/browser-ai-nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@desource/browser-ai-nuxt']
});
```

`<PromptApi />`, the other UI components, and every composable are now available without manual imports.

[Nuxt package guide](packages/browser-ai-nuxt/README.md)

## One toolkit, eight browser surfaces

| Surface           | What you can ship                                                    | Library coverage                                                                            |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Prompt API        | Chat, extraction, classification, multimodal tasks, tool-aware flows | Streaming, JSON Schema output, clone, append, usage, persisted sessions, context compaction |
| Summarizer        | Key points, headlines, teasers, and summaries                        | Quota measurement, streaming, batching, chunking, recursive rollups                         |
| Writer            | Drafts in a chosen tone, format, and length                          | Reusable sessions, streaming, batching, context fitting                                     |
| Rewriter          | Clearer, shorter, longer, or differently toned text                  | Reusable sessions, streaming, batching, context fitting                                     |
| Translator        | Private on-device translation                                        | Pair availability, pack download UX, streaming, measured chunking                           |
| Language Detector | Ranked language identification                                       | Confidence thresholds, batching, weighted chunk merging                                     |
| Proofreader       | Grammar, spelling, and punctuation correction                        | Normalized corrections, highlights, batching, safe long-input splitting                     |
| WebMCP            | App tools that browser agents can discover and call                  | Registration, discovery, execution, events, diagnostics, declarative forms                  |

Try every surface in the [interactive examples](https://ai.desource-labs.org/#apis).

## Chrome requirements

Chrome's built-in AI APIs are evolving and are not available to every browser, device, language, region, or managed profile. Build a graceful unsupported state into your product. The library exposes that state; it cannot change Chrome eligibility.

For local development, use a supported desktop Chrome build and enable the flags for the APIs you need:

- `chrome://flags/#optimization-guide-on-device-model`
- `chrome://flags/#prompt-api-for-gemini-nano`
- `chrome://flags/#writer-api-for-gemini-nano`
- `chrome://flags/#rewriter-api-for-gemini-nano`
- `chrome://flags/#translation-api`
- `chrome://flags/#language-detection-api`
- `chrome://flags/#proofreader-api-for-gemini-nano`
- `chrome://flags/#enable-webmcp-testing`

Model downloads can only start from a genuine user action. Chrome owns model installation, storage, updates, and removal. Prompt, Summarizer, Writer, Rewriter, and Proofreader share Gemini Nano resources; Translator uses language packs; Language Detector uses separate local resources.

Read [Getting started](docs/getting-started.md) for setup and fallback guidance, or [API status](docs/api-status.md) for the exact runtime surface verified by this repository.

## Structured output

```ts
const result = await ai.promptJson<{ priority: 'low' | 'high' }>('Classify this support request: Production is down.', {
  responseConstraint: {
    type: 'object',
    properties: {
      priority: { type: 'string', enum: ['low', 'high'] }
    },
    required: ['priority'],
    additionalProperties: false
  }
});
```

The browser constrains generation to the supplied schema; `promptJson()` also parses the response into your TypeScript type.

## WebMCP

```ts
import { useWebMcp } from '@desource/browser-ai-vue';

const webMcp = useWebMcp();

const unregister = await webMcp.registerTool({
  name: 'get_cart_total',
  description: 'Return the current cart total without changing the cart.',
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: true },
  execute: () => ({ total: cart.total, currency: cart.currency })
});

// Unregister explicitly, or let the Vue scope dispose it.
unregister();
```

WebMCP is experimental. Production pages need an origin-isolated document and an appropriate `Permissions-Policy`, and every tool must enforce authorization inside `execute`. See the [WebMCP guide](docs/webmcp.md).

## Framework roadmap

Browser AI Kit is becoming a consistent family of framework libraries, not a Vue-only experiment.

| Framework       | Status    | Direction                                            |
| --------------- | --------- | ---------------------------------------------------- |
| Vue             | Available | Components and composables                           |
| Nuxt            | Available | Auto-imports, client components, deployment defaults |
| React           | Planned   | Hooks and accessible headless/UI components          |
| Angular         | Planned   | Injectable services, signals, and components         |
| Svelte          | Planned   | Stores, actions, and components                      |
| TypeScript core | Planned   | Framework-neutral lifecycle and utility layer        |

Public behavior will stay aligned across frameworks while each package follows its framework's native conventions. Follow the [framework roadmap](docs/framework-roadmap.md) or join a design discussion before starting a new adapter.

## Performance and privacy

The demo and packages are built around three constraints: no server inference, no deep proxies around native sessions, and no unbounded synchronous rendering during streams. Persisted chats live in the browser's IndexedDB. The library does not send prompts, outputs, or telemetry to DeSource Labs.

Your application can still transmit data through its own code, browser extensions, monitoring tools, or WebMCP implementations. Audit those paths separately and treat model output as untrusted content.

## Project documentation

- [Getting started](docs/getting-started.md)
- [Why Browser AI Kit](docs/why-browser-ai-kit.md)
- [Current Chrome API status](docs/api-status.md)
- [WebMCP integration and security](docs/webmcp.md)
- [Framework roadmap](docs/framework-roadmap.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)

## Development

```bash
corepack enable
pnpm install
pnpm build
pnpm dev:demo
```

Run the complete quality gate with:

```bash
pnpm check
pnpm format:check
```

Changes to published packages use [Changesets](https://github.com/changesets/changesets). See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE) © DeSource Labs
