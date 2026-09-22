# @desource/browser-ai

Framework-independent controllers for Chrome built-in AI and WebMCP. Use the native entry for session operations, streaming, attachments, and observable state. Optional entries add measured long-input handling, batches, saved chats, and context restoration.

This package also supplies the shared engines used by Browser AI Kit's Vue, React, Svelte, Angular, and Nuxt integrations.

[Documentation](https://ai.desourcelabs.com/docs) · [Examples](https://ai.desourcelabs.com/#apis) · [API status](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md) · [Framework contract](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/framework-roadmap.md)

## Install

```bash
pnpm add @desource/browser-ai
```

The package adds no framework runtime, inference server, account, or API key. Native model objects remain outside proxy-based reactivity.

| Entry                               | Use it for                                             |
| ----------------------------------- | ------------------------------------------------------ |
| `@desource/browser-ai`              | Native API controllers, attachments, and WebMCP        |
| `@desource/browser-ai/workflows`    | Long-input policies, batches, and history restoration  |
| `@desource/browser-ai/chats`        | IndexedDB text histories and summary storage           |
| `@desource/browser-ai/conversation` | A complete conversation controller and preview helpers |

The native entry does not import the optional engines. Vue, React, Svelte, and Angular text components use the shared advanced workflows; their chat components use the conversation engine. Headless applications can choose these behaviors independently.

## Native Prompt controller

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

// When the owning screen or application closes:
unsubscribe();
prompt.dispose();
```

`prompt()` creates a session when needed and reuses it for subsequent calls. Creation that needs model resources must run from a genuine user action. Read availability and show download progress in the application.

The controller also exposes `promptStreaming()`, `promptStreamingToText()`, `append()`, `clone()`, `measureContextUsage()`, `promptJson()`, attachment methods, and interruption. Its snapshot includes context usage and context overflow counts. Destroy cloned sessions when finished; they belong to the caller.

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

The wrapper targets `webmcp-types` 0.1.9. Registration infers callback inputs from literal schemas. Callers pass input objects, and execution returns the native `string | null` result; `null` can indicate navigation of the target document.

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

Pass an object to `executeTool()`. Parse a non-null response only if the tool's output contract specifies JSON.

The inspected **Chrome 153.0.8010.53 arm64** build still requires JSON text at its native execution boundary. The wrapper detects the earlier required-input signature from `executeTool.length` and serializes the validated object once. The current optional-object signature receives the object directly. Selection happens before the native call, with no automatic retry: a tool may already have changed application state when an error arrives.

Wrapped native implementations can override detection explicitly:

```ts
// For an implementation that requires the earlier JSON argument:
await webMcp.executeTool(tool, { title: 'Review local AI demo' }, { inputFormat: 'json' });
```

Use `inputFormat: 'object'` for a wrapper around the current native signature. The [browser verification record](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md#verification-record) links the IDL at the inspected Chrome revision.

The controller owns registration signals and listeners, observes `toolchange`, supports `exposedTo` and `fromOrigins`, and exposes support diagnostics. Tool annotations include `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, and `debugging`. The bundled JSON Schema validator covers a subset of keywords; use `validateInput` for additional validation and enforce application permissions inside the executor. Annotations do not enforce those rules.

`createWebMcpFormAttributes()` and `createWebMcpFieldAttributes()` support declarative forms. Read the [WebMCP guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md) for deployment and cross-origin requirements.

## State and ownership

Native controllers, workflows, chat storage, and conversations publish state through:

```ts
const current = client.state.getSnapshot();
const unsubscribe = client.state.subscribe(onChange);
```

Controllers publish new snapshots as state changes. Treat snapshots as read-only; native model instances remain unproxied. Unsubscribing removes a listener. Call `dispose()` separately when the controller's owner ends.

Framework packages bind state through Vue refs, React `useSyncExternalStore`, Svelte stores, or Angular signals. The [framework contract](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/framework-roadmap.md) documents their optional workflow imports, ownership, and component differences.

Representative single-adapter consumer bundles currently measure about 3.30–6.07 KB minified gzip across the framework packages, with framework runtimes external. This range covers selected headless imports, not component UI, styles, or every combination of optional engines. `pnpm check:bundles` measures the built candidate and rejects unrelated UI or Markdown code in those imports.

## Browser support and verification

Support and experimental status differ by API. Feature detection and availability checks use the requested options; server imports do not create browser sessions. Model creation may require user activation, downloaded resources, an eligible device, and document permissions. WebMCP requires its current browser rollout or local testing flag.

The [dated API status](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md) records reviewed types, official sources, and live verification. Release checks and manual native Chrome tests passed; the record identifies untested browser paths and downloadable Translator resources. Type-package versions and unit tests do not establish which models or modalities a particular browser exposes.

## License

[MIT](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE) © DeSource Labs
