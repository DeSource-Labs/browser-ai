# Browser AI Kit demo

This Nuxt application is the full product demo for all six packages:

- `@desource/browser-ai`
- `@desource/browser-ai-vue`
- `@desource/browser-ai-react`
- `@desource/browser-ai-svelte`
- `@desource/browser-ai-angular`
- `@desource/browser-ai-nuxt`

Each API page renders a working Nuxt/Vue example plus equivalent Vue, React, Svelte, Angular, Nuxt, and plain TypeScript code. The implementation is in `app/components/ApiPage.vue`; framework snippets live in `shared/utils/frameworkExamples.ts`.

## Run

```bash
pnpm install
pnpm dev:prepare
pnpm dev:demo
```

Open the local URL in a supported Chrome profile with the required API flags and models. The page must also remain useful in browsers where every AI global is absent.

## WebMCP workspace

The WebMCP page lets people and browser agents use the same Lisbon workspace catalog, shortlist, and visit form. Its implementation is in `app/components/WebMcpDemo.vue`.

The sample tool chain discovers the page's tools, calls `search_lisbon_workspaces` to find quiet workspaces within a daily budget, then adds one result with `shortlist_lisbon_workspace`. A nonempty shortlist registers `get_lisbon_workspace_shortlist` and `clear_lisbon_workspace_shortlist`; clearing it removes those tools again. The activity list shows each step, and manual shortlist controls update the same state.

The declarative visit form collects a workspace, date, attendee count, and notes. Submitting it saves a visible local draft. It remains usable without WebMCP.

Use **Run discovery → tool chain** for the scripted sequence, or Chrome's [Model Context Tool Inspector](https://developer.chrome.com/docs/ai/webmcp) to call the tools through an agent. Tool registration follows the page lifetime; the page also lets you unregister its tools explicitly.

The integration uses `webmcp-types@0.1.9`. Public execution accepts objects or validated JSON text. The wrapper selects native object input or the older JSON-string signature before calling Chrome, with an explicit `inputFormat` override for wrapped implementations. It never retries tool execution. Results are strings, or `null` when a tool navigates the document. The sample parses catalog responses only when they are present. The “Save through WebMCP” control exercises the declarative visit form through discovery and the same library execution path.

The [WebMCP guide](../docs/webmcp.md) covers schema-literal type inference, `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, `debugging`, cross-origin access, and cleanup. Its small schema validator checks the documented subset; use `validateInput` for additional application or full JSON Schema rules. Execution signals let tools cancel pending work when the caller or controller disposes the operation.

## Smaller framework demos

Vue, React, Svelte, and Angular each have a package-local demo containing all 11 shared components, all eight capability checks, and the same visible WebMCP task workflow:

```bash
pnpm build:framework-demos
pnpm --filter @desource/browser-ai-react dev
```

Replace the filter with the Vue, Svelte, or Angular package name to run another demo.

## Browser tests

Ordinary bundled Chromium verifies unsupported behavior:

```bash
pnpm test:e2e
```

To reuse an already-running Chrome profile with downloaded models:

1. enable **Allow remote debugging for this browser instance** at `chrome://inspect/#remote-debugging`;
2. run:

```bash
BROWSER_AI_CDP_ENDPOINT=http://127.0.0.1:9222 pnpm test:e2e:live
```

The live suite opens and closes only its own pages. It does not close the user's browser or install resources reported as `downloadable`. Set `BROWSER_AI_ALLOW_MODEL_DOWNLOADS=1` only when a deliberate test-time download is acceptable.

The [September 19 verification record](../docs/api-status.md#verification-record) contains the passing build and test results, native Chrome inference and WebMCP checks, and the browser paths that were skipped or not live-tested.
