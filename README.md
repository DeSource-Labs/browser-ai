<div align="center">
  <img src="demo/public/logo/android-chrome-192x192.png" alt="Browser AI Kit" width="88" height="88" />

# Browser AI Kit

**Build local AI features and browser-agent tools in Vue, React, Svelte, Angular, Nuxt, and TypeScript.**

[Website](https://ai.desourcelabs.com) · [Documentation](https://ai.desourcelabs.com/docs) · [Live examples](https://ai.desourcelabs.com/#apis) · [API status](docs/api-status.md)

[![CI](https://github.com/DeSource-Labs/browser-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/DeSource-Labs/browser-ai/actions/workflows/ci.yml)
[![npm core](https://img.shields.io/npm/v/@desource/browser-ai?label=core)](https://www.npmjs.com/package/@desource/browser-ai)
[![npm Vue](https://img.shields.io/npm/v/@desource/browser-ai-vue?label=Vue)](https://www.npmjs.com/package/@desource/browser-ai-vue)
[![npm React](https://img.shields.io/npm/v/@desource/browser-ai-react?label=React)](https://www.npmjs.com/package/@desource/browser-ai-react)
[![npm Svelte](https://img.shields.io/npm/v/@desource/browser-ai-svelte?label=Svelte)](https://www.npmjs.com/package/@desource/browser-ai-svelte)
[![npm Angular](https://img.shields.io/npm/v/@desource/browser-ai-angular?label=Angular)](https://www.npmjs.com/package/@desource/browser-ai-angular)
[![MIT](https://img.shields.io/badge/license-MIT-7c3aed)](LICENSE)

</div>

Chrome supplies the models. Browser AI Kit adds observable availability, download progress, streaming, cancellation, attachments, and framework components. Shared workflows handle long inputs, batches, and chat restoration; an optional conversation engine adds saved chats. Built-in inference stays in Chrome; the packages add no inference server or API key.

## Packages

| Package                        | Native integration                                | UI                                       |
| ------------------------------ | ------------------------------------------------- | ---------------------------------------- |
| `@desource/browser-ai`         | Framework-neutral external stores and controllers | Headless                                 |
| `@desource/browser-ai-vue`     | Vue composables and scope cleanup                 | 11 Vue components                        |
| `@desource/browser-ai-react`   | React hooks and external-store subscriptions      | 11 React components                      |
| `@desource/browser-ai-svelte`  | Svelte stores and explicit disposal               | 11 Svelte components                     |
| `@desource/browser-ai-angular` | Angular signals, services, and destroy hooks      | 11 standalone components                 |
| `@desource/browser-ai-nuxt`    | Client-safe auto-imports and module configuration | Vue components, registered automatically |

Every framework package exposes the same eight capability adapters:

- Prompt API
- Summarizer
- Writer
- Rewriter
- Translator
- Language Detector
- Proofreader
- WebMCP

Vue, React, Svelte, and Angular expose the same component set: `PromptApi`, `Summarizer`, `Writer`, `Rewriter`, `Translator`, `LanguageDetector`, `Proofreader`, `MarkdownRenderer`, `PromptInput`, `ChatHistory`, and `ChatSidebar`. Their text tools use shared advanced workflows, settings, and progress reporting. Their chat components share saved-chat management, automatic context restoration, streaming, and interruption. Props and events follow each framework's conventions.

## Install

```bash
pnpm add @desource/browser-ai-vue      # Vue
pnpm add @desource/browser-ai-react    # React
pnpm add @desource/browser-ai-svelte   # Svelte
pnpm add @desource/browser-ai-angular  # Angular
pnpm add @desource/browser-ai-nuxt     # Nuxt
pnpm add @desource/browser-ai          # Plain TypeScript
```

Import the framework stylesheet only when using components:

```ts
import '@desource/browser-ai-react/assets/lib.css';
```

The equivalent `assets/lib.css` export exists in the Vue, Svelte, and Angular packages.

### Component-first

```tsx
import { PromptApi } from '@desource/browser-ai-react';
import '@desource/browser-ai-react/assets/lib.css';

export function LocalAssistant() {
  return <PromptApi />;
}
```

The same component is available as `<PromptApi />` in Vue and Svelte and as `<browser-ai-prompt-api />` in Angular. Nuxt registers it client-side. Set a distinct `chatKey` for assistants that should keep separate saved histories.

### Headless

```ts
import { createPromptApi } from '@desource/browser-ai';

const ai = createPromptApi({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }]
});

await ai.init(); // Check availability without starting a download.

// Call from the user's send action if model resources need downloading.
async function ask(message: string) {
  return ai.prompt(message);
}

// When the owning screen or application closes:
ai.dispose();
```

React hooks, Svelte stores, and Angular controllers bind native core operations to framework state. Vue preserves its existing composable API through the advanced workflows described below. For a headless Angular integration, import `createAngularPromptApi` from `@desource/browser-ai-angular/controllers` to keep component rendering dependencies outside the entry point.

## Multimodal and file prompts

Prompt API accepts text, image, and audio input. Browser AI Kit also reads text-like files into labeled prompt content and updates `expectedInputs` before creating the session.

```ts
const answer = await ai.promptWithAttachments('Compare these inputs.', [
  { name: 'notes.md', value: notesFile },
  { name: 'reference.png', value: imageFile },
  { name: 'voice.webm', value: audioBlob }
]);
```

Images may use the browser-native visual values accepted by Prompt API; audio may use `AudioBuffer`, `ArrayBuffer`, views, or `Blob`. Text attachments are bounded and decoded locally. See [Getting started](docs/getting-started.md#multimodal-and-file-input).

## Optional workflows for long inputs and history

The root core controllers expose native operations, including Prompt streaming, append, clone, context usage, constrained output, and attachment handling. Import `@desource/browser-ai/workflows` when the application needs measured chunking, context fitting, batches, or chat restoration:

```ts
import { createSummarizerWorkflow } from '@desource/browser-ai/workflows';

const summarizer = createSummarizerWorkflow();
const unsubscribe = summarizer.state.subscribe(() => {
  console.log(summarizer.state.getSnapshot().progressState);
});

try {
  // Run from a user action when creation requires a model download.
  const result = await summarizer.summarizeWithDetails(articleText, { chunking: 'auto' });
  console.log(result.summary, result.chunks.length);
} finally {
  unsubscribe();
  summarizer.dispose();
}
```

Each workflow has a policy suited to its API:

| API               | Long-input behavior                                     |
| ----------------- | ------------------------------------------------------- |
| Summarizer        | Measured chunks and recursive rollups                   |
| Writer / Rewriter | Preserves the main task while fitting optional context  |
| Translator        | Boundary-safe ordered chunks                            |
| Language Detector | Weighted confidence merging                             |
| Proofreader       | Correct range offsets across chunks                     |
| Prompt            | Measured history restoration and optional summary cache |

React exposes `usePromptWorkflow`, `useSummarizerWorkflow`, and the other workflow hooks from `@desource/browser-ai-react/workflows`. Svelte exposes `createSvelte*Workflow` factories from `@desource/browser-ai-svelte/workflows`. Angular's `createAngular*Workflow` factories live in `@desource/browser-ai-angular/controllers`. Vue's existing `use*` AI composables already bind these engines. See the [core examples](packages/core/README.md#optional-advanced-workflows) and [framework contract](docs/framework-roadmap.md).

## Saved conversations

The optional `@desource/browser-ai/conversation` entry powers all four chat components. It combines saved-chat operations, session reuse, context restoration, and cancellation for custom interfaces:

```ts
import { createConversation } from '@desource/browser-ai/conversation';

const chat = createConversation({
  chatKey: 'project-assistant',
  autoInit: false,
  systemPrompt: 'Keep answers concise.'
});

await chat.load(); // Read saved history without creating a model.

// Connect this function to the user's send action.
async function sendMessage(text: string) {
  return chat.send(text);
}

// When the owning screen closes:
chat.dispose();
```

Completed text history and context summaries are stored in IndexedDB, with an in-memory fallback when IndexedDB is unavailable. Text-file content survives reloads as prompt text. Raw image/audio attachments remain available across chat switches only while the same conversation controller lives; their bytes are not persisted. Components release preview URLs when messages leave the visible chat or the component unmounts.

## WebMCP that changes something real

The Nuxt demo lets an agent search Lisbon workspaces, edit a visible shortlist, and fill a visit-draft form. Smaller framework demos register a task-creation tool and render the resulting task. These examples use both registration styles:

- imperative tools through `document.modelContext.registerTool()`;
- declarative tools through a normal accessible HTML form.

```ts
import { createWebMcp } from '@desource/browser-ai';

const webMcp = createWebMcp();
const unregister = await webMcp.registerTool({
  name: 'create_project_task',
  description: 'Create a task in the active project.',
  inputSchema: {
    type: 'object',
    properties: { title: { type: 'string', minLength: 1 } },
    required: ['title'],
    additionalProperties: false
  },
  execute: async ({ title }) => taskStore.add(title)
});

const tools = await webMcp.refreshTools();
const tool = tools.find(({ name }) => name === 'create_project_task');
if (tool) {
  const resultText = await webMcp.executeTool(tool, { title: 'Review the itinerary' });
  console.log(resultText);
}

unregister();
webMcp.dispose();
```

The wrapper targets `webmcp-types` 0.1.9. Pass an input object and receive the native `string | null` result; `null` can indicate that execution navigated the target document. Schema literals infer callback input types, and annotations include `consequentialHint` and `debugging`.

The inspected **Chrome 153.0.8010.53 arm64** build still uses the earlier JSON-text native argument. The wrapper selects object or JSON input from the native method's declared argument count before execution. It never retries a tool call automatically. For wrapped implementations that hide this distinction, pass `{ inputFormat: 'object' }` or `{ inputFormat: 'json' }` as the third argument. See the [exact browser revision and verification boundary](docs/api-status.md#verification-record). Executors remain responsible for application authorization and business validation.

## Browser support

Prompt API is available on the web from Chrome 148 on eligible desktop devices. Other built-in APIs have their own rollout, platform, language, storage, and hardware constraints. WebMCP remains experimental through an origin trial or `chrome://flags/#enable-webmcp-testing`.

Always render an unsupported path. Never begin a model download on page load. If a cloud fallback sends user content off-device, disclose that boundary before switching.

See the dated, source-linked [API status](docs/api-status.md) for exact capabilities and flags.

## Architecture and maintenance contract

The core keeps optional features behind separate entries:

| Entry                               | Purpose                                               |
| ----------------------------------- | ----------------------------------------------------- |
| `@desource/browser-ai`              | Native controllers, attachments, and WebMCP           |
| `@desource/browser-ai/workflows`    | Long-input policies, batches, and history restoration |
| `@desource/browser-ai/chats`        | Saved text histories and summary storage              |
| `@desource/browser-ai/conversation` | Chat orchestration and attachment-view helpers        |

Framework adapters bind these stores to refs, hooks, readable stores, or signals. The native entry does not import the optional workflow or conversation engines.

Shared styles live in `common/styles`; shared component contracts live in `common/tests/unit`; shared browser scenarios live in `common/tests/e2e`. Core algorithm and lifecycle tests live in `packages/core/test`. `pnpm check:framework-parity` checks required exports, and `pnpm check:bundles` measures representative consumer imports to catch accidental UI or Markdown dependencies in headless bundles.

The latest local bundle check measured about **3.30–6.07 KB minified gzip** for representative single-adapter imports. Those measurements include the imported library code with framework runtimes external; they exclude component UI and CSS. Actual application size depends on the selected exports and bundler. Run the bundle check after building the release candidate.

## Testing this repository

```bash
pnpm install
pnpm run ci
```

`pnpm run ci` checks formatting, lint, framework parity, peer ranges, production audit, every library and demo build, headless bundle budgets, types, package exports, unit coverage, and unsupported-browser e2e behavior. Each coverage metric has a 95% minimum.

Live tests attach to an already-running Chrome profile so they reuse the user's downloaded models and enabled flags:

```bash
BROWSER_AI_CDP_ENDPOINT=http://127.0.0.1:9222 pnpm test:e2e:live
```

The browser must expose a CDP endpoint for this command. Tests open and close only their own pages and reuse the existing profile. Downloadable Translator resources are checked without installation unless `BROWSER_AI_ALLOW_MODEL_DOWNLOADS=1` is set. The live project skips when no endpoint is configured. The [dated API record](docs/api-status.md#verification-record) records passing release checks, manual native Chrome results, and browser-dependent skips.

## Documentation

- [Getting started](docs/getting-started.md)
- [Current API status](docs/api-status.md)
- [Framework contract](docs/framework-roadmap.md)
- [WebMCP guide](docs/webmcp.md)
- [Why Browser AI Kit](docs/why-browser-ai-kit.md)
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE) © DeSource Labs
