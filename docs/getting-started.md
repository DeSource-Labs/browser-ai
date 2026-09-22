# Getting started

Browser AI Kit connects framework applications to models and tools exposed by Chrome. Inference runs in the browser, so there is no Browser AI Kit backend or model API key.

Chrome remains in control of eligibility, downloads, languages, storage, and model lifetime. Treat built-in AI as a progressive enhancement and keep the primary workflow usable when an API is absent.

## Choose a package

```bash
pnpm add @desource/browser-ai          # Plain TypeScript
pnpm add @desource/browser-ai-vue      # Vue 3
pnpm add @desource/browser-ai-react    # React 18 or 19
pnpm add @desource/browser-ai-svelte   # Svelte 5
pnpm add @desource/browser-ai-angular  # Angular 22.1.7+
pnpm add @desource/browser-ai-nuxt     # Nuxt 3.17+ or 4
```

Vue, React, Svelte, and Angular expose the same 11 components and eight headless capability adapters. Nuxt adds auto-imports around the Vue package. The plain package is the shared runtime with no framework dependency.

## Prepare Chrome

Use a supported desktop Chrome build. Depending on Chrome channel and the API being tested, enable the relevant flags:

- `chrome://flags/#optimization-guide-on-device-model`
- `chrome://flags/#prompt-api-for-gemini-nano`
- `chrome://flags/#writer-api-for-gemini-nano`
- `chrome://flags/#rewriter-api-for-gemini-nano`
- `chrome://flags/#translation-api`
- `chrome://flags/#language-detection-api`
- `chrome://flags/#proofreader-api-for-gemini-nano`
- `chrome://flags/#enable-webmcp-testing`

Restart Chrome after changing flags. Flags are for local development; production availability is controlled by the API's Chrome rollout and device requirements.

Inspect Gemini Nano state at `chrome://on-device-internals` and translation resources at `chrome://on-device-translation-internals/` where available.

## Start with a component

Import the package stylesheet once when using the starter components.

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

## Start headless

The core controller uses a subscribable external store:

```ts
import { createSummarizer } from '@desource/browser-ai';

const summarizer = createSummarizer({
  type: 'key-points',
  format: 'markdown',
  length: 'medium'
});

const unsubscribe = summarizer.state.subscribe(() => {
  console.log(summarizer.state.getSnapshot());
});

await summarizer.init();
await summarizer.create();
const result = await summarizer.run('Long source text…', { context: 'Prioritize decisions, owners, and deadlines.' });

unsubscribe();
summarizer.dispose();
```

Framework adapters expose the same operations with native reactive state:

| Capability        | Vue / React           | Svelte                   | Angular                         |
| ----------------- | --------------------- | ------------------------ | ------------------------------- |
| Prompt API        | `usePromptApi`        | `createPromptApi`        | `createAngularPromptApi`        |
| Summarizer        | `useSummarizer`       | `createSummarizer`       | `createAngularSummarizer`       |
| Writer            | `useWriter`           | `createWriter`           | `createAngularWriter`           |
| Rewriter          | `useRewriter`         | `createRewriter`         | `createAngularRewriter`         |
| Translator        | `useTranslator`       | `createTranslator`       | `createAngularTranslator`       |
| Language Detector | `useLanguageDetector` | `createLanguageDetector` | `createAngularLanguageDetector` |
| Proofreader       | `useProofreader`      | `createProofreader`      | `createAngularProofreader`      |
| WebMCP            | `useWebMcp`           | `createWebMcp`           | `createAngularWebMcp`           |

## Design the availability flow

Call `init()` or `requestAvailability()` with the exact options used for creation.

| State          | Product response                                           |
| -------------- | ---------------------------------------------------------- |
| `available`    | Enable the feature; create or reuse a session              |
| `downloadable` | Explain the local download and expose a real user action   |
| `downloading`  | Show progress, keep the page open, and expose cancellation |
| `unavailable`  | Preserve the manual workflow and explain requirements      |

Do not start downloads on page load. Chrome requires meaningful user activation for downloadable resources, and an unexpected model download is poor product behavior.

## Multimodal and file input

Prompt API accepts text, image, and audio messages. `promptWithAttachments()` and `promptStreamingWithAttachments()` build the browser message and ensure the session declares every required modality:

```ts
const result = await prompt.promptWithAttachments(
  'Use the notes and recording to describe the image.',
  [
    { name: 'notes.md', value: notesFile },
    { name: 'reference.png', value: imageFile },
    { name: 'meeting.webm', value: audioBlob }
  ],
  { maxTextFileBytes: 2 * 1024 * 1024 }
);
```

Supported attachment values:

- text: string, `Blob`/`File`, `ArrayBuffer`, or an array-buffer view;
- image: any visual source accepted by Chrome's Prompt API, including image/canvas/video sources, `ImageBitmap`, `ImageData`, `VideoFrame`, and `Blob`;
- audio: `AudioBuffer`, `ArrayBuffer`, array-buffer view, or `Blob`.

Set `kind` explicitly when a value has no useful MIME type. Text files are decoded on-device and rejected above the configured byte limit. The library does not upload attachments.

## Structured Prompt output

```ts
const classification = await prompt.promptJson<{ sentiment: 'positive' | 'negative' }>(
  'Classify: The update fixed everything.',
  {
    type: 'object',
    properties: {
      sentiment: { type: 'string', enum: ['positive', 'negative'] }
    },
    required: ['sentiment'],
    additionalProperties: false
  }
);
```

This uses Chrome's `responseConstraint` option and parses the constrained response. For lower-level control, pass `responseConstraint` and `omitResponseConstraintInput` to `prompt()` or `promptStreaming()` directly.

## WebMCP

Register tools only while their UI and authorization context exist:

```ts
const unregister = await webMcp.registerTool({
  name: 'create_project_task',
  description: 'Create a task in the project currently shown to the user.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1 },
      priority: { type: 'string', enum: ['low', 'normal', 'high'] }
    },
    required: ['title'],
    additionalProperties: false
  },
  execute: async ({ title, priority = 'normal' }, { signal }) => {
    signal.throwIfAborted();
    return taskStore.add(String(title), String(priority));
  }
});

unregister();
```

For a normal form, use `createWebMcpFormAttributes()` and `createWebMcpFieldAttributes(description)`. The human interface must remain functional without WebMCP. See the [WebMCP guide](webmcp.md).

## Unsupported browsers and fallback policy

Built-in AI may be absent because of browser version, operating system, device capability, storage, language, region, managed policy, or resource state.

Choose the fallback before launch:

1. keep the manual workflow and hide or disable the enhancement;
2. explain requirements and let the user retry;
3. offer a hosted model only after clearly disclosing that data will leave the device.

Never silently change a local feature into a cloud request.

## Test with and without Chrome AI

The repository has two Playwright projects for each framework demo.

The default suite launches ordinary bundled Chromium. It has no built-in AI globals and verifies all components render useful unsupported states:

```bash
pnpm test:e2e
```

The live suite attaches to the user's already-running Chrome, reusing enabled flags and downloaded models:

1. Open `chrome://inspect/#remote-debugging` in that Chrome.
2. Enable **Allow remote debugging for this browser instance**.
3. Run:

```bash
BROWSER_AI_CDP_ENDPOINT=http://127.0.0.1:9222 pnpm test:e2e:live
```

The tests use Playwright's Chromium-only `connectOverCDP()` path with `noDefaults: true`. They open and close their own page, never close the user's browser, and do not trigger resources reported as `downloadable`. Set `BROWSER_AI_ALLOW_MODEL_DOWNLOADS=1` only for an intentional test-time download. Do not expose the DevTools endpoint outside the local machine.

## Production checklist

- Feature-detect the exact API and options.
- Begin downloads only from a genuine user action.
- Preserve an abort path for creation, streaming, and long work.
- Dispose sessions and WebMCP registrations with their owning scope.
- Treat generated output and tool output as untrusted content.
- Keep secrets out of client prompts and tool definitions.
- Test first-download, ready, unsupported, abort, and quota-exhaustion paths.
- Test keyboard use, mobile layout, reduced motion, and screen-reader names.
- Deploy WebMCP origin-isolation and Permissions-Policy headers.
- Re-check authorization and validate input inside every WebMCP executor.

Continue with the [API status](api-status.md), [framework contract](framework-roadmap.md), and [WebMCP guide](webmcp.md).
