# @desource/browser-ai

[![Core](https://img.shields.io/npm/v/@desource/browser-ai?color=blue&logo=typescript)](https://www.npmjs.com/package/@desource/browser-ai)
[![Coverage](https://codecov.io/gh/DeSource-Labs/browser-ai/branch/main/graph/badge.svg)](https://codecov.io/gh/DeSource-Labs/browser-ai)
[![SonarCloud](https://sonarcloud.io/api/project_badges/measure?project=DeSource-Labs_browser-ai&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DeSource-Labs_browser-ai)
[![Ask Context7](https://img.shields.io/badge/Ask%20Context7-059669.svg?logo=data:image/svg%2bxml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI0IDBINEMxLjc5MDg2IDAgMCAxLjc5MDg2IDAgNFYyNEMwIDI2LjIwOTEgMS43OTA4NiAyOCA0IDI4SDI0QzI2LjIwOTEgMjggMjggMjYuMjA5MSAyOCAyNFY0QzI4IDEuNzkwODYgMjYuMjA5MSAwIDI0IDBaIiBmaWxsPSIjRjdGMkU4IiBmaWxsLW9wYWNpdHk9IjAuNjUiLz4KPHBhdGggZD0iTTEwLjYgMTUuMjk5MkMxMC42IDE3LjQ5OTIgOS43MDAwNSAxOS4zOTkyIDguMjAwMDUgMjEuMDk5MkgxMS42VjIyLjc5OTJINi4zMDAwNVYyMS4xOTkyQzguMDAwMDUgMTkuMzk5MiA4LjYwMDA1IDE3Ljg5OTIgOC42MDAwNSAxNS4yOTkySDEwLjZaTTE3LjQgMTUuMjk5MkMxNy40IDE3LjQ5OTIgMTguMyAxOS4zOTkyIDE5LjggMjEuMDk5MkgxNi40VjIyLjc5OTJIMjEuN1YyMS4xOTkyQzIwIDE5LjM5OTIgMTkuNCAxNy44OTkyIDE5LjQgMTUuMjk5MkgxNy40Wk0xMC42IDEyLjY5OTJDMTAuNiAxMC40OTkyIDkuNzAwMDUgOC41OTkyMiA4LjIwMDA1IDYuODk5MjJIMTEuNlY1LjE5OTIySDYuMzAwMDVWNi43OTkyMkM4LjAwMDA1IDguNTk5MjIgOC42MDAwNSAxMC4wOTkyIDguNjAwMDUgMTIuNjk5MkgxMC42Wk0xNy40IDEyLjY5OTJDMTcuNCAxMC40OTkyIDE4LjMgOC41OTkyMiAxOS44IDYuODk5MjJIMTYuNFY1LjE5OTIySDIxLjdWNi43OTkyMkMyMCA4LjU5OTIyIDE5LjQgMTAuMDk5MiAxOS40IDEyLjY5OTJIMTcuNFoiIGZpbGw9ImJsYWNrIi8+Cjwvc3ZnPgo=)](https://context7.com/desource-labs/browser-ai)
[![Ask DeepWiki](https://img.shields.io/badge/Ask%20DeepWiki-1c398e.svg?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0iI2NiY2JjYiIgYXJpYS1oaWRkZW49InRydWUiPjxwYXRoIGQ9Ik0xOC42IDIwLjFxMS0uNiAyLjItLjZoLjNhNCA0IDAgMCAxIDIgLjdoLjJ2LjFsMSAxaC4xdi4yaC4xbC4xLjF2LjFxLjcgMSAuNyAyLjN0LS42IDIuMnYuMWwtLjIuMkE0IDQgMCAwIDEgMjMgMjhoLS4ydi4xbC0xLjQuNGgtLjVxLTEuMyAwLTIuMy0uNWwtNC4xLTIuNC04LjMgNC44djkuNWw4LjMgNC44IDguMi00LjhWMzVxMC0xLjIuNi0yLjJ2LS4xbC4yLS4yYTQgNCAwIDAgMSAxLjctMS41bDEuMy0uNGguNnExLjMgMCAyLjMuNmw0LjIgMi4zIDguMi00Ljd2LTkuNmwtOC4yLTQuNy00LjIgMi4zcS0xIC42LTIuMi42aC0uM2E0IDQgMCAwIDEtMi0uNmwtLjItLjEtMS0xaC0uMXYtLjJoLS4xbC0uMS0uMnYtLjFxLS43LTEtLjctMi4yVjguMmwtOC4yLTQuNy04LjMgNC43djkuNWw4LjIgNC44eiIvPjwvc3ZnPg==)](https://deepwiki.com/DeSource-Labs/browser-ai)
[![MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE)

[Documentation](https://ai.desourcelabs.com/docs) · [Examples](https://ai.desourcelabs.com/#apis) · [GitHub](https://github.com/DeSource-Labs/browser-ai)

Private, on-device AI for plain TypeScript and custom interfaces. Use Chrome's local models for chat, summaries, writing, translation, language detection, and proofreading. Prompts are processed on the user's device, with no inference server or API key to configure.

Controllers expose availability, download progress, streaming, cancellation, and observable state. Optional entries add long-input handling, saved chats, and context restoration. WebMCP controllers register application tools for browser agents.

This is also the shared core behind the Vue, React, Svelte, Angular, and Nuxt packages. It has no framework runtime dependency.

## Install

```bash
npm install @desource/browser-ai
```

Run model operations in Chrome on HTTPS or localhost. First use may require a model or language-pack download from a user action. See [Browser setup](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/browser-support.md#try-it-in-your-browser).

### Choose an entry

| Entry                               | Use it for                                             |
| ----------------------------------- | ------------------------------------------------------ |
| `@desource/browser-ai`              | Native API controllers, attachments, and WebMCP        |
| `@desource/browser-ai/workflows`    | Long-input policies, batches, and history restoration  |
| `@desource/browser-ai/chats`        | IndexedDB text histories and summary storage           |
| `@desource/browser-ai/conversation` | A complete conversation controller and preview helpers |

The native entry does not import the optional engines. Vue, React, Svelte, and Angular text components use the shared advanced workflows; their chat components use the conversation engine. Headless applications can choose these behaviors independently.

## Quick start

```ts
import { createPromptApi } from '@desource/browser-ai';

const prompt = createPromptApi({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }]
});

const unsubscribe = prompt.state.subscribe(() => {
  const { availability, processing, downloadProgress, error } = prompt.state.getSnapshot();
  console.log({ availability, processing, downloadProgress, error });
});

await prompt.init(); // Check availability without starting a download.

// Connect this function to the user's send action.
async function ask(message: string) {
  return prompt.prompt(message);
}

// Connect this cleanup to the owning screen or application's lifecycle.
function disposeAssistant() {
  unsubscribe();
  prompt.dispose();
}
```

`prompt()` creates a session when needed and reuses it for subsequent calls. Creation that needs model resources must run from a genuine user action. Read availability and show download progress in the application.

The controller also exposes `promptStreaming()`, `promptStreamingToText()`, `append()`, `clone()`, `measureContextUsage()`, `promptJson()`, attachment methods, and interruption. Its snapshot includes context usage and context overflow counts. Destroy cloned sessions when finished; they belong to the caller.

### Structured output

Use `promptJson()` when your interface needs data it can render directly:

```ts
const classification = await prompt.promptJson<{ sentiment: 'positive' | 'negative' }>(
  'Classify: The update fixed everything.',
  {
    type: 'object',
    properties: { sentiment: { type: 'string', enum: ['positive', 'negative'] } },
    required: ['sentiment'],
    additionalProperties: false
  }
);
```

This passes a JSON Schema through Chrome's `responseConstraint` option and parses the response. The TypeScript type describes the expected result; validate any application-specific rules before using it for an action.

## Attachments and text files

```ts
const answer = await prompt.promptWithAttachments('Compare these inputs.', [
  { name: 'notes.md', value: notesFile },
  { name: 'reference.png', value: imageFile },
  { name: 'voice.webm', value: audioBlob }
]);
```

Image and audio values pass to Chrome without transcoding. The controller merges the required `expectedInputs` and replaces a session when a new modality requires it. Replacing a session starts new native history; use explicit initial prompts or a restoration workflow when the application needs to retain earlier context.

Text-like files, blobs, buffers, and views are decoded locally with a configurable byte limit. `buildPrompt()` constructs a native prompt without creating a session. Text-only APIs can use `readTextSource()`:

```ts
import { createSummarizer, readTextSource } from '@desource/browser-ai';

const summarizer = createSummarizer();
try {
  const text = await readTextSource(notesFile, { maxBytes: 2 * 1024 * 1024 });
  const summary = await summarizer.summarize(text);
  console.log(summary);
} finally {
  summarizer.dispose();
}
```

The helpers decode text; they do not parse PDF or office-document formats. Image and audio inputs are supported by Prompt API, while the specialized APIs consume text.

## Other native controllers

The root entry exports `createSummarizer`, `createWriter`, `createRewriter`, `createTranslator`, `createLanguageDetector`, and `createProofreader`.

These AI controllers share availability checks, `init()`, `create()`, `ensure()`, `configure()`, observable `state`, `interrupt()`, `destroy()`, and `dispose()`. Session options determine reuse; changing options recreates the native session when needed.

Summarizer, Writer, Rewriter, and Translator expose `run()`, `runStreaming()`, `runStreamingToText()`, and `measureInputUsage()`, plus native aliases such as `summarize()` or `translate()`. Language Detector and Proofreader retain their structured native results. Long-input policies are provided by the optional workflow entry below.

## Optional advanced workflows

Import `@desource/browser-ai/workflows` to use the engines shared by all four frameworks. Vue's existing AI composables bind these engines; React and Svelte expose separate `/workflows` bindings, and Angular exposes them from `/controllers`.

| Factory                                           | Added behavior                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `createPromptWorkflow`                            | Measured history restoration, recent-message selection, optional summary cache |
| `createSummarizerWorkflow`                        | Measured chunks, summary rollup, detailed progress                             |
| `createWriterWorkflow` / `createRewriterWorkflow` | Measured context fitting and ordered batches                                   |
| `createTranslatorWorkflow`                        | Ordered chunks, language-pair handling, batches                                |
| `createLanguageDetectorWorkflow`                  | Chunked detection and weighted result aggregation                              |
| `createProofreaderWorkflow`                       | Chunked proofreading with corrected global ranges                              |

Workflows preserve their own operation names and detailed result types. They share the snapshot/subscription contract with native controllers, but do not have identical method signatures. Call model-creating examples from a user action when downloads are required.

### Measured summaries

```ts
import { createSummarizerWorkflow } from '@desource/browser-ai/workflows';

const summarizer = createSummarizerWorkflow();
const unsubscribe = summarizer.state.subscribe(() => {
  const { processing, progressState, output } = summarizer.state.getSnapshot();
  console.log({ processing, progressState, output });
});

try {
  const result = await summarizer.summarizeWithDetails(articleText, {
    createOptions: { type: 'key-points', format: 'plain-text', length: 'short' },
    chunking: 'auto',
    chunkBudgetRatio: 0.72
  });
  console.log(result.summary, result.chunked, result.chunks);
} finally {
  unsubscribe();
  summarizer.dispose();
}
```

`summarizeWithDetails()` measures input, splits it when the configured budget requires it, and combines partial summaries. `summarizeStreaming()` exposes the native single-input stream; it requires an existing session and does not run the chunk-and-rollup path.

### Context fitting and batches

```ts
import { createWriterWorkflow } from '@desource/browser-ai/workflows';

const writer = createWriterWorkflow();
try {
  const batch = await writer.writeMany(
    [
      { input: 'Write a one-sentence product description.', context: productNotes },
      { input: 'Write a short release announcement.', context: releaseNotes }
    ],
    {
      createOptions: { tone: 'formal', length: 'short' },
      fitStrategy: 'truncate-context',
      continueOnError: true
    }
  );
  console.log(batch.results, batch.failures);
} finally {
  writer.dispose();
}
```

Batches run in input order and reuse compatible sessions. With `continueOnError`, failed positions contain `null` and `failures` contains the errors. Context fitting shortens optional context while preserving the main input; an input that cannot fit still fails. Interruption stops the remaining batch.

### Restore a conversation

```ts
import { createPromptWorkflow } from '@desource/browser-ai/workflows';

const chat = createPromptWorkflow();
try {
  const restored = await chat.restoreSession(
    [
      { role: 'system', content: 'Keep answers concise.' },
      { role: 'user', content: 'I am planning a train trip to Lisbon.' },
      { role: 'assistant', content: 'Which city will you depart from?' }
    ],
    { autoCreate: true, strategy: 'recent' }
  );
  if (restored.ready) {
    console.log(await chat.prompt('Porto. Suggest a morning departure.'));
  }
} finally {
  chat.dispose();
}
```

`strategy: 'recent'` keeps the newest conversation that fits. `strategy: 'summarize'` can combine older context into summaries. `summaryMode: 'cache-first'` uses available summaries and schedules missing cache work; `summaryMode: 'eager'` waits for that work. Pass `summaryCache`, message metadata, and `onSummaryCacheUpdate` to persist reusable summaries in the application's storage. `allowDownloadCreate: true` explicitly permits restoration to create downloadable resources from a user action.

Disposal cancels restoration and background summary work, clears scheduled timers, and destroys owned sessions. The workflow does not provide a persistence database or chat UI.

## Saved conversations and custom chat interfaces

`createConversation()` combines the Prompt workflow with local chat storage. It owns the active native session, restores selected histories, reuses compatible sessions, and rolls back unfinished turns when interrupted.

```ts
import { createConversation } from '@desource/browser-ai/conversation';

const chat = createConversation({
  chatKey: 'project-assistant',
  autoInit: false,
  systemPrompt: 'Keep answers concise.',
  contextStrategy: 'summarize',
  onStreamChunk: ({ chunk, accumulated }) => console.log(chunk, accumulated)
});

const unsubscribe = chat.state.subscribe(() => {
  const { chats, activeChatId, messages, processing, contextRestoreState } = chat.state.getSnapshot();
  console.log({ chats, activeChatId, messages, processing, contextRestoreState });
});

await chat.load(); // Load saved text without creating or downloading a model.

// Connect this function to the user's send action.
async function ask(text: string) {
  return chat.send(text);
}

// When the owner closes:
unsubscribe();
chat.dispose();
```

Use `createChat()`, `selectChat(id)`, `renameChat(id, title)`, `deleteChat(id)`, and `clear()` for chat controls. `interrupt()` stops the current operation; `dispose()` also releases owned sessions and subscriptions. `configure()` applies changed model or system options, restoring history on the next send. `init()` and `create()` remain available for explicit model preparation. Use a distinct `chatKey` for unrelated assistants.

Observers include `onInitStart`/`onInitComplete`, `onCreateStart`/`onCreateComplete`, `onContextStateChange`, `onContextOverflow`, and `onSummaryCacheError`. `onPromptStart` receives `{ input, streaming }`, `onStreamChunk` receives `{ chunk, accumulated }`, and `onPromptComplete` receives `{ response, streaming }` after the completed turn is saved. Interrupted turns do not emit completion.

### What survives a reload

The `@desource/browser-ai/chats` engine stores completed text histories and context summaries in IndexedDB. When IndexedDB is unavailable, browser instances share an in-memory fallback. `createAiChats(chatKey)` exposes that storage separately for custom history interfaces.

Conversation attachments keep their raw values in memory. Image and audio bytes remain usable across chat switches in the same controller, but are never written to IndexedDB. Text-file content is saved as labeled prompt text, so it remains part of restored context after a reload. Reloaded messages do not recover the original attachment files or preview metadata.

`conversationAttachments()` converts UI attachment records with backing `File` objects into native inputs. `conversationMessages()` converts initial UI messages. `createConversationView()` supplies display metadata and reuses one preview URL per visible Blob; it revokes URLs when messages leave the view and on `dispose()`. Returning to a chat creates fresh previews from the retained in-memory attachment values. Dispose both the conversation and its view when their owner closes.

## WebMCP

```ts
import { createWebMcp } from '@desource/browser-ai';

const tasks: Array<{ id: number; title: string }> = [];
const webMcp = createWebMcp();
const unregister = await webMcp.registerTool({
  name: 'create_task',
  description: 'Create a task in the project shown to the user.',
  inputSchema: {
    type: 'object',
    properties: { title: { type: 'string', minLength: 1 } },
    required: ['title'],
    additionalProperties: false
  },
  execute: ({ title }, { signal }) => {
    signal.throwIfAborted();
    const task = { id: tasks.length + 1, title };
    tasks.push(task);
    return task;
  }
});

try {
  const tools = await webMcp.refreshTools();
  const tool = tools.find(({ name }) => name === 'create_task');
  if (tool) {
    const resultText = await webMcp.executeTool(tool, { title: 'Review local AI demo' });
    console.log(resultText);
  }
} finally {
  unregister();
  webMcp.dispose();
}
```

Registration infers callback inputs from literal schemas. Callers pass input objects, and execution returns the native `string | null` result; `null` can indicate navigation of the target document.

Pass an object to `executeTool()`. Parse a non-null response only if the tool's output contract specifies JSON.

The wrapper chooses object or JSON input from the native method signature before execution. It never retries a tool call automatically, because a failed call may already have changed application state.

Wrapped native implementations can override detection explicitly:

```ts
// For an implementation that requires the earlier JSON argument:
await webMcp.executeTool(tool, { title: 'Review local AI demo' }, { inputFormat: 'json' });
```

Use `inputFormat: 'object'` for a wrapper around the current native signature. See [input-format compatibility](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md#chrome-input-format-transition).

The controller owns registration signals and listeners, observes `toolchange`, supports `exposedTo` and `fromOrigins`, and exposes support diagnostics. Tool annotations include `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, and `debugging`. The bundled JSON Schema validator covers a subset of keywords; use `validateInput` for additional validation and enforce application permissions inside the executor. Annotations do not enforce those rules.

`createWebMcpFormAttributes()` and `createWebMcpFieldAttributes()` support declarative forms. Read the [WebMCP guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md) for deployment and cross-origin requirements.

## State and ownership

Native controllers, workflows, chat storage, and conversations publish state through:

```ts
const current = client.state.getSnapshot();
const unsubscribe = client.state.subscribe(onChange);
```

Controllers publish new snapshots as state changes. Treat snapshots as read-only; native model instances remain unproxied. Unsubscribing removes a listener. Call `dispose()` separately when the controller's owner ends.

Framework packages bind state through Vue refs, React `useSyncExternalStore`, Svelte stores, or Angular signals. See the [framework package guides](https://github.com/DeSource-Labs/browser-ai#packages) for their bindings and lifecycle methods.

| Framework  | Custom controller binding                        | Cleanup                                                      |
| ---------- | ------------------------------------------------ | ------------------------------------------------------------ |
| Vue / Nuxt | `useBrowserAiWorkflow(controller)`               | Disposed with the active Vue effect scope                    |
| React      | `useBrowserAiWorkflow(factory)`                  | Disposed by the hook's effect cleanup                        |
| Svelte     | `createBrowserAiWorkflow(controller)`            | The owner calls `dispose()`, usually from `onDestroy`        |
| Angular    | `createAngularWorkflow(controller, destroyRef?)` | Pass `DestroyRef` for automatic cleanup, or call `dispose()` |

React and Svelte export workflow bindings from their `/workflows` entries; Angular uses `/controllers`. Constructor arguments initialize a controller. Use its configuration, creation, or operation methods to change options after creation.

The framework packages share core behavior and CSS source without pulling in one another's UI runtimes. Headless imports do not need component styles, and the native core entry does not load the optional workflow or conversation engines.

## Browser support

Support and experimental status differ by API. Feature detection and availability checks use the requested options; server imports do not create browser sessions. Model creation may require user activation, downloaded resources, an eligible device, and document permissions. WebMCP requires its current browser rollout or local testing flag.

See [Browser support](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/browser-support.md) for availability, downloads, and links to current Chrome requirements.

## Development

See [Contributing](https://github.com/DeSource-Labs/browser-ai/blob/main/CONTRIBUTING.md) for setup, checks, and local browser tests. Package releases are listed in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE) © DeSource Labs
