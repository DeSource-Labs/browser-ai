# Why Browser AI Kit

Chrome's built-in AI APIs make private, local inference possible. Browser AI Kit makes the surrounding feature maintainable across Vue, React, Svelte, Angular, Nuxt, and plain TypeScript.

## The native APIs are the foundation

Chrome provides the models, hardware acceleration, downloads, resource management, specialized task APIs, and WebMCP implementation. Browser AI Kit does not conceal that architecture behind a cloud-SDK shape.

Calling the native API directly is a sound choice for one small, controlled interaction. The kit earns its place when the integration must handle real lifecycle and product states.

## The first call is short; the feature is not

A production integration must account for:

- support varying by browser, device, profile, language, options, and model state;
- user-initiated model and language-pack downloads;
- session cleanup and interrupted work;
- streaming without excessive renderer updates;
- text that exceeds the native input or context quota;
- Prompt history that overflows after multiple turns;
- multimodal values and local text-file conversion;
- structured output validation;
- server rendering where browser globals do not exist;
- WebMCP registration lifetime, authorization, origin policy, and visible state.

Those concerns repeat across every framework. Reimplementing them in each component invites drift.

## One core, native framework ergonomics

`@desource/browser-ai` owns browser access and state transitions. Its controllers expose immutable external stores, so framework adapters can subscribe without proxying browser-owned sessions.

| Package | Native adaptation                                      |
| ------- | ------------------------------------------------------ |
| Vue     | refs, computed refs, effect-scope disposal             |
| React   | hooks and `useSyncExternalStore`                       |
| Svelte  | stores and explicit teardown                           |
| Angular | signals, services, standalone components, `DestroyRef` |
| Nuxt    | client-only registration and auto-imports              |

The packages share behavior, CSS source, component contracts, and browser scenarios. They do not share a framework runtime. An Angular application never downloads Vue; a React application never downloads Svelte.

## Thin where possible, opinionated where necessary

Simple operations remain recognizable: `prompt()`, `summarize()`, `write()`, `rewrite()`, `translate()`, `detect()`, and `proofread()` map directly to their browser counterparts.

The kit adds policy only around failure-prone work:

| Problem           | Browser AI Kit behavior                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| Availability      | Checks the exact constructor and core options                                    |
| Downloads         | Exposes progress, aborts, errors, and user-action boundaries                     |
| Native objects    | Stores them outside deep framework reactivity                                    |
| Streaming         | Provides incremental streams and accumulated output                              |
| Long summaries    | Measures chunks and recursively rolls up results                                 |
| Long translations | Splits on safe boundaries and preserves order                                    |
| Detection         | Merges confidence weighted by chunk size                                         |
| Proofreading      | Re-bases correction ranges across chunks                                         |
| Prompt history    | Measures real context, observes overflow, and supports compaction                |
| Attachments       | Preserves native image/audio values and locally decodes bounded text files       |
| Structured output | Passes JSON Schema constraints and parses typed results                          |
| WebMCP            | Validates schemas, owns registration signals, and reports deployment diagnostics |

## Optional UI, not a design-system dependency

Each UI framework ships the same 11 accessible starter components. They cover unsupported, downloadable, downloading, ready, processing, cancelled, empty, and failed states and expose stable class hooks.

All styles compile from one Sass source into each package's CSS artifact. There is no CSS-in-JS runtime, framework-neutral component renderer, or cross-package stylesheet request. Teams can use the components as delivered, theme the CSS variables, or use only the headless adapters.

## Honest comparison

| Question                               | Native API        | Hosted-model SDK        | Browser AI Kit                  |
| -------------------------------------- | ----------------- | ----------------------- | ------------------------------- |
| Inference location                     | Chrome            | Provider infrastructure | Chrome                          |
| API key                                | No                | Usually                 | No                              |
| Prompts leave the device for inference | No                | Yes                     | No                              |
| Cross-browser reach                    | No                | Usually                 | No; intentionally Chrome-native |
| Framework lifecycle                    | Application-owned | Varies                  | Included                        |
| Download state UX                      | Application-owned | Not applicable          | Included                        |
| Long-input strategy                    | Application-owned | Varies                  | Per API                         |
| Multimodal file conversion             | Application-owned | SDK-specific            | Included for Prompt API         |
| Accessible starter UI                  | No                | Rarely                  | Optional                        |
| WebMCP lifecycle                       | Application-owned | Unrelated               | Included                        |

A hosted model is not inherently worse. It fits different requirements: broad browser support, server-side guarantees, larger models, or central governance. The product must make the network and privacy boundary explicit.

## When not to use the kit

Choose another approach when:

- the feature must work in Safari, Firefox, mobile Chrome, or ineligible desktop devices;
- a server must guarantee one model and version for every user;
- the task exceeds the local model's capability or context;
- the organization does not permit experimental browser surfaces;
- the native call is small enough that lifecycle abstraction adds more code than it removes;
- WebMCP would hide a consequential action instead of keeping the user in control.

Browser AI Kit is strongest when local privacy, repeated low-latency use, offline-capable inference after download, and consistent framework maintenance matter more than universal reach.

## Evidence, not promises

The repository enforces framework file parity, shared component behavior, at least 95% unit coverage per package, production dependency audit, peer compatibility, built-package validation, framework demo builds, and unsupported Chromium e2e tests. Live tests run separately against an existing Chrome profile with the AI flags enabled; without a CDP endpoint, that opt-in suite is skipped.

Read the dated [API status](api-status.md) before release and the [framework contract](framework-roadmap.md) before changing public behavior.
