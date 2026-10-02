# Browser AI Kit demo

Try private, on-device AI at [ai.desourcelabs.com](https://ai.desourcelabs.com): chat with a local model, summarize text, rewrite a draft, or translate between supported languages. The AI examples use Chrome's built-in models and process your inputs on your device, with no API key or hosted-model fallback.

This Nuxt app is also the documentation site for all six packages. Each API page runs the Vue component through the Nuxt module and shows equivalent Vue, React, Svelte, Angular, Nuxt, and plain TypeScript code.

## Run locally

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev:prepare
pnpm dev:demo
```

Open `http://localhost:3000`. API availability is checked in the browser. Downloads start from user actions; unsupported browsers show the unavailable state.

See [Browser setup](../docs/browser-support.md#try-it-in-your-browser) if an API cannot run in your Chrome profile.

## Try the examples

- Open **Prompt API** for streaming chat, saved conversations, and supported image, audio, or text-file inputs.
- Try **Summarizer**, **Writer**, **Rewriter**, and **Proofreader** for local text tools with settings, progress, and stop controls.
- Use **Translator** to prepare a language pair and translate text, or **Language Detector** to see ranked language results.
- Open **WebMCP** to let browser tools search workspaces, build a shortlist, and save a visit draft.

The WebMCP page uses the same workspace catalog, shortlist, and form for people and agents. **Run discovery → tool chain** searches the catalog and adds a result to the visible shortlist. **Save through WebMCP** fills the visit draft through the registered form. These are local demo actions; no workspace is booked. Manual controls remain usable when WebMCP is unavailable.

## Build and preview

```sh
pnpm vercel-build
pnpm --filter demo start
```

`vercel-build` builds packages, prepares Nuxt types, and builds this site. `pnpm build:all` also builds the four framework fixtures. Run `pnpm --filter demo typecheck` after preparing dependencies.

## Editing

- `app/pages/index.vue`: landing page and package quick starts.
- `app/pages/docs.vue`: installation, lifecycle, and configuration guide.
- `app/components/ApiPage.vue`: shared API-page layout.
- `shared/utils/frameworkExamples.ts`: framework snippets shared by the landing page and API pages.
- `public/marketing.js`: copy buttons, package selection, and availability checks on pages served without Nuxt hydration.
- `app/components/WebMcpDemo.vue`: workspace search, shortlist tools, and a local visit-draft form.

Keep examples usable when an API is unavailable. Show required downloads before starting them, and keep displayed results and code snippets consistent. See the [WebMCP guide](../docs/webmcp.md) for tool registration, validation, and deployment requirements.

## Framework fixtures and browser tests

```sh
pnpm build:fixtures
pnpm --filter @desource/browser-ai-react dev
```

Use the Vue, Svelte, or Angular package name to run another fixture. Each contains the shared components and a WebMCP task example.

Browser tests run locally only. See [Contributing](../CONTRIBUTING.md#local-browser-tests) for bundled Chromium and optional live Chrome commands.
