# @desource/browser-ai-react

[![React](https://img.shields.io/npm/v/@desource/browser-ai-react?color=blue&logo=react)](https://www.npmjs.com/package/@desource/browser-ai-react)
[![Coverage](https://codecov.io/gh/DeSource-Labs/browser-ai/branch/main/graph/badge.svg)](https://codecov.io/gh/DeSource-Labs/browser-ai)
[![SonarCloud](https://sonarcloud.io/api/project_badges/measure?project=DeSource-Labs_browser-ai&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DeSource-Labs_browser-ai)
[![Ask Context7](https://img.shields.io/badge/Ask%20Context7-059669.svg?logo=data:image/svg%2bxml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI0IDBINEMxLjc5MDg2IDAgMCAxLjc5MDg2IDAgNFYyNEMwIDI2LjIwOTEgMS43OTA4NiAyOCA0IDI4SDI0QzI2LjIwOTEgMjggMjggMjYuMjA5MSAyOCAyNFY0QzI4IDEuNzkwODYgMjYuMjA5MSAwIDI0IDBaIiBmaWxsPSIjRjdGMkU4IiBmaWxsLW9wYWNpdHk9IjAuNjUiLz4KPHBhdGggZD0iTTEwLjYgMTUuMjk5MkMxMC42IDE3LjQ5OTIgOS43MDAwNSAxOS4zOTkyIDguMjAwMDUgMjEuMDk5MkgxMS42VjIyLjc5OTJINi4zMDAwNVYyMS4xOTkyQzguMDAwMDUgMTkuMzk5MiA4LjYwMDA1IDE3Ljg5OTIgOC42MDAwNSAxNS4yOTkySDEwLjZaTTE3LjQgMTUuMjk5MkMxNy40IDE3LjQ5OTIgMTguMyAxOS4zOTkyIDE5LjggMjEuMDk5MkgxNi40VjIyLjc5OTJIMjEuN1YyMS4xOTkyQzIwIDE5LjM5OTIgMTkuNCAxNy44OTkyIDE5LjQgMTUuMjk5MkgxNy40Wk0xMC42IDEyLjY5OTJDMTAuNiAxMC40OTkyIDkuNzAwMDUgOC41OTkyMiA4LjIwMDA1IDYuODk5MjJIMTEuNlY1LjE5OTIySDYuMzAwMDVWNi43OTkyMkM4LjAwMDA1IDguNTk5MjIgOC42MDAwNSAxMC4wOTkyIDguNjAwMDUgMTIuNjk5MkgxMC42Wk0xNy40IDEyLjY5OTJDMTcuNCAxMC40OTkyIDE4LjMgOC41OTkyMiAxOS44IDYuODk5MjJIMTYuNFY1LjE5OTIySDIxLjdWNi43OTkyMkMyMCA4LjU5OTIyIDE5LjQgMTAuMDk5MiAxOS40IDEyLjY5OTJIMTcuNFoiIGZpbGw9ImJsYWNrIi8+Cjwvc3ZnPgo=)](https://context7.com/desource-labs/browser-ai)
[![Ask DeepWiki](https://img.shields.io/badge/Ask%20DeepWiki-1c398e.svg?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0iI2NiY2JjYiIgYXJpYS1oaWRkZW49InRydWUiPjxwYXRoIGQ9Ik0xOC42IDIwLjFxMS0uNiAyLjItLjZoLjNhNCA0IDAgMCAxIDIgLjdoLjJ2LjFsMSAxaC4xdi4yaC4xbC4xLjF2LjFxLjcgMSAuNyAyLjN0LS42IDIuMnYuMWwtLjIuMkE0IDQgMCAwIDEgMjMgMjhoLS4ydi4xbC0xLjQuNGgtLjVxLTEuMyAwLTIuMy0uNWwtNC4xLTIuNC04LjMgNC44djkuNWw4LjMgNC44IDguMi00LjhWMzVxMC0xLjIuNi0yLjJ2LS4xbC4yLS4yYTQgNCAwIDAgMSAxLjctMS41bDEuMy0uNGguNnExLjMgMCAyLjMuNmw0LjIgMi4zIDguMi00Ljd2LTkuNmwtOC4yLTQuNy00LjIgMi4zcS0xIC42LTIuMi42aC0uM2E0IDQgMCAwIDEtMi0uNmwtLjItLjEtMS0xaC0uMXYtLjJoLS4xbC0uMS0uMnYtLjFxLS43LTEtLjctMi4yVjguMmwtOC4yLTQuNy04LjMgNC43djkuNWw4LjIgNC44eiIvPjwvc3ZnPg==)](https://deepwiki.com/DeSource-Labs/browser-ai)
[![MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE)

[Documentation](https://ai.desourcelabs.com/docs) · [Examples](https://ai.desourcelabs.com/#apis) · [GitHub](https://github.com/DeSource-Labs/browser-ai)

React hooks and components for private, on-device AI. Build chats, summaries, writing tools, and translation with Chrome's local models. Prompts are processed on the user's device; no inference server or API key is needed.

Use the ready-made components or connect hooks to your own interface. Hooks expose availability, download progress, streaming, and cancellation, and release their controllers on unmount. Optional workflows handle long inputs and saved conversations; WebMCP hooks expose your app's tools to browser agents.

## Install

```bash
npm install @desource/browser-ai-react
```

React 18.3 or 19 is supported.

Run your app in Chrome on HTTPS or localhost. Some APIs need a model or language-pack download before first use; components guide the user through it. See [Browser setup](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/browser-support.md#try-it-in-your-browser).

## Quick start

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

Native hooks use `useSyncExternalStore` around shared core controllers and keep browser-owned model objects unproxied.

The package exports eight hooks:

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

Call `load()` to read saved chats, `send(text, attachments)` to generate a turn, and `configure(options)` to update conversation settings. The hook publishes controller state and disposes it on unmount. See the [core guide](https://github.com/DeSource-Labs/browser-ai/blob/main/packages/core/README.md#state-and-ownership) for import and lifecycle boundaries.

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

The hook also disposes all remaining registrations on unmount. `executeTool(tool, inputObject)` accepts an object and returns `Promise<string | null>`; `null` can mean the tool navigated. Schema literals infer callback inputs, and annotations include `consequentialHint` and `debugging`.

Modern Chromium receives object input. Older implementations that require JSON text are detected before the call using the native method signature. Use the execution option `inputFormat: 'object'` or `inputFormat: 'json'` when a wrapper changes that signature. Each tool is invoked once; compatibility handling never retries a potentially state-changing operation.

Validate input and re-check authorization inside every executor. Production pages require origin isolation and a `tools` Permissions Policy; see the [WebMCP guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md).

## Browser support

Availability and experimental status differ by API and depend on Chrome version, platform, device, language, storage, policy, and downloaded resources. Components render a recoverable error instead of assuming browser globals exist. Keep the manual workflow available and disclose any cloud fallback before data leaves the device.

See [Browser support](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/browser-support.md) for availability and downloads.

## Development

See [Contributing](https://github.com/DeSource-Labs/browser-ai/blob/main/CONTRIBUTING.md) for setup, checks, and local browser tests. Package releases are listed in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE) © DeSource Labs
