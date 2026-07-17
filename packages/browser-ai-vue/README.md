# @desource/browser-ai-vue

Production-ready Vue components and composables for Chrome's on-device Prompt API, Summarizer, Writer, Rewriter, Translator, Language Detector, Proofreader, and WebMCP.

[Live examples](https://ai.desource-labs.org/#apis) · [Documentation](https://ai.desource-labs.org/docs) · [GitHub](https://github.com/DeSource-Labs/browser-ai) · [Chrome API status](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md)

## Why use it?

Chrome's native AI APIs provide the model. This package provides the application lifecycle around it:

- reactive availability, download, progress, error, and abort states;
- streaming without flooding Vue's render loop;
- measured long-input chunking, batching, and context fitting;
- Prompt API chat persistence, structured JSON, clone, append, and automatic context compaction;
- SSR-safe browser access and reliable native-session cleanup;
- accessible starter interfaces that can be themed or replaced;
- lifecycle-safe WebMCP tools with support and deployment diagnostics.

Inference stays in Chrome. There is no DeSource Labs inference service, account, usage bill, or API key.

## Install

```bash
npm install @desource/browser-ai-vue
```

Vue 3.4.33 or newer is required.

## Start with a component

```vue
<script setup lang="ts">
import { PromptApi } from "@desource/browser-ai-vue";
import "@desource/browser-ai-vue/assets/lib.css";
</script>

<template>
  <PromptApi context-strategy="summarize" context-summary-mode="cache-first" />
</template>
```

The component includes persisted chats, streaming responses, file attachments supported by the browser, model-download UX, stop controls, history navigation, and automatic recovery when a conversation outgrows the current context window.

The package also exports ready-made `<Summarizer />`, `<Writer />`, `<Rewriter />`, `<Translator />`, `<LanguageDetector />`, and `<Proofreader />` components.

## Build your own interface

Every UI component is powered by a public composable. Native sessions are held in shallow refs, so typing and unrelated state updates do not traverse browser-owned objects.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { usePromptApi } from "@desource/browser-ai-vue";

const input = ref("");
const output = ref("");
const ai = usePromptApi();

async function start() {
  await ai.init({
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
  });
  await ai.create();
}

async function send() {
  output.value = "";
  const stream = ai.promptStreaming(input.value);
  for await (const chunk of stream) {
    output.value += chunk;
  }
}
</script>
```

Call `create()` from a genuine click or key action when `availability` is `downloadable`; Chrome blocks model downloads without user activation.

## Structured output

```ts
const result = await ai.promptJson<{ sentiment: "positive" | "negative" }>(
  "Classify: The update fixed everything.",
  {
    responseConstraint: {
      type: "object",
      properties: {
        sentiment: {
          type: "string",
          enum: ["positive", "negative"],
        },
      },
      required: ["sentiment"],
      additionalProperties: false,
    },
  },
);
```

`promptJson()` uses the browser's constrained-output support and parses the result into the supplied TypeScript type. Lower-level `prompt()`, `promptStreaming()`, `append()`, `clone()`, and usage measurement remain available.

## Long content

The specialized composables use each native API's quota measurement instead of guessing with character limits:

```ts
import { useSummarizer } from "@desource/browser-ai-vue";

const summarizer = useSummarizer();
const result = await summarizer.summarizeWithDetails(article, {
  createOptions: {
    type: "key-points",
    format: "markdown",
    length: "medium",
  },
  context: "Focus on decisions and unresolved risks.",
});
```

When one request cannot fit, Summarizer creates measured chunks and recursive rollups. Translator preserves safe text boundaries. Writer and Rewriter can fit optional context while preserving the main task. Language Detector merges chunk confidence by weight. Proofreader normalizes correction ranges across safe chunks.

## WebMCP

```ts
import { useWebMcp } from "@desource/browser-ai-vue";

const webMcp = useWebMcp();

const unregister = await webMcp.registerTool({
  name: "get_order_status",
  description: "Return the status of an order visible to the signed-in user.",
  inputSchema: {
    type: "object",
    properties: { orderId: { type: "string" } },
    required: ["orderId"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  execute: async ({ orderId }) => {
    // Re-check authorization here; tool descriptions are not a security boundary.
    return orders.getVisibleOrder(String(orderId));
  },
});

unregister();
```

`useWebMcp()` wraps `document.modelContext` with registration, discovery, execution, `toolchange` observation, same-/cross-origin options, and automatic Vue-scope cleanup. Declarative forms can use `createWebMcpFormAttributes()` and `createWebMcpFieldAttributes()`.

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

Result, option, progress, availability, message, correction, and tool types are exported from the package root.

## Browser support and fallbacks

Built-in AI availability depends on the Chrome version, channel, operating system, hardware, storage, language, region, profile policy, and model state. The package reports `available`, `downloadable`, `downloading`, or `unavailable`; it cannot make an ineligible browser eligible.

Plan an honest fallback: hide the feature, preserve manual editing, or route to a server feature only after obtaining the user's consent. Never imply that an unavailable local model is still private if you switch to a hosted service.

See the [getting-started guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/getting-started.md) for flags and download behavior.

## Native API or this package?

Use the native API directly for a small one-off call when you want to own every state. Use this package when you need a maintained framework boundary, streaming UI, long-input behavior, persistence, SSR safety, or consistent support across several built-in AI surfaces.

## License

[MIT](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE) © DeSource Labs
