# Framework contract and release checklist

Updated **September 19, 2026**. Core, Vue, React, Svelte, Angular, and Nuxt are implemented. The component refactor now shares conversation and text-workflow behavior across all four rendering frameworks. Release checks passed on September 19; the [API status record](./api-status.md#verification-record) separates implemented features from live-browser evidence.

## Shared controllers, workflows, and conversations

The core package owns browser access, observable state, availability, model options, download progress, cancellation, attachments, text planning, and WebMCP. Advanced behavior has separate entry points so a native-controller import does not require chat persistence, history recovery, or UI code.

| Entry                                      | Responsibility                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `@desource/browser-ai`                     | Native controllers with `state.getSnapshot()` and `state.subscribe()`                                       |
| `@desource/browser-ai/workflows`           | Prompt restoration and summary caching; measured text chunks, ordered batches, merging, and progress        |
| `@desource/browser-ai/chats`               | Chat records, selection, message and summary persistence, storage errors, and lifecycle ownership           |
| `@desource/browser-ai/conversation`        | `createConversation()`, combining Prompt and chat workflows; optional preview and viewport helpers          |
| `@desource/browser-ai-vue`                 | AI composables backed by shared workflows and Vue refs; native WebMCP binding; Vue components               |
| `@desource/browser-ai-react`               | Native hooks using `useSyncExternalStore` and React components                                              |
| `@desource/browser-ai-react/workflows`     | Advanced workflow hooks and `useAiChats`                                                                    |
| `@desource/browser-ai-svelte`              | Native controllers exposed as readable stores and Svelte components                                         |
| `@desource/browser-ai-svelte/workflows`    | Advanced workflow stores and `createSvelteAiChats`                                                          |
| `@desource/browser-ai-angular/controllers` | Native controllers, advanced workflow factories, and chat persistence through signals; no component imports |
| `@desource/browser-ai-nuxt`                | Nuxt module and Vue auto-imports                                                                            |

The advanced entry provides Prompt, Summarizer, Writer, Rewriter, Translator, Language Detector, and Proofreader workflows. WebMCP uses the same native controller in every framework.

Custom controllers, including `createConversation()`, can use Vue's `useBrowserAiWorkflow(controller)`, React's `useBrowserAiWorkflow(factory)`, Svelte's `createBrowserAiWorkflow(controller)`, or Angular's `createAngularWorkflow(controller, destroyRef?)`. Vue binds disposal to an active effect scope; React uses effect cleanup. Svelte subscriptions remove their listeners on unsubscribe, while the owner explicitly disposes the controller. Angular owners provide a `DestroyRef` or call `dispose()`.

Constructor arguments initialize a controller. Use its configuration, creation, or run methods for subsequent options. Conversation components forward changed model options to the shared controller.

## Component contract

Vue, React, Svelte, and Angular expose `PromptApi`, `Summarizer`, `Writer`, `Rewriter`, `Translator`, `LanguageDetector`, `Proofreader`, `MarkdownRenderer`, `PromptInput`, `ChatHistory`, and `ChatSidebar`. Props, callbacks, events, and state bindings follow each framework's conventions.

| Components                           | Shared behavior                                                                                                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PromptApi`                          | Saved chats, selection, rename and confirmed deletion; ordinary-turn session reuse; context restoration and summary caching; model-option and modality changes; attachments; streaming; Clear chat and Stop |
| Summarizer, Writer, Rewriter         | Advanced text workflows, measured long-input handling, settings, streaming, progress/results/errors, Stop, and copyable output                                                                              |
| Translator                           | Shared language-pair workflow, language settings, ordered chunks, progress/results/errors, and cancellation                                                                                                 |
| Language Detector                    | Shared chunk aggregation, language rankings, configurable detection settings, progress/results/errors, and Stop                                                                                             |
| Proofreader                          | Shared correction normalization, correction display, settings, progress/results/errors, Stop, and copyable output                                                                                           |
| `ChatHistory` and `MarkdownRenderer` | Markdown output, timestamps, attachment previews, streaming state, pinned scrolling, and a jump-to-latest action                                                                                            |
| `PromptInput` and `ChatSidebar`      | File selection, accessible controls, empty and disabled states, and chat-management events                                                                                                                  |

All four Translator components support automatic translation, debounce, language swapping, and explicit language-pack preparation. Eleven shared contract cases verify the behavior in each framework. Automatic runs do not initiate model downloads.

All four Prompt components use `createConversation()`. Normal turns reuse one session. Switching chats, changing model requirements, or restoring compacted context uses the shared Prompt restoration engine and cached summaries. Stream chunks update the view; completed turns are persisted after generation. Chat metadata and summary-cache updates have their own writes. Failed storage operations remain visible to the application.

Durable chat history is text-only. Extracted file text in completed messages is retained, along with chat metadata and summaries. Image/audio values survive chat switches and session restoration while the conversation controller remains alive. Reloading the page restores text history without those binary values or their preview URLs. View helpers own and release preview URLs; persistence never stores them. IndexedDB transaction completion determines when a write is published, denied selection preferences do not block chat storage, and server-side memory is isolated per controller.

All component styles originate in `common/styles/_components.scss`. Package style entries compile the shared rules to CSS. Consumers import a published stylesheet for components; headless integrations do not need it. Framework files own rendering and lifecycle adaptation, while core owns model, history, and persistence behavior.

## Shared tests and bundle checks

`common/tests/unit` contains reusable component contracts. Each framework provides renderer, event, and update adapters. Tests cover model-option changes, session reuse, saved-chat actions, context restoration, settings, attachments, output callbacks, cancellation, errors, and common markup. Core algorithm and native lifecycle tests live in `packages/core/test`, including `test/workflows`. Local framework tests cover subscriptions, effects, scopes, rendering, and disposal.

`common/tests/e2e` supplies two browser paths:

- Ordinary Playwright Chromium verifies the interface with AI globals absent.
- The enabled-Chrome contract connects to an existing profile through `BROWSER_AI_CDP_ENDPOINT`, uses installed models, and tests available inference and visible WebMCP actions. Without an endpoint, this contract is skipped.

Manual checks in the user's enabled Chrome verified text, image, and audio inference and imperative and declarative WebMCP. Long-history recovery, long-input workloads, and cross-origin permissions have unit coverage but were not separately live-tested. The API record lists the browser-dependent limits.

Every package has a coverage threshold of at least 95% for statements, branches, functions, and lines. `pnpm check:framework-parity` checks exported components and bindings. `pnpm check:bundles` builds representative consumer imports and rejects retained UI or Markdown code in headless bundles. It measures minified gzip JavaScript with framework runtimes externalized; it does not measure every consumer bundle or native-model latency.

## Original milestone audit

| Requested milestone                    | Completed implementation and verification                                                                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review Prompt API and WebMCP           | Official-source review, current context APIs, `webmcp-types` 0.1.9, and native object/JSON format selection without execution retries.                                                                                        |
| Upgrade dependencies within pnpm rules | Updated age-eligible dependencies, retained the 1,440-minute release-age rule, and passed frozen installation, peer checks, and production audit.                                                                             |
| Attachments for relevant APIs          | Prompt image/audio values and text-file extraction for text APIs; native image/audio inference passed. PDF/office parsing remains outside the helper contract.                                                                |
| Framework-independent core             | Native controllers plus optional workflows, persistence, and conversation orchestration; packaged exports and consumer bundle checks passed.                                                                                  |
| React, Svelte, and Angular packages    | Framework state bindings, demos, shared chat behavior, advanced text workflows, settings, events, and Translator controls; all builds, types, and shared contracts passed.                                                    |
| Shared component styles                | One Sass source, unused legacy selectors removed, published CSS checked against a 6,000-byte gzip budget per framework.                                                                                                       |
| Shared tests and 95–100% coverage      | 1,065 unit tests passed; every package exceeded 95% for all four metrics. Sixteen browser/integration tests passed; four optional live-CDP tests skipped.                                                                     |
| Practical Nuxt WebMCP examples         | Workspace search, shortlist tools, conditional registration, and a visit-draft form with visible results. The native imperative chain and a separate native declarative form passed.                                          |
| Small bundles and performance          | Optional entries, preserved module boundaries, session reuse, cancellation, reader cleanup, and completed-turn persistence. Representative headless imports measured 3,298–6,069 bytes gzip with framework runtimes external. |
| Release documentation and packages     | Framework guides, API evidence, package metadata, changeset, and CI/release workflows updated; release checks passed. No package has been published.                                                                          |

## Release verification

CI and the release workflow run `pnpm ci`: formatting, lint, framework exports, peers, production audit, builds, bundle checks, typechecking, package validation, coverage, and browser tests. `pnpm check:release` also validates changesets. All constituent checks passed for this candidate. The API record lists exact coverage and browser evidence, including unavailable resources and skipped live-CDP tests.

Run the enabled-browser contract separately when an existing Chrome profile exposes CDP:

```bash
BROWSER_AI_CDP_ENDPOINT=http://127.0.0.1:9222 pnpm test:e2e:live
```

Record the candidate revision, browser version, active flags or origin trial, tested capabilities, and skipped paths. Keep changes to model/history behavior in core, add framework tests for binding behavior, and update the affected demos and release notes before rerunning the gates.
