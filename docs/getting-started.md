# Getting started

Browser AI Kit connects Vue and Nuxt applications to AI models built into Chrome. Inference runs on the user's device, so there is no model API key and no Browser AI Kit backend to deploy.

The browser remains in control: Chrome decides whether an API is supported, whether the device is eligible, and whether a model or language pack must be downloaded. A polished integration makes those states visible instead of assuming the model is ready.

## Choose a package

For Vue 3:

```bash
npm install @desource/browser-ai-vue
```

For Nuxt 3.17+ or Nuxt 4:

```bash
npm install @desource/browser-ai-nuxt
```

The Nuxt package depends on the Vue core and adds auto-imports, client-only components, and optional global CSS.

## Prepare Chrome for development

Use a supported desktop Chrome build. Depending on the API and Chrome channel, enable the corresponding test flags:

- `chrome://flags/#optimization-guide-on-device-model`
- `chrome://flags/#prompt-api-for-gemini-nano`
- `chrome://flags/#writer-api-for-gemini-nano`
- `chrome://flags/#rewriter-api-for-gemini-nano`
- `chrome://flags/#translation-api`
- `chrome://flags/#language-detection-api`
- `chrome://flags/#proofreader-api-for-gemini-nano`
- `chrome://flags/#enable-webmcp-testing`

Restart Chrome after changing flags. Flags are a development mechanism, not a deployment strategy; public availability is controlled by each API's Chrome release and eligibility rules.

## Start with an interface

```vue
<script setup lang="ts">
import { Summarizer } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>

<template>
  <Summarizer />
</template>
```

The starter components already handle supported, downloadable, downloading, ready, processing, cancelled, and failed states. Generated prose supports Markdown—including headings, lists, tables, links, and code blocks—with raw HTML disabled. Their CSS uses custom properties and ordinary selectors, so it can be overridden by an application theme.

## Start headless

```ts
import { useSummarizer } from '@desource/browser-ai-vue';

const summarizer = useSummarizer();

await summarizer.init({
  type: 'key-points',
  format: 'markdown',
  length: 'medium'
});

// Keep this call in a click/keyboard handler when availability is downloadable.
await summarizer.create();

const result = await summarizer.summarizeWithDetails(sourceText, {
  context: 'Prioritize decisions, owners, and deadlines.'
});
```

Composables expose reactive state alongside native and production-oriented methods. Keep application policy—when to show the feature, what users may submit, and what fallback to use—in your own product layer.

## Design the availability experience

Chrome APIs generally report one of four states:

| State          | Product response                                                            |
| -------------- | --------------------------------------------------------------------------- |
| `available`    | Enable the feature; `create()` prepares a session                           |
| `downloadable` | Explain the local download and show a user-initiated action                 |
| `downloading`  | Keep the page open, show progress, and allow cancellation where appropriate |
| `unavailable`  | Keep the core workflow usable without local AI                              |

Never start a download on page load. Chrome requires meaningful user activation, and an unexpected model download is poor product behavior even where the browser permits it.

## Plan a fallback

Built-in AI may be unavailable because of Chrome version, channel, operating system, device capabilities, storage, language, region, enterprise policy, or model state. Pick a fallback before launch:

1. keep the manual workflow and hide the enhancement;
2. let the user retry after explaining requirements;
3. offer a hosted model only with clear disclosure and consent that data will leave the device.

Do not silently turn a local feature into a cloud feature. Privacy is part of the product contract.

## Understand model ownership

Chrome installs, updates, stores, and removes its models. Browser AI Kit cannot list model files, force installation, pin a version, or prevent eviction.

- Gemini Nano state can be inspected in `chrome://on-device-internals`.
- Translation resources can be inspected in `chrome://on-device-translation-internals/` in supported builds.
- A `downloadable` state can return after Chrome removes resources under storage pressure or policy changes.

Applications should always start from `availability()` rather than remembering an earlier result.

## Nuxt and SSR

The Nuxt module registers browser-dependent components in client mode and auto-imports composables:

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

Native sessions are never serialized into Nuxt payloads. If you use the Vue package directly in another SSR framework, create sessions after mounting and destroy them when the owning scope ends.

## Production checklist

- Feature-detect the API and render a useful unsupported state.
- Begin downloads only from a real user action.
- Keep an `AbortController` path for long work.
- Treat generated output as untrusted content. The built-in Markdown renderer disables raw HTML; custom renderers must provide equivalent sanitization.
- Avoid placing secrets in prompts or client-side tool definitions.
- Test model-ready and first-download paths separately.
- Test context limits and long content with representative data.
- Verify keyboard use, mobile layout, reduced motion, and screen-reader labels.
- For WebMCP, add deployment headers and enforce authorization inside each tool.

Continue with the [interactive documentation](https://ai.desource-labs.org/docs), the [verified API status](api-status.md), or the [WebMCP guide](webmcp.md).
