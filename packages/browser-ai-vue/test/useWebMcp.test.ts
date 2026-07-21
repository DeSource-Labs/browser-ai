import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      inputSchema: JSON.stringify(tool.inputSchema ?? {}),
      name: tool.name,
      origin: 'https://example.test',
      title: tool.title,
      window: globalThis.window
    }));
  }

  async executeTool(tool: { name: string }, input: string) {
    return this.tools.get(tool.name)?.execute(JSON.parse(input));
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
    await expect(webMcp.executeTool(tool, { a: 2, b: 3 })).resolves.toBe(5);

    expect(unregister()).toBe(true);
    expect(modelContext.tools.size).toBe(0);
    webMcp.dispose();
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
