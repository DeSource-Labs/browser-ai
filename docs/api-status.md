# Browser API status

Last source and documentation review: **September 19, 2026**. The repository targets `@types/dom-chromium-ai@0.0.17` and `webmcp-types@0.1.9`. The release checks passed. Native AI inference and imperative and declarative WebMCP execution were verified in the user’s enabled Chrome; the verification record below distinguishes those results from unit coverage and browser-dependent skips.

Package types describe callable interfaces. Runtime support still depends on the browser, device, model resources, requested options, and document permissions. Check the exact API and options used by the application.

## Package coverage

The core package provides native controllers for Prompt API, Summarizer, Writer, Rewriter, Translator, Language Detector, Proofreader, and WebMCP. React, Svelte, and Angular adapt those controllers to their framework state primitives.

The optional `@desource/browser-ai/workflows` entry contains the advanced engines formerly implemented inside Vue: history restoration, measured context fitting, chunking, batches, and result merging. Existing Vue composables use these engines through a thin ref adapter. React and Svelte expose workflow bindings from their `/workflows` entries; Angular exposes them with its headless APIs from `/controllers`.

All four framework `PromptApi` components now use `createConversation()` from the optional `@desource/browser-ai/conversation` entry. It combines the Prompt workflow with `@desource/browser-ai/chats` for saved-chat management, context recovery, and summary-cache persistence. Normal turns reuse a session; chat switches and changed model requirements restore the relevant history. Transcript writes occur after a completed response, rather than for every stream chunk.

Summarizer, Writer, Rewriter, Translator, Language Detector, and Proofreader components use the shared advanced workflows. Settings, progress/results/errors, Stop controls, correction output, copy actions, and chat viewport behavior have framework bindings. All four Translator components support automatic translation, debounce, language swapping, and explicit language-pack preparation, verified by the shared component contract. See the [framework contract and release checklist](./framework-roadmap.md).

## Prompt API

Chrome documents the web Prompt API from Chrome 148. It accepts declared text, image, and audio inputs and produces text. Its documented language declarations are English, Japanese, Spanish, German, and French. Web sampling presets use the `samplingMode` origin trial; `topK`, `temperature`, and `LanguageModel.params()` remain extension features. Eligibility and download requirements are listed in the [Chrome Prompt API documentation](https://developer.chrome.com/docs/ai/prompt-api).

The native controller and advanced Prompt workflow expose:

- availability checks, creation, destruction, and download progress;
- `prompt()`, `promptStreaming()`, `append()`, and `clone()`;
- `measureContextUsage()`, `contextUsage`, `contextWindow`, and context overflow handling;
- initial conversation messages and native tool definitions;
- constrained output through `responseConstraint`, with `promptJson()` for JSON parsing.

The current specification uses context names for web integrations. Older `inputUsage`, `inputQuota`, `measureInputUsage()`, and `quotaoverflow` aliases are deprecated extension compatibility surfaces. See the [Prompt API specification](https://webmachinelearning.github.io/prompt-api/).

`responseConstraint` can affect measured context usage. `omitResponseConstraintInput` changes whether the schema contributes instructions to the input; it does not provide application-level validation of a parsed result. See [structured output](https://developer.chrome.com/docs/ai/structured-output-for-prompt-api).

Cancellation and resource ownership are separate. A creation or clone signal can destroy its resulting native session. The workflow detaches creation cancellation after accepting ownership, interrupts individual operations separately, and destroys its sessions on disposal. Callers own sessions returned by `clone()`. See [Prompt API session management](https://developer.chrome.com/docs/ai/session-management) and the [creation and clone signal documentation](https://developer.chrome.com/docs/ai/prompt-api).

### Attachments

`buildPrompt()` preserves native image and audio values and converts text-like `File`, `Blob`, buffer, or string values into text content. Named text files receive a label. The helper limits binary text sources to 2 MiB by default; callers can change that limit. `readTextSource()` also supports an explicit text encoding.

The native Prompt controller's attachment methods declare the required modalities and recreate a session when its requirements change. The advanced Prompt workflow accepts the resulting native prompt; its caller configures modalities when creating or restoring the session. The shared conversation controller handles those declarations and keeps original attachment values available for same-page chat switches and model-option changes.

Durable chat history is text-only: completed messages retain extracted file text, chat metadata, and summaries. Image/audio values remain in controller memory, and preview URLs belong to the view. Reloading the page restores text without the binary attachments. Reattach an image or recording when a later session needs its original content.

Summarizer, Writer, Rewriter, Translator, Language Detector, and Proofreader take text. Their file inputs use text extraction before inference. Image and audio attachments belong to Prompt API. PDF and office-document parsing are outside the attachment helper's contract.

### Availability

Treat `available`, `downloadable`, `downloading`, and `unavailable` as distinct application states. Use matching model options for availability and creation, and initiate a required download through a user action. Audio and image availability can differ from text availability. The [session management guide](https://developer.chrome.com/docs/ai/session-management) covers session reuse and model resource ownership.

## Specialized built-in APIs

The lightweight controllers expose the native operations. The optional workflow entry adds these policies:

| Workflow                         | Additional behavior                                                   |
| -------------------------------- | --------------------------------------------------------------------- |
| `createSummarizerWorkflow`       | Measured chunks, recursive summary rollup, progress, streaming        |
| `createWriterWorkflow`           | Measured context fitting, streaming, ordered batches                  |
| `createRewriterWorkflow`         | Measured context fitting, streaming, ordered batches                  |
| `createTranslatorWorkflow`       | Language-pair session reuse, ordered chunks, streaming, batches       |
| `createLanguageDetectorWorkflow` | Measured chunks and weighted aggregation of ranked results            |
| `createProofreaderWorkflow`      | Normalized corrections and adjusted ranges across chunks              |
| `createPromptWorkflow`           | History fitting, recent-message restoration, optional summary caching |

Each API is feature-detected independently. Applications select a workflow when its long-input policy fits their product; native controllers leave that policy to the caller.

## WebMCP 0.1.9

The wrapper targets `document.modelContext` and the current [WebMCP type definitions](https://github.com/webmachinelearning/webmcp-types/blob/main/index.d.ts):

- `registerTool(tool, { signal, exposedTo })` and schema-inferred callback input;
- `getTools({ fromOrigins })` and `toolchange` observation;
- `executeTool(tool, inputObject, { signal })`, preserving the native execution result;
- `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, and `debugging` annotations.

Application calls accept an object or JSON text. The wrapper parses text, validates the object, and selects the installed browser's input format before execution. New application calls should pass objects. Native execution returns a string, or `null` when it triggers navigation; guard that case before parsing a JSON result. The nullable result appears in both the inspected [Chrome 153 IDL](https://chromium.googlesource.com/chromium/src/+/792bf6722e73a45aa9e47c163b9901bdc17f3230/third_party/blink/renderer/core/script_tools/model_context.idl) and the [current imperative documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api#execute-tool), even though `webmcp-types` 0.1.9 declares a string-only return.

```ts
const resultText = await webMcp.executeTool(tool, { title: 'Review the itinerary' });
const result = resultText === null ? null : JSON.parse(resultText);
```

Native format selection uses `document.modelContext.executeTool.length`: `>= 2` selects the earlier required JSON-text argument; otherwise the wrapper passes an object, matching the current optional argument's native length of `1`. Wrappers or polyfills that alter this value can set `inputFormat: 'object'` or `inputFormat: 'json'`. The library makes one native call and never retries an error with another format. See the [compatibility details](./webmcp.md#chrome-input-format-transition).

Chromium adopted optional object input and object-valued discovered schemas on September 10, 2026, in [commit `23cad65d6e6613d62542b27651c28925acfaffb2`](https://chromium.googlesource.com/chromium/src/+/23cad65d6e6613d62542b27651c28925acfaffb2). Browser release branches can retain the earlier interface after the type package changes. Chrome’s [imperative guide](https://developer.chrome.com/docs/ai/webmcp/imperative-api#execute-tool) identifies JSON-string arguments as deprecated from Chrome 155.

Registration returns a disposer tied to that registration. Disposing an older registration cannot remove its replacement. Disposing the controller removes its listeners and registrations and aborts executions it owns. Discovery retains its `fromOrigins` filter when tools change.

The bundled validator covers common JSON Schema keywords and custom `validateInput` callbacks. It is not a complete JSON Schema implementation. Validate unsupported schema constructs and business rules in the application; tool annotations do not enforce authorization or confirmation.

The form helpers generate `toolname`, `tooldescription`, `toolautosubmit`, and `toolparamdescription` attributes. They preserve ordinary form behavior. See Chrome's [declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api).

Chrome offers WebMCP through an origin trial from Chrome 149 and the local `#enable-webmcp-testing` flag. Origin isolation and the `tools` Permissions Policy apply; cross-origin discovery also requires explicit exposure and origin selection. See the [WebMCP overview](https://developer.chrome.com/docs/ai/webmcp) and [proposal](https://github.com/webmachinelearning/webmcp).

## Verification record

This record is current as of **September 19, 2026, Europe/Podgorica**. The user’s enabled browser reports **Chrome 153.0.8010.53 arm64**, revision `792bf6722e73a45aa9e47c163b9901bdc17f3230`. Its native WebMCP method still requires JSON-text input. The [IDL for that exact revision](https://chromium.googlesource.com/chromium/src/+/792bf6722e73a45aa9e47c163b9901bdc17f3230/third_party/blink/renderer/core/script_tools/model_context.idl) requires the second argument and exposes discovered schemas as strings. The wrapper selects that format before its single execution call. The newer object format remains the default for the modern optional-argument signature.

The tested candidate is the working-tree implementation based on commit `c79fee9c03150b7e7915728d54d8764996cd8303`; it has not been committed or published. Manual tests used the existing flag-enabled profile and installed models. No additional AI models were downloaded.

| Capability                               | Evidence and limits                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Imperative WebMCP                        | The Nuxt workspace discovery/search/shortlist chain passed. A native library check also verified registration, discovery, one execution, and zero remaining owned registrations after disposal.                                                                                                          |
| Declarative WebMCP                       | A local form executed through the library, changed visible state, reported `agentInvoked: true`, and returned its `respondWith` result exactly once. The Nuxt visit-draft action builds and has ordinary-form browser coverage; that specific action was not separately completed through native WebMCP. |
| Modern WebMCP object input               | Reviewed against current types and Chromium sources and covered by unit regressions. Chrome 153 retains the earlier JSON-input signature, so modern native object execution was not live-tested.                                                                                                         |
| Prompt text                              | Native generation produced the requested “RELEASE VERIFIED” response in the demo.                                                                                                                                                                                                                        |
| Prompt image                             | Native text-plus-image inference correctly identified a generated red circle from a PNG attachment.                                                                                                                                                                                                      |
| Prompt audio                             | Native text-plus-audio inference passed a transcription assertion for a local 16 kHz mono WAV recording.                                                                                                                                                                                                 |
| Summarizer and Writer                    | Both generated text in the Nuxt demo using installed models.                                                                                                                                                                                                                                             |
| Rewriter, Language Detector, Proofreader | Native library checks passed: formal rewriting, English detection, and grammar corrections with corrected text and correction records.                                                                                                                                                                   |
| Translator                               | English/French and English/Spanish pairs in both directions reported `downloadable`. Availability was verified; translation was skipped to avoid installing resources.                                                                                                                                   |
| Advanced workflows                       | History recovery, summary caching, measured chunks, batches, cancellation, and storage failure behavior passed unit tests. Long-input and long-history native model runs were not separately verified.                                                                                                   |
| Cross-origin WebMCP                      | Exposure, discovery filters, and registration options passed controlled-context tests. Live permitted/denied iframe scenarios were not verified.                                                                                                                                                         |
| Component parity                         | Eleven components and eight API bindings checked across all four rendering frameworks. Shared Translator tests cover automatic runs, debounce, swapping, Stop, and explicit resource preparation.                                                                                                        |

### Release checks

All library builds, four framework demo builds, the Nuxt production build, typechecks, lint, formatting, peer checks, production audit, package validation, framework parity, bundle budgets, and changeset validation passed. ESLint includes TypeScript, TSX, Vue, and Svelte sources, with React hook rules enabled.

The unit run passed **1,065 tests**. Every package exceeded the required 95% threshold for each metric:

| Package | Tests | Statements | Branches | Functions |  Lines |
| ------- | ----: | ---------: | -------: | --------: | -----: |
| Core    |   562 |     98.92% |   96.17% |    99.62% | 99.43% |
| Vue     |   116 |     98.81% |   95.79% |      100% | 99.70% |
| React   |   151 |     99.77% |   98.13% |      100% |   100% |
| Svelte  |   124 |     99.14% |   95.96% |    98.37% | 99.86% |
| Angular |   109 |     99.82% |   95.16% |    99.31% | 99.79% |
| Nuxt    |     3 |       100% |     100% |      100% |   100% |

Browser and Nuxt integration suites passed **16 tests**. Four optional live-CDP tests were skipped because this profile did not expose a configured endpoint. Those skips are separate from the manual native results above.

Representative single-controller and adapter imports measured **3,298–6,069 bytes minified gzip**, with framework runtimes externalized. Shared component CSS measured **4,980–5,198 bytes gzip** per framework. Bundle checks also reject unrelated UI/Markdown code in headless imports and removed legacy style selectors. These measurements cover the selected exports, not every application bundle or native-model latency.

The Playwright live contract attaches through `BROWSER_AI_CDP_ENDPOINT` and reuses an existing profile. It checks downloadable Translator resources without installing them unless `BROWSER_AI_ALLOW_MODEL_DOWNLOADS=1` is set. Ordinary Playwright Chromium covers the interface when AI APIs are unavailable. Re-run the relevant checks when changing source or browser versions, and record newly verified browser capabilities separately from unit-test evidence.
