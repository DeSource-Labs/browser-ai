# @desource/browser-ai-react

React hooks and components for Chrome built-in AI and WebMCP. Native hooks use `useSyncExternalStore` around shared core controllers and keep browser-owned model objects unproxied. Optional workflow hooks add long-input handling, batches, and chat restoration.

[Documentation](https://ai.desourcelabs.com/docs) · [Examples](https://ai.desourcelabs.com/#apis) · [API status](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md) · [GitHub](https://github.com/DeSource-Labs/browser-ai)

## Install

```bash
pnpm add @desource/browser-ai-react
```

React 18.3 or 19 is supported.

## Use the chat component

```tsx
import { PromptApi } from '@desource/browser-ai-react';
import '@desource/browser-ai-react/assets/lib.css';

export function Assistant() {
  return (
    <PromptApi
      chatKey="support"
      systemPrompt="Give concise, practical answers."
      allowAttachments
      streaming
      maxAttachments={6}
      onError={console.error}
    />
  );
}
```

`PromptApi` provides saved chats, image/audio/text attachments, streaming output, and a Stop control. Its sidebar supports creating, selecting, renaming, and deleting chats with confirmation; Clear chat resets the active conversation. Download progress, context usage, and errors remain visible. Styling comes from the shared framework styles and supports CSS custom properties.

The component set is:

- `PromptApi`, `Summarizer`, `Writer`, `Rewriter`;
- `Translator`, `LanguageDetector`, `Proofreader`;
- `MarkdownRenderer`, `PromptInput`, `ChatHistory`, `ChatSidebar`.

Chat orchestration uses the optional core `createConversation` controller. Ordinary turns reuse the model session; switching chats or changing model options restores the selected history. Context restoration and automatic compaction share the same summary cache and budgeting logic across frameworks. Configure `chatKey`, `systemPrompt`, `modelOptions`, `promptOptions`, and context settings through the component's conversation props, defined by the core `ConversationOptions` type. `promptOptions` accepts either an options object or a function of the current prompt context.

Saved history is text-only. Completed turns are written to IndexedDB after generation, not once per streaming chunk. Extracted text from attached files survives reloads. Image and audio bytes remain in memory for chat switching and session restoration while the controller lives; they are not restored after a page reload or component unmount. Storage errors are surfaced in the UI.

## Use the text components

`Summarizer`, `Writer`, `Rewriter`, `Translator`, `LanguageDetector`, and `Proofreader` use the shared advanced workflows. They include text-file input, settings, progress, Stop, and Copy controls. `createOptions` configures the native session; `runOptions` configures workflow behavior such as chunking. Result, progress, and error callbacks let the surrounding application react to a run.

Summarizer, Writer, and Rewriter render Markdown or plain text according to the selected output format. Proofreader displays normalized corrections with ranges adjusted to the complete input. LanguageDetector returns ranked, aggregated language results.

```tsx
import { Summarizer, Translator } from '@desource/browser-ai-react';

export function TextTools({ article }: { article: string }) {
  return (
    <>
      <Summarizer
        value={article}
        createOptions={{ type: 'key-points', format: 'markdown', length: 'short' }}
        runOptions={{ chunking: 'auto' }}
        onError={console.error}
      />
      <Translator sourceLanguage="en" targetLanguage="es" autoTranslate debounceMs={650} />
    </>
  );
}
```

Translator automatically translates after a debounce when the language pack is available. `autoTranslate` defaults to `true` and `debounceMs` to `650`. Users can toggle automatic translation, swap languages, or run manually. Download pack prepares a missing language pack on an explicit click; automatic translation does not start a download.

## Build a custom interface

```tsx
import { usePromptApi } from '@desource/browser-ai-react';

export function PromptButton() {
  const ai = usePromptApi({
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }]
  });

  async function ask() {
    const answer = await ai.prompt('Reply with one sentence.');
    console.log(answer);
  }

  return (
    <button onClick={ask} disabled={ai.isProcessing}>
      {ai.processing || 'Ask locally'}
    </button>
  );
}
```

The hook disposes its core controller on unmount. Call session creation from the user's click or key action when Chrome reports `downloadable`.

## Hooks

All eight browser surfaces have dedicated hook files:

- `usePromptApi`
- `useSummarizer`
- `useWriter`
- `useRewriter`
- `useTranslator`
- `useLanguageDetector`
- `useProofreader`
- `useWebMcp`

Each root hook returns native core methods, the current snapshot, `isReady`, and `isProcessing`. The AI hooks expose session creation, reuse, interruption, and disposal; WebMCP exposes tool registration and execution. Root hooks keep native operations separate from advanced workflows and UI. Import only the hooks you need; component imports opt into their shared workflows, and CSS remains a separate import.

Native hook options update controller defaults after React commits. Pass current creation options to the operation when a request must use the values selected for that run:

```tsx
const translator = useTranslator({ sourceLanguage: 'en', targetLanguage });
const translated = await translator.translate(text, {}, { sourceLanguage: 'en', targetLanguage });
```

Compatible sessions are reused; changing a language pair or other session options creates a replacement when needed.

## Optional advanced workflows

Import the workflow hooks from `@desource/browser-ai-react/workflows`. They bind the same core algorithms used by the ready-made components in all four frameworks:

| Hook                                        | Behavior                                                  |
| ------------------------------------------- | --------------------------------------------------------- |
| `usePromptWorkflow`                         | Measured history restoration and optional summary caching |
| `useSummarizerWorkflow`                     | Measured chunks and recursive summary rollup              |
| `useWriterWorkflow` / `useRewriterWorkflow` | Context fitting and ordered batches                       |
| `useTranslatorWorkflow`                     | Ordered chunks, language-pair handling, and batches       |
| `useLanguageDetectorWorkflow`               | Chunked detection and weighted result aggregation         |
| `useProofreaderWorkflow`                    | Chunked proofreading with adjusted correction ranges      |

```tsx
import { useSummarizerWorkflow } from '@desource/browser-ai-react/workflows';

export function ArticleSummary({ article }: { article: string }) {
  const summarizer = useSummarizerWorkflow();

  function summarize() {
    void summarizer
      .summarizeWithDetails(article, {
        createOptions: { type: 'key-points', length: 'short' },
        chunking: 'auto'
      })
      .catch(console.error);
  }

  return (
    <section>
      <button onClick={summarize} disabled={summarizer.isProcessing}>
        Summarize article
      </button>
      <output>{summarizer.output}</output>
      {summarizer.error instanceof Error && <p role="alert">{summarizer.error.message}</p>}
    </section>
  );
}
```

Workflow hooks dispose their controllers on unmount, including pending operations and owned sessions. Their constructor arguments initialize the controller; pass changing model options through workflow creation, run, or restoration methods. `usePromptWorkflow().restoreSession()` restores application-provided history, while `useWriterWorkflow().writeMany()` processes an ordered batch. The [core workflow examples](https://github.com/DeSource-Labs/browser-ai/blob/main/packages/core/README.md#optional-advanced-workflows) document those method signatures.

The workflow entry also exports `useAiChats(chatKey)` for persistence without a model session, and `useBrowserAiWorkflow(factory)` for a custom disposable core controller. To build a custom chat UI with the same orchestration as `PromptApi`, install `@desource/browser-ai` as a direct dependency and adapt its optional conversation entry:

```tsx
import { createConversation } from '@desource/browser-ai/conversation';
import { useBrowserAiWorkflow } from '@desource/browser-ai-react/workflows';

export function useSupportConversation() {
  return useBrowserAiWorkflow(() => createConversation({ chatKey: 'support', autoInit: false }));
}
```

Call `load()` to read saved chats, `send(text, attachments)` to generate a turn, and `configure(options)` to update conversation settings. The hook publishes controller state and disposes it on unmount. See the [framework contract](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/framework-roadmap.md) for import and lifecycle boundaries.

## Attachments and structured output

```tsx
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

Attachments stay in the browser. Image and audio values are passed to Chrome; bounded text files are decoded locally. A changed modality declaration can recreate a native headless session. Supply initial prompts or use a restoration workflow when building directly on `usePromptApi`. The ready-made `PromptApi` component and optional conversation controller restore earlier context automatically, subject to the text-only persistence boundary above. Text-only tools accept decoded file content through the shared `readTextSource()` helper; they do not accept native image/audio inputs.

## WebMCP

```tsx
import { useEffect } from 'react';
import { useWebMcp } from '@desource/browser-ai-react';

export function ProjectTools() {
  const webMcp = useWebMcp();
  const registerTool = webMcp.registerTool;

  useEffect(() => {
    const owner = new AbortController();

    void registerTool(
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
    ).catch(console.error);

    return () => owner.abort();
  }, [registerTool]);

  return <span>{webMcp.support.supported ? 'Agent tools active' : 'WebMCP unavailable'}</span>;
}
```

The hook also disposes all remaining registrations on unmount. The wrapper targets `webmcp-types` 0.1.9. `executeTool(tool, inputObject)` accepts an object and returns `Promise<string | null>`; `null` can mean the tool navigated. Schema literals infer callback inputs, and annotations include `consequentialHint` and `debugging`.

Modern Chromium receives object input. Older implementations that require JSON text are detected before the call using the native method signature. Use the execution option `inputFormat: 'object'` or `inputFormat: 'json'` when a wrapper changes that signature. Each tool is invoked once; compatibility handling never retries a potentially state-changing operation.

Validate input and re-check authorization inside every executor. Production pages require origin isolation and a `tools` Permissions Policy; see the [WebMCP guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md).

## Unsupported browsers

Availability and experimental status differ by API and depend on Chrome version, platform, device, language, storage, policy, and downloaded resources. The [dated API record](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md) separates type support from verified browser behavior. Components render a recoverable error instead of assuming browser globals exist. Keep the manual workflow available and disclose any cloud fallback before data leaves the device.

## License

[MIT](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE) © DeSource Labs
