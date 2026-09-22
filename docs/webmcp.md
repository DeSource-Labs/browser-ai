# WebMCP guide

WebMCP lets a page publish structured tools that a compatible browser agent can discover and execute. The tool runs in the page, so the user sees the same state change as a manual interaction.

Keep the interface usable by people, with the same application authorization and confirmation steps for tool calls.

WebMCP is available in an origin trial from Chrome 149 and through the local testing flag at `chrome://flags/#enable-webmcp-testing`. See [Chrome's setup instructions](https://developer.chrome.com/docs/ai/webmcp). This library uses `document.modelContext` and the `webmcp-types@0.1.9` contract. Application calls accept object input and return the native response. The wrapper selects the native input format before execution to support Chrome builds on either side of the current API transition.

## A useful tool: create a visible task

The package-local framework demos share this workflow:

1. the page owns an ordinary task list;
2. it registers a task-creation tool while that workspace is open;
3. Chrome discovers the tool and calls it with validated JSON;
4. the executor uses the same task store as the visible form;
5. the new task appears in the page and remains editable by the user;
6. closing the workspace unregisters the tool.

```ts
import { createWebMcp } from '@desource/browser-ai';

const webMcp = createWebMcp();

const unregister = await webMcp.registerTool({
  name: 'create_project_task',
  title: 'Create project task',
  description: 'Create a task in the project currently visible to the user.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 120,
        description: 'Concise task title.'
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high']
      }
    },
    required: ['title'],
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: false,
    untrustedContentHint: true
  },
  execute: async ({ title, priority = 'normal' }, { signal }) => {
    // Inferred from the schema: title is string; priority is 'low' | 'normal' | 'high'.
    signal.throwIfAborted();

    // Re-check the live user and workspace here. Registration is not permission.
    if (!session.canCreateTasks(activeProject.id)) {
      throw new DOMException('Not authorized for this project.', 'NotAllowedError');
    }

    const task = await taskStore.create({ title: title.trim(), priority }, { signal });
    taskStore.select(task.id); // Visible state changes in the human interface.
    return { id: task.id, title: task.title, priority: task.priority };
  }
});

// Call when the workspace or owning component is disposed.
unregister();
```

Browser AI Kit validates the input against `inputSchema` before invoking `execute`, then applies the optional type guard. Validation improves correctness; authorization must still be checked against current application state.

Inline schema literals infer `execute` input through `WebMCP.ModelContextToolFromSchema`. Preserve literal types with `as const` when defining a schema separately. For dynamic schemas or application-specific rules, use `WebMcpTool<Input>` with a `validateInput(input): input is Input` guard.

## Input validation

The dependency-free validator implements a documented subset of JSON Schema:

| Values         | Supported rules                                                            |
| -------------- | -------------------------------------------------------------------------- |
| All            | `type` (including type arrays), `enum`, `const`, `allOf`, `anyOf`, `oneOf` |
| Strings        | `minLength`, `maxLength` (Unicode code points), `pattern`                  |
| Numbers        | `minimum`, `maximum`; finite numbers and integers                          |
| Arrays         | `minItems`, `maxItems`, a single `items` schema                            |
| Objects        | `required`, `properties`, boolean or schema-valued `additionalProperties`  |
| Nested schemas | Boolean `true` and `false` schemas                                         |

Object rules use own properties; an inherited `constructor` does not satisfy a required field. `enum` and `const` compare JSON values independently of object key order. Cyclic schema traversal is rejected.

Unknown keywords and types are ignored. This is not a complete JSON Schema draft validator or a JSON-serializability check. Rules such as `$ref`, `format`, `not`, conditionals, exclusive numeric bounds, `multipleOf`, `uniqueItems`, tuple items, and `patternProperties` need custom validation. Add a `validateInput` type guard backed by your application's validator when those rules matter. That guard runs after the built-in checks, before the registered executor. Validate discovered tool input separately before `executeTool()` if it requires rules outside this subset.

## Tool annotations

All four `webmcp-types@0.1.9` annotations pass through to Chrome:

| Annotation             | Use it when                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `readOnlyHint`         | The tool reads data without changing application state.                                   |
| `untrustedContentHint` | Results include user-generated or external content.                                       |
| `consequentialHint`    | Execution has significant real-world or irreversible effects, such as booking or payment. |
| `debugging`            | The tool is intended for developer diagnostics.                                           |

These hints describe behavior; they do not enforce authorization or confirmation. See [Chrome's annotation guidance](https://developer.chrome.com/docs/ai/webmcp/imperative-api).

## Framework lifecycle adapters

The same controller powers every package:

| Framework        | Entry point             | Cleanup behavior             |
| ---------------- | ----------------------- | ---------------------------- |
| Vue / Nuxt       | `useWebMcp()`           | Vue scope disposal           |
| React            | `useWebMcp()`           | hook effect cleanup          |
| Svelte           | `createWebMcp()`        | explicit controller disposal |
| Angular          | `createAngularWebMcp()` | `DestroyRef` cleanup         |
| Plain TypeScript | `createWebMcp()`        | explicit `dispose()`         |

All expose support state, registration, batch registration, local unregistration, discovery, execution, and final disposal. Framework wrappers subscribe to the same external store. Svelte owners call `dispose()` from `onDestroy`; a store unsubscribe only detaches that subscriber. Angular owners pass `DestroyRef` or dispose explicitly. Headless Angular imports use `@desource/browser-ai-angular/controllers`.

## Discover and execute tools

```ts
const tools = await webMcp.refreshTools();
const tool = tools.find(({ name }) => name === 'create_project_task');

if (tool) {
  const result = await webMcp.executeTool(tool, {
    title: 'Review WebMCP demo',
    priority: 'high'
  });
  console.log(result);
}
```

The public wrapper accepts an object or JSON text, parses text once, requires an object, and validates the discovered schema. It then selects the native input format described below. Although `webmcp-types@0.1.9` declares a string, the native IDL also permits `null` after navigation. The wrapper exposes `Promise<string | null>` and preserves that result. Parse a response as JSON only when the tool's output contract specifies JSON.

Discovery and registration start `toolchange` observation. Later changes refresh discovery with the most recent `fromOrigins` filter. An execution that changes the registered tool set still keeps its own result and execution status.

### Chrome input-format transition

Chromium changed `executeTool()` from a required JSON-text argument to an optional object argument on September 10, 2026. The change also made discovered `inputSchema` values objects. See the [Chromium change](https://chromium.googlesource.com/chromium/src/+/23cad65d6e6613d62542b27651c28925acfaffb2) and [specification discussion](https://github.com/webmachinelearning/webmcp/pull/246).

An updated browser can still be on a release branch with the earlier interface. The inspected Chrome **153.0.8010.53 arm64** build uses revision `792bf6722e73a45aa9e47c163b9901bdc17f3230`; its [exact IDL](https://chromium.googlesource.com/chromium/src/+/792bf6722e73a45aa9e47c163b9901bdc17f3230/third_party/blink/renderer/core/script_tools/model_context.idl) requires JSON text and exposes schemas as strings.

The library checks the native method's declared argument count before making one call:

| Native `executeTool.length` | Selected input format                                                               |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `>= 2`                      | Serialize the validated object as JSON for the earlier required argument            |
| `< 2`                       | Pass the validated object; the current optional argument has a native length of `1` |

This selection follows the native WebIDL signatures. A JavaScript wrapper or polyfill can change the method's `length`. Set `inputFormat: 'object'` or `inputFormat: 'json'` when that wrapper hides the underlying contract:

```ts
// This wrapper fronts the current object-input contract.
if (tool) {
  const result = await webMcp.executeTool(tool, { title: 'Review WebMCP demo' }, { inputFormat: 'object' });
  console.log(result);
}
```

Choose `'json'` instead when the wrapper fronts the earlier JSON-text contract. `inputFormat` is a library option and is removed before calling the native method. Supplying JSON text as the public input does not itself override format detection.

The library never retries a failed execution with another format. The tool may already have changed state before an error reaches the caller; a retry could create a second task, booking, or payment.

## Declarative forms

The declarative API annotates a normal HTML form. Agents receive a structured tool while people keep the labels, controls, validation, submit handler, keyboard behavior, and visible result.

```ts
import { createWebMcpFieldAttributes, createWebMcpFormAttributes } from '@desource/browser-ai';

const formAttributes = createWebMcpFormAttributes({
  name: 'create_project_task',
  description: 'Create a task in the project currently visible to the user.'
});

const titleAttributes = createWebMcpFieldAttributes('Concise task title, up to 120 characters.');
```

```html
<form toolname="create_project_task" tooldescription="Create a task in the project currently visible to the user.">
  <label for="task-title">Task title</label>
  <input
    id="task-title"
    name="title"
    required
    maxlength="120"
    toolparamdescription="Concise task title, up to 120 characters."
  />
  <button type="submit">Add task</button>
</form>
```

Removing `toolname` or `tooldescription` unregisters the declarative tool. Use `autoSubmit` only when submitting without an explicit user review is appropriate for the action.

## Registration lifetime

Chrome unregisters imperative tools through `AbortSignal`. The core wrapper owns one controller per tool and returns an idempotent unregister function:

```ts
const owner = new AbortController();

await webMcp.registerTool(tool, {
  signal: owner.signal,
  replaceExisting: true
});

owner.abort(); // Removes the tool and updates local state.
```

Registering the same name replaces the controller's previous registration by default. Pass `replaceExisting: false` to reject a name that is already registered or pending. A cleanup function returned by an old registration cannot unregister its replacement.

Pass an execution signal to `executeTool(tool, input, { signal })` to cancel a call. The registered executor receives a native execution signal; propagate it to fetches and other work. `dispose()` unregisters owned tools, detaches discovery observation, aborts owned executions, and prevents their late results from repopulating state. Cancellation does not undo a mutation that already completed.

Use a narrow lifetime:

- mount/unmount for component-owned tools;
- route lifetime for page tools;
- signed-in workspace lifetime for account-scoped tools;
- explicit replacement when tool semantics or authorization changes.

Do not leave stale tools registered after their backing UI or data context disappears.

## Cross-origin tools

Same-origin discovery is the default. A cross-origin tool needs three independent gates:

1. the embedding document delegates `tools` to the iframe;
2. the provider registers with the consumer origin in `exposedTo`;
3. the consumer requests the provider origin in `fromOrigins`.

```html
<iframe src="https://partner.example/tools" allow="tools"></iframe>
```

```ts
// Provider
await provider.registerTool(tool, {
  exposedTo: ['https://app.example']
});

// Consumer
const tools = await consumer.refreshTools({
  fromOrigins: ['https://partner.example']
});
```

Use exact secure origins. A broad cross-origin tool surface should receive the same review as a public API.

## Deployment requirements

WebMCP is available only in an origin-isolated document and is gated by the `tools` Permissions Policy. Recommended same-origin response headers:

```http
Origin-Agent-Cluster: ?1
Permissions-Policy: tools=(self)
```

Nuxt/Nitro:

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

Configure the final CDN or reverse-proxy response if it replaces application headers. `getWebMcpSupport()` reports secure-context, origin-isolation, and permission diagnostics, but only the browser determines actual support.

## Security review

For each tool:

- re-check authentication, authorization, active tenant, and resource ownership during execution;
- validate and normalize input again at the application boundary;
- propagate the execution `AbortSignal` to fetches and long work;
- return the minimum result needed for the task;
- never expose access tokens, secrets, or unrelated records;
- set `readOnlyHint` truthfully;
- set `untrustedContentHint` when output includes user or open-web content;
- set `consequentialHint` for significant real-world or irreversible effects;
- keep destructive, financial, account, or publishing actions visibly confirmable;
- log security-relevant actions without logging sensitive tool input or output;
- keep the human interface usable and authoritative.

Tool descriptions and JSON Schemas guide an agent. They are not a security boundary.

## Test both environments

Ordinary Playwright Chromium normally has no WebMCP surface. The shared unsupported suite verifies the page still works and the declarative form can be used manually.

The live suite attaches to an already-running, flag-enabled Chrome profile:

```bash
BROWSER_AI_CDP_ENDPOINT=http://127.0.0.1:9222 pnpm test:e2e:live
```

The contract registers the framework demo's imperative task tool, discovers it, executes it, and checks that the task appears in the visible list. The live project is skipped without a CDP endpoint. Direct native calls in a test harness must use the installed browser's signature; wrapper calls use the detection described above. Reusing the profile avoids downloading another model.

The September 19 verification passed native registration, discovery, execution, and cleanup in Chrome 153, plus declarative form execution with `agentInvoked` and `respondWith`. This browser uses the earlier JSON-input signature; modern object input has unit coverage. See the [API verification record](./api-status.md#verification-record) for the exact browser and remaining live-test limits.

## Official references

- [WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)
- [WebMCP proposal and use cases](https://github.com/webmachinelearning/webmcp)
