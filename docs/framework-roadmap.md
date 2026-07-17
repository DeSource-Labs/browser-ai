# Framework roadmap

Browser AI Kit is designed as a family of framework-native packages around one consistent browser capability model.

## Available now

### Vue

`@desource/browser-ai-vue` provides components, composables, shared helpers, and TypeScript types. It is the current reference implementation for lifecycle behavior, long-input strategies, Prompt API persistence, and WebMCP.

### Nuxt

`@desource/browser-ai-nuxt` adds module installation, client-only component registration, auto-imports, and configurable CSS while delegating behavior to the Vue package.

## Planned

### TypeScript core

A framework-neutral core will isolate browser capability detection, session lifecycle, quota-aware text planning, error normalization, and WebMCP primitives. Framework packages will adapt this layer rather than reimplement browser behavior.

### React

The React package will use hooks and external-store patterns for predictable concurrent rendering. It will include headless hooks and accessible starter components, with behavior aligned to the Vue package.

### Angular

The Angular package will expose injectable services and signals, with standalone components and explicit lifecycle cleanup.

### Svelte

The Svelte package will expose stores, actions, and components that follow Svelte's native reactivity and teardown conventions.

## Cross-framework contract

Each adapter should feel native to its framework while preserving the same product concepts:

- availability states and explicit user-initiated downloads;
- consistent error, abort, progress, and cleanup semantics;
- measured, API-specific strategies for long input;
- structured Prompt API output and context management;
- lifecycle-safe WebMCP tools;
- optional, accessible UI rather than mandatory styling;
- full TypeScript coverage and SSR-safe capability detection.

## How to contribute

New framework work should begin with a public design discussion. A proposal should cover the framework's native state primitive, lifecycle ownership, SSR behavior, package exports, test strategy, and how it maps the cross-framework contract.

Open a [feature request](https://github.com/DeSource-Labs/browser-ai/issues/new?template=feature_request.yml) or read [CONTRIBUTING.md](../CONTRIBUTING.md) before starting an adapter.
