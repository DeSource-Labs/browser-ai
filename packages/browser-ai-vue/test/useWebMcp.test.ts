import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import {
  createWebMcpFieldAttributes,
  createWebMcpFormAttributes,
  getWebMcpSupport,
  useWebMcp,
  type WebMcpTool
} from '../src/composables/useWebMcp';

class FakeModelContext extends EventTarget {
  readonly tools = new Map<string, WebMcpTool>();

  async registerTool(tool: WebMcpTool, options: { signal?: AbortSignal } = {}) {
    this.tools.set(tool.name, tool);
    options.signal?.addEventListener(
      'abort',
      () => {
        this.tools.delete(tool.name);
        this.dispatchEvent(new Event('toolchange'));
      },
      { once: true }
    );
    this.dispatchEvent(new Event('toolchange'));
  }

  async getTools() {
    return Array.from(this.tools.values(), (tool) => ({
      annotations: tool.annotations,
      description: tool.description,
      inputSchema: tool.inputSchema,
      name: tool.name,
      origin: 'https://example.test',
      title: tool.title,
      window: globalThis.window
    }));
  }

  async executeTool(tool: { name: string }, input: Record<string, unknown> = {}) {
    return JSON.stringify(await this.tools.get(tool.name)?.execute(input, { signal: new AbortController().signal }));
  }
}

describe('useWebMcp', () => {
  let modelContext: FakeModelContext;

  beforeEach(() => {
    modelContext = new FakeModelContext();
    vi.stubGlobal('window', {
      isSecureContext: true,
      originAgentCluster: true
    });
    vi.stubGlobal('document', {
      modelContext,
      permissionsPolicy: {
        allowsFeature: (name: string) => name === 'tools'
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports support and manages tool lifecycle with AbortSignal', async () => {
    expect(getWebMcpSupport()).toMatchObject({
      supported: true,
      secureContext: true,
      originIsolated: true,
      permissionAllowed: true
    });

    const webMcp = useWebMcp();
    expect(webMcp.modelContext.value).toBe(modelContext);
    expect(webMcp.support.value.supported).toBe(true);
    expect(webMcp.isSupported.value).toBe(true);
    expect(webMcp.processing.value).toBe('');
    expect(webMcp.isProcessing.value).toBe(false);
    expect(webMcp.discoveredTools.value).toEqual([]);
    expect(webMcp.error.value).toBeNull();
    expect(webMcp.lastResult.value).toBeNull();
    const unregister = await webMcp.registerTool({
      name: 'add_numbers',
      description: 'Add two numbers.',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        }
      },
      annotations: { readOnlyHint: true },
      execute: ({ a, b }) => Number(a) + Number(b)
    });

    const [tool] = await webMcp.refreshTools();
    expect(webMcp.registeredTools.value).toHaveLength(1);
    await expect(webMcp.executeTool(tool, { a: 2, b: 3 })).resolves.toBe('5');

    expect(unregister()).toBe(true);
    expect(modelContext.tools.size).toBe(0);
    webMcp.dispose();
  });

  it('handles missing documents and disposes registrations with a Vue scope', async () => {
    vi.stubGlobal('document', undefined);
    const detached = useWebMcp();
    expect(detached.modelContext.value).toBeNull();
    detached.dispose();

    vi.stubGlobal('document', { modelContext });
    const scope = effectScope();
    let scoped!: ReturnType<typeof useWebMcp>;
    scope.run(() => {
      scoped = useWebMcp();
    });
    await scoped.registerTools([
      { name: 'one', description: 'One.', execute: () => 1 },
      { name: 'two', description: 'Two.', execute: () => 2 }
    ]);
    expect(scoped.registeredTools.value).toHaveLength(2);
    expect(scoped.unregisterTool('one')).toBe(true);
    expect(scoped.unregisterAll()).toBeUndefined();
    expect(scoped.registeredTools.value).toEqual([]);
    scope.stop();
    expect(modelContext.tools.size).toBe(0);
  });

  it('creates declarative form and field attributes', () => {
    expect(
      createWebMcpFormAttributes({
        name: 'submit_note',
        description: 'Submit a note.',
        autoSubmit: true
      })
    ).toEqual({
      toolname: 'submit_note',
      tooldescription: 'Submit a note.',
      toolautosubmit: true
    });
    expect(createWebMcpFieldAttributes('The note body.')).toEqual({
      toolparamdescription: 'The note body.'
    });
    expect(() =>
      createWebMcpFormAttributes({
        name: 'bad name',
        description: 'Invalid.'
      })
    ).toThrow(TypeError);
  });

  it('updates registered state when an external lifetime signal aborts', async () => {
    const lifetime = new AbortController();
    const webMcp = useWebMcp();
    await webMcp.registerTool(
      {
        name: 'temporary_tool',
        description: 'A temporary test tool.',
        execute: () => 'ok'
      },
      { signal: lifetime.signal }
    );

    expect(webMcp.registeredTools.value).toHaveLength(1);
    lifetime.abort();
    expect(webMcp.registeredTools.value).toHaveLength(0);
    expect(modelContext.tools.size).toBe(0);
    webMcp.dispose();
  });
});
