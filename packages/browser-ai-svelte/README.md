# @desource/browser-ai-svelte

Svelte 5 stores and components for Chrome built-in AI and WebMCP. Native store factories bind the shared core controllers to Svelte. Optional workflow factories add long-input handling, batches, and chat restoration. Application owners dispose headless controllers when their scope ends.

[Documentation](https://ai.desourcelabs.com/docs) · [Examples](https://ai.desourcelabs.com/#apis) · [API status](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md) · [GitHub](https://github.com/DeSource-Labs/browser-ai)

## Install

```bash
pnpm add @desource/browser-ai-svelte
```

Svelte 5.29 or newer is supported.

## Use the chat component

```svelte
<script lang="ts">
  import { PromptApi } from '@desource/browser-ai-svelte';
  import '@desource/browser-ai-svelte/assets/lib.css';

  const reportError = (error: unknown) => console.error(error);
</script>

<PromptApi
  chatKey="support"
  systemPrompt="Give concise, practical answers."
  allowAttachments
  streaming
  maxAttachments={6}
  onError={reportError}
/>
```

`PromptApi` provides saved chats, image/audio/text attachments, streaming output, and a Stop control. Its sidebar supports creating, selecting, renaming, and deleting chats with confirmation; Clear chat resets the active conversation. Download progress, context usage, and errors remain visible. The component set is:

- `PromptApi`, `Summarizer`, `Writer`, `Rewriter`;
- `Translator`, `LanguageDetector`, `Proofreader`;
- `MarkdownRenderer`, `PromptInput`, `ChatHistory`, `ChatSidebar`.

Component CSS is compiled from the same source as the Vue, React, and Angular packages, with no runtime styling dependency.

Chat orchestration uses the optional core `createConversation` controller. Ordinary turns reuse the model session; switching chats or changing model options restores the selected history. Context restoration and automatic compaction share the same summary cache and budgeting logic across frameworks. Configure `chatKey`, `systemPrompt`, `modelOptions`, `promptOptions`, and context settings through the component's conversation props, defined by the core `ConversationOptions` type. `promptOptions` accepts either an options object or a function of the current prompt context.

Saved history is text-only. Completed turns are written to IndexedDB after generation, not once per streaming chunk. Extracted text from attached files survives reloads. Image and audio bytes remain in memory for chat switching and session restoration while the controller lives; they are not restored after a page reload or component unmount. Storage errors are surfaced in the UI.

## Use the text components

`Summarizer`, `Writer`, `Rewriter`, `Translator`, `LanguageDetector`, and `Proofreader` use the shared advanced workflows. They include text-file input, settings, progress, Stop, and Copy controls. `createOptions` configures the native session; `runOptions` configures workflow behavior such as chunking. Result, progress, and error callbacks let the surrounding application react to a run.

Summarizer, Writer, and Rewriter render Markdown or plain text according to the selected output format. Proofreader displays normalized corrections with ranges adjusted to the complete input. LanguageDetector returns ranked, aggregated language results.

```svelte
<script lang="ts">
  import { Summarizer, Translator } from '@desource/browser-ai-svelte';

  let article = $state('Paste an article here.');
</script>

<Summarizer
  value={article}
  onValueChange={(value) => (article = value)}
  createOptions={{ type: 'key-points', format: 'markdown', length: 'short' }}
  runOptions={{ chunking: 'auto' }}
  onError={console.error}
/>
<Translator sourceLanguage="en" targetLanguage="es" autoTranslate debounceMs={650} />
```

Translator automatically translates after a debounce when the language pack is available. `autoTranslate` defaults to `true` and `debounceMs` to `650`. Users can toggle automatic translation, swap languages, or run manually. Download pack prepares a missing language pack on an explicit click; automatic translation does not start a download.

## Build a custom interface

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createPromptApi } from '@desource/browser-ai-svelte';

  const ai = createPromptApi({
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }]
  });
  const aiState = ai.state;
  let output = $state('');

  onDestroy(() => ai.dispose());

  async function ask() {
    try {
      output = await ai.prompt('Reply with one sentence.');
    } catch (error) {
      console.error(error);
    }
  }
</script>

<button onclick={ask} disabled={Boolean($aiState.processing)}>
  {$aiState.processing || 'Ask locally'}
</button>
<output>{output}</output>
```

Call session creation from the user's click or key action when Chrome reports `downloadable`. Register `dispose()` with `onDestroy` for every headless controller owned by a component. Unsubscribing from its readable store only detaches the subscriber; it does not release model sessions.

## Store factories

All eight browser surfaces have dedicated files:

- `createPromptApi`
- `createSummarizer`
- `createWriter`
- `createRewriter`
- `createTranslator`
- `createLanguageDetector`
- `createProofreader`
- `createWebMcp`

Each result contains native core methods, a Svelte-readable `state`, and the original `coreState` for framework-independent integration. Read current state through `$aiState` in a component or `ai.coreState.getSnapshot()` outside Svelte. Root factories keep native operations separate from advanced workflows and UI. Import only the factories you need; component imports opt into their shared workflows, and CSS remains a separate import.

Factory arguments initialize the controller. For changing model settings, pass the current options to each operation or update defaults through `configure()`:

```ts
const translated = await translator.translate(text, {}, { sourceLanguage: 'en', targetLanguage });
```

Compatible sessions are reused; changed session options create a replacement when needed. Mutating a local options variable does not reconfigure an existing native session.

## Optional advanced workflows

Import advanced store factories from `@desource/browser-ai-svelte/workflows`. These bind the same core algorithms used by the ready-made components in all four frameworks:

| Factory                                                       | Behavior                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| `createSveltePromptWorkflow`                                  | Measured history restoration and optional summary caching |
| `createSvelteSummarizerWorkflow`                              | Measured chunks and recursive summary rollup              |
| `createSvelteWriterWorkflow` / `createSvelteRewriterWorkflow` | Context fitting and ordered batches                       |
| `createSvelteTranslatorWorkflow`                              | Ordered chunks, language-pair handling, and batches       |
| `createSvelteLanguageDetectorWorkflow`                        | Chunked detection and weighted result aggregation         |
| `createSvelteProofreaderWorkflow`                             | Chunked proofreading with adjusted correction ranges      |

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createSvelteSummarizerWorkflow } from '@desource/browser-ai-svelte/workflows';

  const summarizer = createSvelteSummarizerWorkflow();
  const summaryState = summarizer.state;
  let article = $state('Paste a long article here.');

  onDestroy(() => summarizer.dispose());

  function summarize() {
    void summarizer
      .summarizeWithDetails(article, {
        createOptions: { type: 'key-points', length: 'short' },
        chunking: 'auto'
      })
      .catch(console.error);
  }
</script>

<textarea bind:value={article} aria-label="Article" />
<button onclick={summarize} disabled={$summaryState.isProcessing}>Summarize article</button>
<output>{$summaryState.output}</output>
{#if $summaryState.error instanceof Error}
  <p role="alert">{$summaryState.error.message}</p>
{/if}
```

Workflow factories retain the readable `state`, original `coreState`, and explicit disposal contract. Constructor arguments initialize the controller; pass changed model options through workflow creation, run, or restoration methods. `createSveltePromptWorkflow().restoreSession()` restores application-provided history. `createSvelteWriterWorkflow().writeMany()` runs an ordered batch. See the [core workflow examples](https://github.com/DeSource-Labs/browser-ai/blob/main/packages/core/README.md#optional-advanced-workflows) for method signatures and cache ownership.

The workflow entry also exports `createSvelteAiChats(chatKey)` for persistence without a model session, and `createBrowserAiWorkflow(controller)` for adapting a custom core controller. To build a custom chat UI with the same orchestration as `PromptApi`, install `@desource/browser-ai` as a direct dependency and adapt its optional conversation entry:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createConversation } from '@desource/browser-ai/conversation';
  import { createBrowserAiWorkflow } from '@desource/browser-ai-svelte/workflows';

  const chat = createBrowserAiWorkflow(createConversation({ chatKey: 'support', autoInit: false }));
  const chatState = chat.state;
  onDestroy(() => chat.dispose());
</script>
```

Call `load()` to read saved chats, `send(text, attachments)` to generate a turn, and `configure(options)` to update conversation settings. Subscribe through `chatState`; the owner must still call `dispose()` when its scope ends. See the [framework contract](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/framework-roadmap.md) for import and lifecycle boundaries.

## Attachments and structured output

```ts
const result = await ai.promptWithAttachments('Describe the image using the notes.', [
  { name: 'notes.md', value: notesFile },
  { name: 'photo.png', value: imageFile }
]);

const data = await ai.promptJson<{ category: string }>('Classify this result.', {
  type: 'object',
  properties: { category: { type: 'string' } },
  required: ['category'],
  additionalProperties: false
});
```

Attachments stay in the browser. Chrome receives native image/audio values; bounded text files are decoded locally. Changed modality declarations can recreate a native headless session. Supply initial prompts or use a restoration workflow when building directly on `createPromptApi`. The ready-made `PromptApi` component and optional conversation controller restore earlier context automatically, subject to the text-only persistence boundary above. Text-only tools can consume files through `readTextSource()`; native image/audio inputs belong to Prompt API.

## WebMCP

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createWebMcp } from '@desource/browser-ai-svelte';

  const webMcp = createWebMcp();
  const webMcpState = webMcp.state;

  onMount(() => {
    const owner = new AbortController();

    void webMcp
      .registerTool(
        {
          name: 'create_project_task',
          description: 'Create a task in the project visible to the user.',
          inputSchema: {
            type: 'object',
            properties: { title: { type: 'string', minLength: 1 } },
            required: ['title'],
            additionalProperties: false
          },
          execute: ({ title }) => tasks.create(title)
        },
        { signal: owner.signal }
      )
      .catch(console.error);

    return () => {
      owner.abort();
      webMcp.dispose();
    };
  });
</script>

<span>{$webMcpState.support.supported ? 'Agent tools active' : 'WebMCP unavailable'}</span>
```

The wrapper targets `webmcp-types` 0.1.9. `executeTool(tool, inputObject)` accepts an object and returns `Promise<string | null>`; `null` can mean the tool navigated. Schema literals infer callback inputs, and annotations include `consequentialHint` and `debugging`.

Modern Chromium receives object input. Older implementations that require JSON text are detected before the call using the native method signature. Use the execution option `inputFormat: 'object'` or `inputFormat: 'json'` when a wrapper changes that signature. Each tool is invoked once; compatibility handling never retries a potentially state-changing operation.

Validate tool input and re-check authorization inside every executor. Production pages require origin isolation and a `tools` Permissions Policy; see the [WebMCP guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md).

## Unsupported browsers

Availability and experimental status differ by API and depend on Chrome version, platform, device, language, storage, policy, and downloaded resources. The [dated API record](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md) separates type support from verified browser behavior. Components remain interactive when browser globals are absent. Keep a manual path and disclose any hosted fallback before data leaves the device.

## License

[MIT](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE) © DeSource Labs
