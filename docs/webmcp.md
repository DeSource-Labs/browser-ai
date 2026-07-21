# WebMCP guide

WebMCP lets a website publish structured tools that compatible browser agents can discover and invoke. Browser AI Kit wraps the current `document.modelContext` API with Vue lifecycle management, diagnostics, discovery, execution, and declarative form helpers.

WebMCP is experimental. At the time of this review it is available through Chrome's testing flag and an origin trial. Expect the surface and deployment requirements to evolve.

## Imperative tool registration

```ts
import { useWebMcp } from '@desource/browser-ai-vue';

const webMcp = useWebMcp();

const unregister = await webMcp.registerTool({
  name: 'search_catalog',
  description: 'Search products available to the current visitor.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', minLength: 2 },
      limit: { type: 'integer', minimum: 1, maximum: 20 }
    },
    required: ['query'],
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true
  },
  execute: async ({ query, limit = 10 }) => {
    return catalog.search(String(query), Number(limit));
  }
});
```

The returned function aborts the registration. Registrations owned by a Vue effect scope are also removed when that scope is disposed.

## Discover and execute tools

```ts
await webMcp.refreshTools();

const result = await webMcp.executeTool('search_catalog', {
  query: 'ergonomic keyboard',
  limit: 5
});
```

`tools`, `processing`, `error`, and support diagnostics are reactive. The composable listens for `toolchange`, so a developer console or inspector can remain current as the page registers and removes tools.

## Declarative forms

WebMCP can describe an existing form without duplicating its submit behavior:

```vue
<script setup lang="ts">
import { createWebMcpFieldAttributes, createWebMcpFormAttributes } from '@desource/browser-ai-vue';

const formAttrs = createWebMcpFormAttributes({
  name: 'request_demo',
  description: 'Request a product demonstration.'
});

const emailAttrs = createWebMcpFieldAttributes({
  description: 'Work email address for the confirmation.'
});
</script>

<template>
  <form v-bind="formAttrs" action="/demo-request" method="post">
    <input v-bind="emailAttrs" name="email" type="email" required />
    <button type="submit">Request demo</button>
  </form>
</template>
```

Keep the ordinary form usable by people, keyboard navigation, and assistive technology. Declarative metadata should describe a working interface, not replace one.

## Required response headers

Production documents need origin isolation and a Permissions Policy:

```http
Origin-Agent-Cluster: ?1
Permissions-Policy: tools=(self)
```

Nuxt/Nitro example:

```ts
export default defineNuxtConfig({
  routeRules: {
    '/**': {
      headers: {
        'origin-agent-cluster': '?1',
        'permissions-policy': 'tools=(self)'
      }
    }
  }
});
```

Configure the final response layer if a CDN or reverse proxy overrides application headers. Cross-origin discovery requires an intentionally broader policy plus compatible `fromOrigins` and `exposedTo` options.

## Security rules

A tool schema helps an agent construct a call. It does not prove that the caller may perform the action.

- Re-check authentication and authorization inside `execute`.
- Validate and normalize every input, even when the schema is strict.
- Return the minimum information needed for the task.
- Never return secrets, raw access tokens, or unrelated customer records.
- Mark read-only tools accurately.
- Mark output derived from users or the open web as untrusted content.
- Keep destructive or consequential actions visible and confirmable in the product.
- Avoid broadly exposed cross-origin tools unless the product explicitly needs them.
- Log security-relevant actions without logging sensitive prompt or result content.

The [WebMCP security guidance](https://developer.chrome.com/docs/ai/webmcp/security) should be part of every implementation review.

## Support diagnostics

`getWebMcpSupport()` and `useWebMcp().support` report whether `document.modelContext` exists and whether the current document meets the secure-context, origin-isolation, and Permissions-Policy expectations. Use those diagnostics during development; present a concise unsupported state to end users.

Official references: [overview](https://developer.chrome.com/docs/ai/webmcp), [imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), and [declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api).
