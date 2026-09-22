# @desource/browser-ai-angular

Angular signals, injectable services, and standalone components for Chrome built-in AI and WebMCP. Shared core controllers provide native operations; optional workflow and chat engines provide long-input handling, history restoration, and local persistence. Angular binds their state to signals and `DestroyRef` cleanup.

[Documentation](https://ai.desourcelabs.com/docs) · [Examples](https://ai.desourcelabs.com/#apis) · [API status](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md) · [GitHub](https://github.com/DeSource-Labs/browser-ai)

## Install

```bash
pnpm add @desource/browser-ai-angular
```

Angular 22.1.7 or newer within major version 22 is supported.

## Use the chat component

```ts
import { Component } from '@angular/core';
import { BrowserAiPromptApiComponent } from '@desource/browser-ai-angular';
import '@desource/browser-ai-angular/assets/lib.css';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [BrowserAiPromptApiComponent],
  template: `
    <browser-ai-prompt-api
      [allowAttachments]="true"
      [streaming]="true"
      [maxAttachments]="6"
      (requestError)="reportError($event)"
    />
  `
})
export class AssistantComponent {
  reportError(error: unknown) {
    console.error(error);
  }
}
```

The component handles message history, image/audio/text attachments, streaming output, interruption state, and useful unsupported-browser errors.

The component set is:

- `BrowserAiPromptApiComponent`, `BrowserAiSummarizerComponent`, `BrowserAiWriterComponent`, `BrowserAiRewriterComponent`;
- `BrowserAiTranslatorComponent`, `BrowserAiLanguageDetectorComponent`, `BrowserAiProofreaderComponent`;
- `BrowserAiMarkdownRendererComponent`, `BrowserAiPromptInputComponent`, `BrowserAiChatHistoryComponent`, `BrowserAiChatSidebarComponent`.

Every component is standalone and uses OnPush change detection. CSS is compiled from the same source as the Vue, React, and Svelte packages. The chat component uses the shared conversation engine for saved-chat creation, selection, renaming, deletion confirmation, clearing, interruption, and context restoration. Compatible model sessions are reused across turns. Text history and summary caches persist locally; binary attachments remain available across chat switches until the component is disposed. Reloads restore text only. Set `chatKey`, `systemPrompt`, `promptOptions`, and the context options to configure the conversation.

## Build a custom interface

```ts
import { Component, DestroyRef, inject } from '@angular/core';
import { createAngularPromptApi } from '@desource/browser-ai-angular/controllers';

@Component({
  selector: 'app-prompt-button',
  standalone: true,
  template: `
    <button (click)="ask()" [disabled]="ai.isProcessing()">
      {{ ai.current().processing || 'Ask locally' }}
    </button>
    <output>{{ ai.current().output }}</output>
  `
})
export class PromptButtonComponent {
  readonly ai = createAngularPromptApi(
    {
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    },
    inject(DestroyRef)
  );

  async ask() {
    try {
      await this.ai.prompt('Reply with one sentence.');
    } catch (error) {
      console.error(error);
    }
  }
}
```

`@desource/browser-ai-angular/controllers` is the headless entry: it excludes component rendering dependencies and does not require the stylesheet. `current`, `isReady`, and `isProcessing` are readonly signals. Passing `DestroyRef` disposes the controller with the owning injection context; otherwise call `dispose()` explicitly. Call model creation from a real click or key action when Chrome reports `downloadable`.

## Factories and service

All eight browser surfaces have dedicated factory files:

- `createAngularPromptApi`
- `createAngularSummarizer`
- `createAngularWriter`
- `createAngularRewriter`
- `createAngularTranslator`
- `createAngularLanguageDetector`
- `createAngularProofreader`
- `createAngularWebMcp`

`BrowserAiService` exposes the native factories from Angular dependency injection. Import it from `/controllers` for a headless application. Controllers created by the service are caller-owned; dispose them explicitly or pass a component `DestroyRef` through the standalone factories.

Native factories initialize their default options. Pass current creation options to the run call when settings change:

```ts
const result = await this.translator.translate(text, {}, { sourceLanguage: 'en', targetLanguage });
```

Compatible sessions are reused. Changed session options create a replacement when needed.

## Text tool components

Summarizer, Writer, Rewriter, Translator, Language Detector, and Proofreader use the same advanced engines as Vue. Their Settings controls expose model and run options, and `runOptions` supplies context fitting, chunking, and progress callbacks. Components show download and token state, support Stop, copy output, and accept bounded text files. Summarizer, Writer, and Rewriter respect the selected Markdown or plain-text output format. Proofreader lists normalized corrections and explanations.

Translator exposes `autoTranslate` (default `true`) and `debounceMs` (default `650`), language selectors, Swap languages, and an explicit Download pack action. Automatic translation runs only for available language pairs. Pack downloads require an explicit user action.

## Advanced workflows

The `/controllers` entry also exports named bindings to `@desource/browser-ai/workflows`:

| Factory                                                         | Behavior                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| `createAngularPromptWorkflow`                                   | Measured history restoration and optional summary caching |
| `createAngularSummarizerWorkflow`                               | Measured chunks and recursive summary rollup              |
| `createAngularWriterWorkflow` / `createAngularRewriterWorkflow` | Context fitting and ordered batches                       |
| `createAngularTranslatorWorkflow`                               | Ordered chunks, language-pair handling, and batches       |
| `createAngularLanguageDetectorWorkflow`                         | Chunked detection and weighted result aggregation         |
| `createAngularProofreaderWorkflow`                              | Chunked proofreading with adjusted correction ranges      |

```ts
import { Component, DestroyRef, inject } from '@angular/core';
import { createAngularSummarizerWorkflow } from '@desource/browser-ai-angular/controllers';

@Component({
  selector: 'app-article-summary',
  standalone: true,
  template: `
    <textarea #article aria-label="Article"></textarea>
    <button (click)="summarize(article.value)" [disabled]="summary.isProcessing()">Summarize</button>
    <output>{{ summary.current().output }}</output>
  `
})
export class ArticleSummaryComponent {
  readonly summary = createAngularSummarizerWorkflow(inject(DestroyRef));

  summarize(article: string) {
    void this.summary
      .summarizeWithDetails(article, {
        createOptions: { type: 'key-points', length: 'short' },
        chunking: 'auto'
      })
      .catch(console.error);
  }
}
```

Prompt, Translator, Language Detector, and Proofreader workflow factories take their initialization options followed by an optional `DestroyRef`. Summarizer, Writer, and Rewriter take an optional `DestroyRef` as their only argument. Use `createAngularWorkflow(controller, destroyRef?)` for a custom core controller.

Workflow method signatures include their own planning options and detailed results. Pass changing model options through creation, run, or restoration methods. The [core workflow examples](https://github.com/DeSource-Labs/browser-ai/blob/main/packages/core/README.md#optional-advanced-workflows) cover batches, context fitting, and `restoreSession()`.

## Local chat persistence

`createAngularAiChats(tool, destroyRef?)` binds the optional `@desource/browser-ai/chats` engine to Angular signals. It is available from `/controllers`:

```ts
import { Component, DestroyRef, inject } from '@angular/core';
import { createAngularAiChats } from '@desource/browser-ai-angular/controllers';

@Component({
  selector: 'app-saved-chats',
  standalone: true,
  template: `
    <button (click)="createChat()" [disabled]="chats.isProcessing()">New chat</button>
    <p>{{ chats.current().activeChat?.title }}</p>
  `
})
export class SavedChatsComponent {
  readonly chats = createAngularAiChats('project-assistant', inject(DestroyRef));

  constructor() {
    void this.chats.loadChats().catch(console.error);
  }

  createChat() {
    void this.chats.createChat('Trip planning').catch(console.error);
  }
}
```

The controller manages loading, creation, selection, renaming, messages, summary records, deletion, and restoration. Chat records use IndexedDB and the selected chat ID uses localStorage. If IndexedDB is unavailable, browser instances share an in-memory fallback that does not survive a page reload. Database failures are reported through rejected operations and the error state. Server instances use separate memory stores.

Disposal detaches the Angular subscription and invalidates queued controller work; it does not delete saved chats. Use `deleteChat()` for deletion. Storage stays in the application's origin, and no chat content is uploaded by this engine. Keep persistence and any hosted fallback visible in the product's data-handling behavior.

## Attachments and structured output

```ts
const result = await this.ai.promptWithAttachments('Describe the image using the notes.', [
  { name: 'notes.md', value: notesFile },
  { name: 'photo.png', value: imageFile }
]);

const data = await this.ai.promptJson<{ category: string }>('Classify this result.', {
  type: 'object',
  properties: { category: { type: 'string' } },
  required: ['category'],
  additionalProperties: false
});
```

Attachments stay in the browser. Chrome receives native image/audio values; bounded text files are decoded locally. Changed modality declarations can recreate the native session. Supply initial prompts or restore saved history when earlier context must be retained. Text-only tools use decoded text, available through `readTextSource()`; native image/audio inputs belong to Prompt API.

## WebMCP

```ts
import { Component, DestroyRef, inject } from '@angular/core';
import { createAngularWebMcp } from '@desource/browser-ai-angular/controllers';

@Component({
  selector: 'app-project-tools',
  standalone: true,
  template: ` <span>{{ webMcp.current().support.supported ? 'Agent tools active' : 'WebMCP unavailable' }}</span> `
})
export class ProjectToolsComponent {
  readonly webMcp = createAngularWebMcp(inject(DestroyRef));

  constructor() {
    void this.webMcp
      .registerTool({
        name: 'create_project_task',
        description: 'Create a task in the project visible to the user.',
        inputSchema: {
          type: 'object',
          properties: { title: { type: 'string', minLength: 1 } },
          required: ['title'],
          additionalProperties: false
        },
        execute: ({ title }) => tasks.create(title)
      })
      .catch(console.error);
  }
}
```

`DestroyRef` removes registrations with the component. The wrapper follows `webmcp-types` 0.1.9: `executeTool(tool, inputObject)` takes an object and returns a string, or `null` when execution navigates the document. Input format is selected before execution: modern Chrome receives the object, while older Chrome's required JSON-string signature receives serialized input. An `inputFormat` override is available for wrappers; tools are never retried automatically. Schema literals infer callback input, and annotations include `consequentialHint` and `debugging`. Validate tool input and re-check authorization inside every executor. Production pages require origin isolation and a `tools` Permissions Policy; see the [WebMCP guide](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/webmcp.md).

## Unsupported browsers

Availability and experimental status differ by API and depend on Chrome version, platform, device, language, storage, policy, and downloaded resources. The [API status record](https://github.com/DeSource-Labs/browser-ai/blob/main/docs/api-status.md) tracks actual browser verification separately from the type definitions. Components remain usable when browser globals are absent. Preserve the manual workflow and disclose any hosted fallback before data leaves the device.

## License

[MIT](https://github.com/DeSource-Labs/browser-ai/blob/main/LICENSE) © DeSource Labs
