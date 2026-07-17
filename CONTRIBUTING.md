# Contributing to Browser AI Kit

Browser AI Kit exists to make Chrome's built-in AI APIs dependable in real applications. Bug reports, browser compatibility findings, documentation improvements, new tests, and framework integrations are all welcome.

## Before you open a pull request

- Search the [issue tracker](https://github.com/DeSource-Labs/browser-ai/issues) for related work.
- Open an issue first for a large API change or a new framework package. This keeps public APIs consistent across Vue, Nuxt, and the planned React, Angular, and Svelte packages.
- Keep the browser-native approach intact. The project does not proxy inference through a server or silently fall back to a hosted model.

## Local setup

You need Node.js 20.19 or newer, pnpm 11, and a Chrome build that supports the API you are testing.

```bash
git clone https://github.com/DeSource-Labs/browser-ai.git
cd browser-ai
corepack enable
pnpm install
pnpm build
pnpm dev:demo
```

The demo opens at `http://localhost:3000`. Native AI downloads must be started by a real user interaction; automated clicks do not satisfy Chrome's user-activation requirement.

## Quality checks

Run the full local gate before submitting a pull request:

```bash
pnpm check
pnpm format:check
```

When a change affects browser behavior, include the Chrome version, operating system, availability state, and enabled flags in the pull request. Screenshots or a short recording are especially useful for UI changes.

## Changesets

Add a changeset for every user-visible package change:

```bash
pnpm changeset
```

Choose `patch` for fixes, `minor` for backward-compatible features, and `major` for breaking changes. Documentation-only and repository-maintenance changes do not need a changeset.

## Pull request principles

- Preserve SSR safety: native browser globals must never be accessed during server rendering.
- Keep typing and streaming paths responsive; avoid deep reactivity for browser sessions and chunk high-frequency UI updates.
- Treat availability, download, abort, quota, and cleanup states as part of the public feature—not edge cases.
- Add or update tests for behavior changes.
- Use clear, direct documentation and explain constraints honestly.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
