# Browser API status

Last reviewed: 2026-07-17. Runtime verification used desktop Chrome `150.0.7871.129` with the built-in AI, Proofreader, and WebMCP testing flags enabled. TypeScript coverage targets `@types/dom-chromium-ai@0.0.17` and `webmcp-types@0.1.2`.

These browser APIs are experimental or gated even when the wrapper library is production-quality. Always feature-detect, show the reported availability state, initiate model downloads from a real user action, and keep a non-AI fallback for essential product flows.

## Current coverage

| API               | Chrome 150 runtime verified                                                                                                                                    | Package implementation                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt            | `availability`, `create`, `prompt`, `promptStreaming`, `append`, `measureContextUsage`, `clone`, `destroy`, `contextUsage`, `contextWindow`, `contextoverflow` | Complete composable plus persisted chat component, download/abort state, sampling option normalization, structured JSON helper, streaming, session restore, cached summary rollups, proactive compaction |
| Summarizer        | Availability/create, streaming, `measureInputUsage`, `inputQuota`, configuration properties                                                                    | Reusable session, native/batch/streaming runs, measured chunking and recursive rollups                                                                                                                   |
| Writer            | Availability/create, streaming, `measureInputUsage`, `inputQuota`, configuration properties                                                                    | Reusable session, native/batch/streaming runs, explicit optional-context fitting                                                                                                                         |
| Rewriter          | Availability/create, streaming, `measureInputUsage`, `inputQuota`, configuration properties                                                                    | Reusable session, native/batch/streaming runs, explicit context fitting                                                                                                                                  |
| Translator        | Constructor and current methods present; selected `en -> fr` pair reported `downloadable` in the test profile                                                  | Pair-aware availability/download UX, same-language bypass, native/batch/streaming runs and measured chunking                                                                                             |
| Language Detector | Availability/create/detect/measure methods present and available                                                                                               | Ranked normalization, thresholding, batches and weighted chunk merging                                                                                                                                   |
| Proofreader       | Available; `proofread()` and correction configuration properties; no runtime `inputQuota` or `measureInputUsage` yet                                           | Corrected text and range normalization, highlights, batches and character-boundary long-input fallback                                                                                                   |
| WebMCP            | `document.modelContext`, `registerTool`, `getTools`, `executeTool`, `toolchange`; declarative forms                                                            | Registration lifetime management, discovery, manual execution, support diagnostics, cross-origin options and declarative attribute helpers                                                               |

The demo's home page performs non-mutating feature detection. Downloads are never started automatically because Chrome requires meaningful user activation when an API reports `downloadable` or `downloading`.

## Prompt API changes from 0.0.16 to 0.0.17

- `samplingMode` is mutually exclusive with raw `topK` and `temperature`. `usePromptApi()` models that union and normalizes merged defaults so invalid combinations never reach Chrome.
- `append()` and `clone()` are first-class session operations.
- `responseConstraint` and `omitResponseConstraintInput` are prompt options. `promptJson<T>()` combines constrained output with typed JSON parsing.
- Context naming is now `contextUsage`, `contextWindow`, `measureContextUsage()`, and `contextoverflow`. Older input-quota aliases are deprecated or removed on the web surface.
- Session tool declarations are accepted through `LanguageModel.create({ tools })`.

The latest community specification also describes `tool-call`/`tool-response` message content and an instance `samplingMode` attribute. Those draft details lead the Chrome 150 runtime and `@types/dom-chromium-ai@0.0.17`; this package does not pretend unavailable runtime members exist.

References: [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api), [session management](https://developer.chrome.com/docs/ai/session-management), [session compacting](https://developer.chrome.com/docs/ai/session-compacting), [structured output](https://developer.chrome.com/docs/ai/structured-output-for-prompt-api), and the [Prompt API specification](https://webmachinelearning.github.io/prompt-api/).

## Proofreader compatibility

Chrome 150 exposes the Proofreader surface represented by `@types/dom-chromium-ai@0.0.17`: availability/create, correction configuration, `proofread()`, and `destroy()`. The newer Proofreader draft specifies `measureInputUsage()`, but that method is not present in this verified Chrome runtime or the current DefinitelyTyped package. The composable uses capability-safe character chunking rather than calling a draft-only quota method.

References: [Chrome Proofreader API](https://developer.chrome.com/docs/ai/proofreader-api) and the [Proofreader API specification](https://webmachinelearning.github.io/proofreader-api/).

## WebMCP status and deployment

WebMCP is available through an origin trial beginning with Chrome 149 or locally through `chrome://flags/#enable-webmcp-testing`. New code must use `document.modelContext`; `navigator.modelContext` is deprecated in Chrome 150.

WebMCP requires a secure, origin-isolated document and is controlled by the `tools` Permissions Policy. The demo explicitly returns:

```http
Origin-Agent-Cluster: ?1
Permissions-Policy: tools=(self)
```

Registration is lifetime-based: pass an `AbortSignal` to `registerTool()` and abort it to unregister. `useWebMcp()` owns these controllers and aborts them on manual unregister or Vue scope disposal. Cross-origin discovery additionally requires both `getTools({ fromOrigins })` on the caller and `registerTool(..., { exposedTo })` on the provider.

Treat tool descriptions and schemas as a security boundary, not only agent documentation. Re-check authentication and authorization during execution, avoid returning secrets, mark `readOnlyHint` accurately, set `untrustedContentHint` when output can contain external content, and keep destructive operations visibly confirmable in the product UI.

References: [WebMCP overview](https://developer.chrome.com/docs/ai/webmcp), [imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api), and [security guidance](https://developer.chrome.com/docs/ai/webmcp/security).

## Performance decisions

- Native browser model objects live in Vue `shallowRef`s and are never deep-proxied or traversed by deep watchers.
- Prompt streaming coalesces visible text updates to one `requestAnimationFrame` and persists the completed response once instead of cloning/persisting the whole conversation for every chunk.
- Chat scrolling watches only message count, the last message's content, typing state, and the auto-scroll option.
- Saved long chats restore from measured recent context immediately when a summary is not cached, then warm summary caches in the background.
- The demo background is static CSS, and the GitHub star reveal is CSS-only; neither Three.js/WebGL nor an animation runtime runs while the user types or local inference is active.

These choices keep UI work independent of model latency. Product performance still depends on prompt size, hardware, Chrome's model state, and whether the tab is foregrounded.
