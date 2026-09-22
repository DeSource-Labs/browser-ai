# @desource/browser-ai-vue

Vue components and composables for Chrome's on-device Prompt API, Summarizer, Writer, Rewriter, Translator, Language Detector, Proofreader, and WebMCP. Existing composable signatures bind shared core engines to Vue refs and effect-scope cleanup.

[Live examples](https://ai.desourcelabs.com/#apis) · [Documentation](https://ai.desourcelabs.com/docs) · [GitHub](https://github.com/DeSource-Labs/browser-ai) · [Chrome API status](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md)

## Why use it?

Chrome's native AI APIs provide the model. This package provides the application lifecycle around it:

- reactive availability, download, progress, error, and abort states;
- streaming output and interruption controls;
- safe, styled Markdown rendering for model answers, code blocks, tables, and links;
- measured long-input chunking, batching, and context fitting;
- Prompt API chat persistence, structured JSON, clone, append, and automatic context compaction;
- SSR-safe browser access and reliable native-session cleanup;
- accessible starter interfaces that can be themed or replaced;
- lifecycle-safe WebMCP tools with support and deployment diagnostics.

Built-in inference stays in Chrome. This package adds no inference service, account, usage bill, or API key. Chat persistence stays in the application's browser origin; any hosted fallback belongs to the application and should be disclosed before sending content off-device.

## Install

```bash
npm install @desource/browser-ai-vue
```

Vue 3.4.33 or newer is required.

## Start with a component

```vue
<script setup lang="ts">
import { PromptApi } from '@desource/browser-ai-vue';
import '@desource/browser-ai-vue/assets/lib.css';
</script>

<template>
  <PromptApi context-strategy="summarize" context-summary-mode="cache-first" />
</template>
```

The component includes persisted chats, streaming Markdown responses, file attachments supported by the browser, model-download UX, stop controls, history navigation, and automatic recovery when a conversation outgrows the current context window. Raw HTML in model output is escaped rather than executed.

The same 11 component names are available in React, Svelte, and Angular: `PromptApi`, `Summarizer`, `Writer`, `Rewriter`, `Translator`, `LanguageDetector`, `Proofreader`, `MarkdownRenderer`, `PromptInput`, `ChatHistory`, and `ChatSidebar`. Vue includes a richer persisted-chat interface; the other framework components have smaller interfaces and can use the shared engines through their optional bindings.

Generated prose is rendered as Markdown by default. Set `:render-markdown="false"` when a product needs literal text. Proofreader keeps correction-range highlighting by default; opt into Markdown with `render-markdown` when the corrected document is the primary output.

For a custom interface, use the same renderer directly:

```vue
<script setup lang="ts">
import { MarkdownRenderer } from '@desource/browser-ai-vue';

defineProps<{ answer: string }>();
</script>

<template>
  <MarkdownRenderer :content="answer" />
</template>
```

## Build your own interface

The AI composables are thin adapters over `@desource/browser-ai/workflows`; `useWebMcp` uses the native core controller. A shallow snapshot and computed refs keep native browser sessions unproxied. Existing names such as `usePromptApi()` and `useSummarizer()` retain their workflow method signatures.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { usePromptApi } from '@desource/browser-ai-vue';

const input = ref('');
const output = ref('');
const ai = usePromptApi();

async function start() {
  await ai.init({
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }]
  });
  await ai.create();
}

async function send() {
  output.value = '';
  const stream = ai.promptStreaming(input.value);
  for await (const chunk of stream) {
    output.value += chunk;
  }
}
</script>
```

Call `create()` from a genuine click or key action when `availability` is `downloadable`; Chrome blocks model downloads without user activation. When called inside component setup or another active Vue effect scope, the composable disposes the engine and its subscription with that scope. Outside a scope, call `dispose()` explicitly. Use `interrupt()` to stop current work; `destroy()` releases the owned native session.

## Shared engines outside Vue

For direct imports, add the core package to the application's dependencies:

```bash
pnpm add @desource/browser-ai
```

The native root entry exposes small controllers. Optional `@desource/browser-ai/workflows` exports the advanced engines used by Vue's AI composables. They can also run without Vue:

```ts
import { createSummarizerWorkflow } from '@desource/browser-ai/workflows';

const summarizer = createSummarizerWorkflow();
const unsubscribe = summarizer.state.subscribe(() => {
  console.log(summarizer.state.getSnapshot().progressState);
});

try {
  const result = await summarizer.summarizeWithDetails(article, { chunking: 'auto' });
  console.log(result.summary);
} finally {
  unsubscribe();
  summarizer.dispose();
}
```

`useBrowserAiWorkflow(controller)` can bind a custom disposable core controller to Vue's scope and refs. Root native controllers and advanced workflow engines expose different method signatures; choose the entry that provides the required behavior. See the [framework contract](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/framework-roadmap.md).

## Structured output

```ts
const result = await ai.promptJson<{ sentiment: 'positive' | 'negative' }>('Classify: The update fixed everything.', {
  responseConstraint: {
    type: 'object',
    properties: {
      sentiment: {
        type: 'string',
        enum: ['positive', 'negative']
      }
    },
    required: ['sentiment'],
    additionalProperties: false
  }
});
```

`promptJson()` uses the browser's constrained-output support and parses the result into the supplied TypeScript type. Lower-level `prompt()`, `promptStreaming()`, `append()`, `clone()`, and usage measurement remain available.

## Multimodal attachments

`PromptApi` handles file inputs in its UI. For a custom interface, use the core attachment helpers and declare the required modalities on the workflow session:

```ts
import { buildPrompt, mergeExpectedInputs } from '@desource/browser-ai';

const attachments = [
  { name: 'notes.md', value: notesFile },
  { name: 'photo.png', value: imageFile },
  { name: 'voice.webm', value: audioBlob }
];
const input = await buildPrompt('Describe the image using the notes.', attachments);
await ai.create({
  expectedInputs: mergeExpectedInputs([{ type: 'text', languages: ['en'] }], attachments),
  expectedOutputs: [{ type: 'text', languages: ['en'] }]
});
const answer = await ai.prompt(input);
```

Image and audio values remain browser-native; text files are decoded locally with a configurable byte limit. `usePromptApi()` accepts native prompts and does not expose the native core controller's `promptWithAttachments()` convenience method. Explicit creation starts a new native session; restore application history when it must survive that replacement. Specialized text APIs accept decoded text, available through `readTextSource()`.

## Long content

The specialized composables use each native API's quota measurement instead of guessing with character limits:

```ts
import { useSummarizer } from '@desource/browser-ai-vue';

const summarizer = useSummarizer();
const result = await summarizer.summarizeWithDetails(article, {
  createOptions: {
    type: 'key-points',
    format: 'markdown',
    length: 'medium'
  },
  context: 'Focus on decisions and unresolved risks.'
});
```

When one request cannot fit, Summarizer creates measured chunks and recursive rollups. Translator preserves safe text boundaries. Writer and Rewriter can fit optional context while preserving the main task. Language Detector merges chunk confidence by weight. Proofreader normalizes correction ranges across safe chunks.

## Local chat persistence

`useAiChats(tool)` preserves its existing Vue interface while using `createAiChats()` from the optional `@desource/browser-ai/chats` entry. It exposes refs for chats, active selection, load state, processing, and errors, plus methods for loading, creation, renaming, messages, summaries, deletion, and restoration.

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useAiChats } from '@desource/browser-ai-vue';

const chats = useAiChats('project-assistant');
onMounted(() => {
  void chats.loadChats().catch(console.error);
});

async function createChat() {
  await chats.createChat('Trip planning');
}
</script>
```

`activeChatId` remains writable for existing integrations. Use `selectChat()` to persist the selection. Chat records and summary caches use IndexedDB; the selected chat ID uses localStorage. If IndexedDB is absent, browser controllers share an in-memory fallback that ends with the page. Database failures remain visible through operation errors. Server controllers use separate memory stores.

Scope disposal invalidates queued controller work and clears its view, while saved chats remain until explicitly deleted. The storage engine uploads no content. Local storage is separate from model inference and from any server fallback an application chooses to add.

## WebMCP

```ts
import { useWebMcp } from '@desource/browser-ai-vue';

const webMcp = useWebMcp();

const unregister = await webMcp.registerTool({
  name: 'get_order_status',
  description: 'Return the status of an order visible to the signed-in user.',
  inputSchema: {
    type: 'object',
    properties: { orderId: { type: 'string' } },
    required: ['orderId'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  execute: async ({ orderId }) => {
    // Re-check authorization here; tool descriptions are not a security boundary.
    return orders.getVisibleOrder(orderId);
  }
});

unregister();
```

`useWebMcp()` wraps `document.modelContext` with registration, discovery, execution, `toolchange` observation, same-/cross-origin options, and automatic Vue-scope cleanup. The wrapper follows `webmcp-types` 0.1.9: `executeTool(tool, inputObject)` accepts an object and returns a string, or `null` when execution navigates the document. Native input format is selected before execution: modern Chrome receives the object, while older Chrome's required JSON-string signature receives serialized input. `inputFormat: 'object' | 'json'` overrides detection for wrappers. Tools are never retried automatically. Literal schemas infer callback inputs, and annotations include `consequentialHint` and `debugging`. Declarative forms can use `createWebMcpFormAttributes()` and `createWebMcpFieldAttributes()`.

WebMCP is experimental. Your production document needs origin isolation and `Permissions-Policy: tools=(self)`. Read the [security and deployment guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md).

## Public surface

| Need                   | Exports                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Prompt and chat        | `PromptApi`, `PromptInput`, `ChatHistory`, `ChatSidebar`, `usePromptApi`, `useAiChats` |
| Summaries              | `Summarizer`, `useSummarizer`                                                          |
| Drafting and rewriting | `Writer`, `Rewriter`, `useWriter`, `useRewriter`                                       |
| Translation            | `Translator`, `useTranslator`, language option helpers                                 |
| Language detection     | `LanguageDetector`, `useLanguageDetector`, language option helpers                     |
| Proofreading           | `Proofreader`, `useProofreader`, language option helpers                               |
| Browser tools          | `useWebMcp`, `getWebMcpSupport`, declarative form helpers                              |
| Markdown output        | `MarkdownRenderer`                                                                     |

Result, option, progress, availability, message, correction, and tool types are exported from the package root.

## Browser support and fallbacks

Built-in AI availability depends on the Chrome version, channel, operating system, hardware, storage, language, region, profile policy, and model state. The package reports `available`, `downloadable`, `downloading`, or `unavailable`; it cannot make an ineligible browser eligible.

Plan an honest fallback: hide the feature, preserve manual editing, or route to a server feature only after obtaining the user's consent. Never imply that an unavailable local model is still private if you switch to a hosted service.

Experimental status differs by API. The [API status record](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md) tracks browser verification separately from type support. See the [getting-started guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/getting-started.md) for flags and download behavior.

## Native API or this package?

Use the native API directly for a small one-off call when you want to own every state. Use this package when you need a maintained framework boundary, streaming UI, long-input behavior, persistence, SSR safety, or consistent support across several built-in AI surfaces.

## License

[MIT](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE) © DeSource Labs
