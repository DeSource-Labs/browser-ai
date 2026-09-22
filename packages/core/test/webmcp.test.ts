import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  createWebMcp,
  createWebMcpFieldAttributes,
  createWebMcpFormAttributes,
  getWebMcpSupport,
  parseWebMcpInputSchema,
  validateWebMcpInput,
  type WebMcpRegisteredTool,
  type WebMcpTool,
  type WebMcpToolInput
} from '../src';
import { deferred, flushPromises } from './helpers';

interface NativeTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: WebMcpToolInput, options?: { signal: AbortSignal }): unknown | Promise<unknown>;
}

const registeredTool = (overrides: Partial<WebMcpRegisteredTool> = {}): WebMcpRegisteredTool => ({
  name: 'tool',
  title: 'Tool',
  description: 'A test tool.',
  inputSchema: { type: 'object', properties: {} },
  window,
  origin: window.location.origin,
  ...overrides
});

const setDocumentValue = (name: string, value: unknown) => {
  Object.defineProperty(document, name, { value, configurable: true });
};

const installContext = () => {
  const context = new EventTarget() as EventTarget & {
    registerTool: ReturnType<typeof vi.fn>;
    getTools: ReturnType<typeof vi.fn>;
    executeTool: ReturnType<typeof vi.fn>;
  };
  context.registerTool = vi.fn().mockResolvedValue(undefined);
  context.getTools = vi.fn().mockResolvedValue([]);
  context.executeTool = vi.fn().mockResolvedValue('{"ok":true}');
  setDocumentValue('modelContext', context);
  return context;
};

const simpleTool = (overrides: Partial<WebMcpTool> = {}): WebMcpTool => ({
  name: 'example_tool',
  title: 'Example tool',
  description: 'Perform a bounded test action.',
  inputSchema: {
    type: 'object',
    properties: { value: { type: 'string' } },
    required: ['value'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  execute: vi.fn((input) => ({ received: input.value })),
  ...overrides
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const property of ['modelContext', 'permissionsPolicy', 'featurePolicy']) {
    Reflect.deleteProperty(document, property);
  }
  for (const property of ['isSecureContext', 'originAgentCluster']) {
    Reflect.deleteProperty(window, property);
  }
});

it('preserves null results from tools that navigate the document', async () => {
  const context = installContext();
  context.executeTool.mockResolvedValue(null);
  const client = createWebMcp();
  const result = await client.executeTool(registeredTool(), {});
  expectTypeOf(result).toEqualTypeOf<string | null>();
  expect(result).toBeNull();
  expect(client.state.getSnapshot().lastResult).toBeNull();
  expect(context.executeTool).toHaveBeenCalledTimes(1);
  client.dispose();
});

describe('partial WebMCP implementations', () => {
  it('registers callable tools without EventTarget, discovery, or execution methods', async () => {
    const context = { registerTool: vi.fn() };
    setDocumentValue('modelContext', context);
    const client = createWebMcp();
    const tool = simpleTool();
    const cleanup = await client.registerTool(tool);
    expect(client.state.getSnapshot()).toMatchObject({
      support: { supported: true },
      registeredTools: [tool],
      processing: '',
      error: null
    });
    const [nativeTool, { signal }] = context.registerTool.mock.calls[0] as [NativeTool, { signal: AbortSignal }];
    expect(nativeTool.execute({ value: 'works' })).toEqual({ received: 'works' });
    await expect(client.refreshTools()).rejects.toThrow('WebMCP tool discovery is not available in this document.');
    expect(client.state.getSnapshot()).toMatchObject({
      registeredTools: [tool],
      processing: '',
      error: new Error('WebMCP tool discovery is not available in this document.')
    });
    await expect(client.executeTool(registeredTool())).rejects.toThrow(
      'WebMCP tool execution is not available in this document.'
    );
    expect(client.state.getSnapshot()).toMatchObject({
      registeredTools: [tool],
      processing: '',
      error: new Error('WebMCP tool execution is not available in this document.')
    });
    expect(cleanup()).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(() => client.dispose()).not.toThrow();
  });

  it.each(['addEventListener', 'removeEventListener'] as const)(
    'skips observation unless %s is callable and disposes registered tools safely',
    async (missing) => {
      const context = {
        registerTool: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };
      Object.defineProperty(context, missing, { value: true });
      setDocumentValue('modelContext', context);
      const client = createWebMcp();
      await client.registerTool(simpleTool());
      const listener = missing === 'addEventListener' ? context.removeEventListener : context.addEventListener;
      expect(listener).not.toHaveBeenCalled();
      expect(() => client.dispose()).not.toThrow();
      expect(listener).not.toHaveBeenCalled();
      const signal = (context.registerTool.mock.calls[0]?.[1] as { signal: AbortSignal }).signal;
      expect(signal.aborted).toBe(true);
    }
  );

  it('detaches the previous native context before registering with a context without events', async () => {
    const native = installContext();
    const remove = vi.spyOn(native, 'removeEventListener');
    const client = createWebMcp();
    await client.refreshTools();
    const partial = { registerTool: vi.fn() };
    setDocumentValue('modelContext', partial);
    await client.registerTool(simpleTool());
    expect(remove).toHaveBeenCalledExactlyOnceWith('toolchange', expect.any(Function));
    native.dispatchEvent(new Event('toolchange'));
    expect(native.getTools).toHaveBeenCalledOnce();
    client.dispose();
    expect(remove).toHaveBeenCalledOnce();
  });

  it('does not fail disposal if an observed context loses its event-removal method', async () => {
    const context = installContext();
    const client = createWebMcp();
    await client.registerTool(simpleTool());
    Object.defineProperty(context, 'removeEventListener', { value: undefined });
    expect(() => client.dispose()).not.toThrow();
    expect(client.state.getSnapshot()).toMatchObject({ registeredTools: [], processing: '', error: null });
  });
});

describe('WebMCP support diagnostics', () => {
  it('is SSR safe', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    expect(getWebMcpSupport()).toEqual({
      supported: false,
      secureContext: null,
      originIsolated: null,
      permissionAllowed: null,
      reason: 'server'
    });
  });

  it('rejects imperative operations when no document exists', async () => {
    vi.stubGlobal('document', undefined);
    await expect(createWebMcp().refreshTools()).rejects.toThrow('WebMCP is not available');
  });

  it('reports supported, security, isolation, permission, and generic failures', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(window, 'originAgentCluster', { value: true, configurable: true });
    setDocumentValue('permissionsPolicy', { allowsFeature: vi.fn().mockReturnValue(true) });
    installContext();
    expect(getWebMcpSupport()).toMatchObject({ supported: true, reason: 'supported', permissionAllowed: true });

    Reflect.deleteProperty(document, 'modelContext');
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    expect(getWebMcpSupport().reason).toBe('insecure-context');
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(window, 'originAgentCluster', { value: false, configurable: true });
    expect(getWebMcpSupport().reason).toBe('origin-not-isolated');
    Object.defineProperty(window, 'originAgentCluster', { value: true, configurable: true });
    setDocumentValue('permissionsPolicy', { allowsFeature: vi.fn().mockReturnValue(false) });
    expect(getWebMcpSupport().reason).toBe('permission-disabled');
    setDocumentValue('permissionsPolicy', {
      allowsFeature: vi.fn().mockImplementation(() => {
        throw new Error('no');
      })
    });
    expect(getWebMcpSupport()).toMatchObject({ reason: 'unsupported', permissionAllowed: null });
    Reflect.deleteProperty(document, 'permissionsPolicy');
    setDocumentValue('featurePolicy', { allowsFeature: vi.fn().mockReturnValue(true) });
    expect(getWebMcpSupport()).toMatchObject({ reason: 'unsupported', permissionAllowed: true });
  });
});

describe('WebMCP schemas and declarative attributes', () => {
  it('parses object and serialized schemas', () => {
    const schema = { type: 'object' };
    expect(parseWebMcpInputSchema(undefined)).toBeUndefined();
    expect(parseWebMcpInputSchema(schema)).toBe(schema);
    expect(parseWebMcpInputSchema('{"type":"object"}')).toEqual(schema);
    expect(() => parseWebMcpInputSchema([])).toThrow('JSON object');
    expect(() => parseWebMcpInputSchema('[]')).toThrow('decode to a JSON object');
    expect(() => parseWebMcpInputSchema('null')).toThrow('decode to a JSON object');
    expect(() => parseWebMcpInputSchema('{')).toThrow(SyntaxError);
  });

  it('validates both JSON Schema and custom predicates', () => {
    const tool = simpleTool({
      validateInput: (input): input is WebMcpToolInput =>
        typeof input === 'object' && input !== null && (input as WebMcpToolInput).value !== 'blocked'
    });
    expect(validateWebMcpInput(tool, { value: 'allowed' })).toEqual({ value: 'allowed' });
    expect(() => validateWebMcpInput(tool, null)).toThrow('must be a JSON object');
    expect(() => validateWebMcpInput(tool, [])).toThrow('must be a JSON object');
    expect(() => validateWebMcpInput(tool, {})).toThrow('schema validation');
    expect(() => validateWebMcpInput(tool, { value: 'blocked' })).toThrow('custom validation');
    expect(
      validateWebMcpInput(simpleTool({ inputSchema: undefined, validateInput: undefined }), { any: true })
    ).toEqual({
      any: true
    });
  });

  it('creates standards-based form and field attributes', () => {
    expect(createWebMcpFormAttributes({ name: 'save.draft', description: 'Save a local draft.' })).toEqual({
      toolname: 'save.draft',
      tooldescription: 'Save a local draft.'
    });
    expect(
      createWebMcpFormAttributes({ name: 'save_draft', description: 'Save a local draft.', autoSubmit: true })
    ).toEqual({ toolname: 'save_draft', tooldescription: 'Save a local draft.', toolautosubmit: true });
    expect(createWebMcpFieldAttributes('  Draft title  ')).toEqual({ toolparamdescription: 'Draft title' });
    expect(() => createWebMcpFormAttributes({ name: 'bad name', description: 'Description' })).toThrow('names must');
    expect(() => createWebMcpFormAttributes({ name: 'valid', description: ' ' })).toThrow('non-empty description');
    expect(() => createWebMcpFieldAttributes(' ')).toThrow('cannot be empty');
  });
});

describe('WebMCP imperative lifecycle', () => {
  it('requires a model context for imperative operations', async () => {
    const controller = createWebMcp();
    await expect(controller.refreshTools()).rejects.toThrow('WebMCP is not available');
    await expect(controller.registerTool(simpleTool())).rejects.toThrow('WebMCP is not available');
    await expect(controller.executeTool(registeredTool())).rejects.toThrow('WebMCP is not available');
    expect(controller.refreshSupport().supported).toBe(false);
  });

  it('registers a validated, abort-aware native callback and unregisters it', async () => {
    const context = installContext();
    const execute = vi.fn((input: WebMcpToolInput, { signal }: { signal: AbortSignal }) => ({
      value: input.value,
      aborted: signal.aborted
    }));
    const tool = simpleTool({ execute });
    const controller = createWebMcp();
    const unregister = await controller.registerTool(tool, { exposedTo: ['https://partner.example'] });
    const [nativeTool, options] = context.registerTool.mock.calls[0] as [
      NativeTool,
      { signal: AbortSignal; exposedTo: string[] }
    ];
    expect(nativeTool).toMatchObject({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations
    });
    expect(nativeTool).not.toHaveProperty('validateInput');
    expect(options.exposedTo).toEqual(['https://partner.example']);
    expect(options.signal.aborted).toBe(false);
    expect(nativeTool.execute({ value: 'yes' }, { signal: new AbortController().signal })).toEqual({
      value: 'yes',
      aborted: false
    });
    expect(nativeTool.execute({ value: 'fallback' })).toEqual({ value: 'fallback', aborted: false });
    expect(() => nativeTool.execute({})).toThrow('schema validation');
    const cancelled = new AbortController();
    cancelled.abort('agent cancelled');
    expect(() => nativeTool.execute({ value: 'x' }, { signal: cancelled.signal })).toThrow('agent cancelled');

    expect(controller.state.getSnapshot().registeredTools).toEqual([tool]);
    expect(unregister()).toBe(true);
    expect(options.signal.aborted).toBe(true);
    expect(unregister()).toBe(false);
    expect(controller.unregisterTool('missing')).toBe(false);
  });

  it('validates tool definitions and honors pre-aborted registration', async () => {
    const context = installContext();
    const controller = createWebMcp();
    await expect(controller.registerTool(simpleTool({ name: 'bad name' }))).rejects.toThrow('names must');
    await expect(controller.registerTool(simpleTool({ description: ' ' }))).rejects.toThrow('non-empty description');
    await expect(controller.registerTool(simpleTool({ execute: undefined as never }))).rejects.toThrow(
      'execute function'
    );
    const abort = new AbortController();
    abort.abort();
    const unregister = await controller.registerTool(simpleTool(), { signal: abort.signal });
    expect(context.registerTool).not.toHaveBeenCalled();
    expect(unregister()).toBe(false);
    const unregisterAll = await controller.registerTools([simpleTool()], { signal: abort.signal });
    expect(unregisterAll()).toBeUndefined();
  });

  it('uses external signals and replacement policy safely', async () => {
    const context = installContext();
    const controller = createWebMcp();
    const external = new AbortController();
    await controller.registerTool(simpleTool(), { signal: external.signal });
    external.abort('scope disposed');
    expect(controller.state.getSnapshot().registeredTools).toEqual([]);
    expect((context.registerTool.mock.calls[0]?.[1] as { signal: AbortSignal }).signal.aborted).toBe(true);

    const first = simpleTool({ execute: vi.fn(() => 'first') });
    const second = simpleTool({ execute: vi.fn(() => 'second') });
    await controller.registerTool(first);
    await expect(controller.registerTool(second, { replaceExisting: false })).rejects.toThrow('already registered');
    const firstSignal = (context.registerTool.mock.calls[1]?.[1] as { signal: AbortSignal }).signal;
    await controller.registerTool(second);
    expect(firstSignal.aborted).toBe(true);
    expect(controller.state.getSnapshot().registeredTools).toEqual([second]);
  });

  it('keeps replacement registrations when old single and batch cleanups run', async () => {
    const context = installContext();
    const controller = createWebMcp();
    const oldCleanup = await controller.registerTool(simpleTool());
    const replacement = simpleTool({ description: 'Replacement tool.' });
    await controller.registerTool(replacement);
    expect(oldCleanup()).toBe(false);
    expect(controller.state.getSnapshot().registeredTools).toEqual([replacement]);

    const batchCleanup = await controller.registerTools([simpleTool()]);
    await controller.registerTool(replacement);
    batchCleanup();
    expect(controller.state.getSnapshot().registeredTools).toEqual([replacement]);
    expect((context.registerTool.mock.lastCall?.[1] as { signal: AbortSignal }).signal.aborted).toBe(false);
  });

  it('does not replace existing tools with pre-aborted registrations', async () => {
    const context = installContext();
    const controller = createWebMcp();
    const original = simpleTool();
    await controller.registerTool(original);
    const cancelled = new AbortController();
    cancelled.abort();
    const cleanup = await controller.registerTool(simpleTool(), { signal: cancelled.signal });
    expect(cleanup()).toBe(false);
    expect(controller.state.getSnapshot().registeredTools).toEqual([original]);
    expect(context.registerTool).toHaveBeenCalledOnce();
    expect((context.registerTool.mock.calls[0]?.[1] as { signal: AbortSignal }).signal.aborted).toBe(false);
  });

  it('includes pending registrations in the replacement policy', async () => {
    const context = installContext();
    const pending = deferred<void>();
    context.registerTool.mockReturnValueOnce(pending.promise);
    const controller = createWebMcp();
    const registration = controller.registerTool(simpleTool());
    await expect(controller.registerTool(simpleTool(), { replaceExisting: false })).rejects.toThrow(
      'already registered'
    );
    expect(context.registerTool).toHaveBeenCalledOnce();
    pending.resolve();
    await registration;
  });

  it('removes caller listeners on cleanup and protects replacements from aborted pending failures', async () => {
    const context = installContext();
    const controller = createWebMcp();
    const external = new AbortController();
    const removeListener = vi.spyOn(external.signal, 'removeEventListener');
    const cleanup = await controller.registerTool(simpleTool(), { signal: external.signal });
    cleanup();
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));

    const pending = deferred<void>();
    context.registerTool.mockReturnValueOnce(pending.promise);
    const registration = controller.registerTool(simpleTool(), { signal: external.signal });
    external.abort('registration cancelled');
    const replacement = simpleTool({ description: 'Replacement.' });
    await controller.registerTool(replacement);
    pending.reject(new Error('cancelled registration failed'));
    await expect(registration).rejects.toThrow('cancelled registration failed');
    expect(controller.state.getSnapshot()).toMatchObject({ registeredTools: [replacement], error: null });
  });

  it('stops a pending batch when disposed and ignores its late registration failure', async () => {
    const context = installContext();
    const pending = deferred<void>();
    context.registerTool.mockReturnValueOnce(pending.promise);
    const controller = createWebMcp();
    const batch = controller.registerTools([simpleTool({ name: 'first' }), simpleTool({ name: 'second' })]);
    controller.dispose();
    pending.resolve();
    const cleanup = await batch;
    cleanup();
    expect(context.registerTool).toHaveBeenCalledOnce();
    expect(controller.state.getSnapshot()).toMatchObject({ registeredTools: [], processing: '', error: null });

    const rejected = deferred<void>();
    context.registerTool.mockReturnValueOnce(rejected.promise);
    const registration = controller.registerTool(simpleTool());
    controller.dispose();
    rejected.reject(new Error('late registration failure'));
    await expect(registration).rejects.toThrow('late registration failure');
    expect(controller.state.getSnapshot()).toMatchObject({ registeredTools: [], processing: '', error: null });
  });

  it('infers callback input from a literal JSON schema', async () => {
    const context = installContext();
    const controller = createWebMcp();
    await controller.registerTool({
      name: 'inferred',
      description: 'Infer required and optional input fields.',
      inputSchema: {
        type: 'object',
        properties: { title: { type: 'string' }, count: { type: 'integer' } },
        required: ['title']
      },
      annotations: { consequentialHint: true, debugging: true },
      execute(input, options) {
        expectTypeOf(input.title).toEqualTypeOf<string>();
        expectTypeOf(input.count).toEqualTypeOf<number | undefined>();
        expectTypeOf(options.signal).toEqualTypeOf<AbortSignal>();
        return input.title;
      }
    });
    const nativeTool = context.registerTool.mock.calls[0]?.[0] as NativeTool;
    expect(nativeTool.annotations).toMatchObject({ consequentialHint: true, debugging: true });
    expect(nativeTool.execute({ title: 'Inferred' })).toBe('Inferred');
  });

  it('does not leak superseded or explicitly cancelled pending registrations', async () => {
    const context = installContext();
    const firstPending = deferred<void>();
    const cancelledPending = deferred<void>();
    context.registerTool
      .mockReturnValueOnce(firstPending.promise)
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(cancelledPending.promise);
    const controller = createWebMcp();
    const firstTool = simpleTool({ execute: vi.fn(() => 'first') });
    const secondTool = simpleTool({ execute: vi.fn(() => 'second') });

    const firstRegistration = controller.registerTool(firstTool);
    await flushPromises();
    await controller.registerTool(secondTool);
    firstPending.resolve();
    await firstRegistration;
    expect((context.registerTool.mock.calls[0]?.[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
    expect(controller.state.getSnapshot().registeredTools).toEqual([secondTool]);

    controller.unregisterTool(secondTool.name);
    const pendingRegistration = controller.registerTool(firstTool);
    await flushPromises();
    expect(controller.unregisterTool(firstTool.name)).toBe(true);
    cancelledPending.resolve();
    await pendingRegistration;
    expect(controller.state.getSnapshot().registeredTools).toEqual([]);
  });

  it('rolls back batches and exposes registration failures', async () => {
    const context = installContext();
    context.registerTool.mockImplementation((tool: NativeTool) =>
      tool.name === 'broken_tool' ? Promise.reject(new Error('registration failed')) : Promise.resolve()
    );
    const controller = createWebMcp();
    await expect(
      controller.registerTools([simpleTool({ name: 'working_tool' }), simpleTool({ name: 'broken_tool' })])
    ).rejects.toThrow('registration failed');
    expect(controller.state.getSnapshot().registeredTools).toEqual([]);
    expect((context.registerTool.mock.calls[0]?.[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
    expect(controller.state.getSnapshot().error).toEqual(new Error('registration failed'));
  });

  it('returns a batch disposer for successful registrations', async () => {
    const context = installContext();
    const controller = createWebMcp();
    const unregister = await controller.registerTools([
      simpleTool({ name: 'first_tool' }),
      simpleTool({ name: 'second_tool' })
    ]);
    expect(controller.state.getSnapshot().registeredTools).toHaveLength(2);
    unregister();
    expect(controller.state.getSnapshot().registeredTools).toEqual([]);
    expect((context.registerTool.mock.calls[0]?.[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
    expect((context.registerTool.mock.calls[1]?.[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
  });

  it('discovers tools, reacts to toolchange, and keeps the latest request', async () => {
    const context = installContext();
    const first = deferred<WebMcpRegisteredTool[]>();
    const staleTool = registeredTool({ name: 'stale' });
    const latestTool = registeredTool({ name: 'latest' });
    context.getTools.mockReturnValueOnce(first.promise).mockResolvedValueOnce([latestTool]);
    const controller = createWebMcp();
    const staleRequest = controller.refreshTools({ fromOrigins: ['https://old.example'] });
    await controller.refreshTools({ fromOrigins: ['https://new.example'] });
    first.resolve([staleTool]);
    await staleRequest;
    expect(context.getTools).toHaveBeenNthCalledWith(1, { fromOrigins: ['https://old.example'] });
    expect(controller.state.getSnapshot().discoveredTools).toEqual([latestTool]);

    context.getTools.mockResolvedValueOnce([staleTool]);
    context.dispatchEvent(new Event('toolchange'));
    await flushPromises();
    await flushPromises();
    expect(controller.state.getSnapshot().discoveredTools).toEqual([staleTool]);
    expect(context.getTools).toHaveBeenLastCalledWith({ fromOrigins: ['https://new.example'] });

    context.getTools.mockRejectedValueOnce(new Error('discovery failed'));
    await expect(controller.refreshTools()).rejects.toThrow('discovery failed');
    expect(controller.state.getSnapshot().error).toEqual(new Error('discovery failed'));
  });

  it('observes lazily and can resume observation after disposal', async () => {
    const context = installContext();
    const add = vi.spyOn(context, 'addEventListener');
    const controller = createWebMcp();
    expect(add).not.toHaveBeenCalled();
    context.dispatchEvent(new Event('toolchange'));
    expect(context.getTools).not.toHaveBeenCalled();

    await controller.refreshTools();
    expect(add).toHaveBeenCalledOnce();
    controller.dispose();
    await controller.refreshTools({ fromOrigins: ['https://partner.example'] });
    expect(add).toHaveBeenCalledTimes(2);
    context.dispatchEvent(new Event('toolchange'));
    await flushPromises();
    expect(context.getTools).toHaveBeenCalledTimes(3);
    expect(context.getTools).toHaveBeenLastCalledWith({ fromOrigins: ['https://partner.example'] });
  });

  it('ignores stale discovery failures and handles background refresh errors', async () => {
    const context = installContext();
    const pending = deferred<WebMcpRegisteredTool[]>();
    context.getTools.mockReturnValueOnce(pending.promise);
    const controller = createWebMcp();
    const stale = controller.refreshTools();
    await controller.refreshTools();
    pending.reject(new Error('stale discovery failed'));
    await expect(stale).rejects.toThrow('stale discovery failed');
    expect(controller.state.getSnapshot().error).toBeNull();

    context.getTools.mockRejectedValueOnce(new Error('background discovery failed'));
    context.dispatchEvent(new Event('toolchange'));
    await flushPromises();
    await flushPromises();
    expect(controller.state.getSnapshot()).toMatchObject({
      error: new Error('background discovery failed'),
      processing: ''
    });
  });

  it('preserves execution state and result when execution triggers toolchange', async () => {
    const context = installContext();
    const pending = deferred<string>();
    const controller = createWebMcp();
    await controller.refreshTools({ fromOrigins: ['https://partner.example'] });
    context.executeTool.mockImplementationOnce(() => {
      context.dispatchEvent(new Event('toolchange'));
      return pending.promise;
    });

    const execution = controller.executeTool(registeredTool());
    await flushPromises();
    expect(controller.state.getSnapshot().processing).toBe('executing');
    expect(context.getTools).toHaveBeenLastCalledWith({ fromOrigins: ['https://partner.example'] });
    pending.resolve('native string result');
    await expect(execution).resolves.toBe('native string result');
    expect(controller.state.getSnapshot()).toMatchObject({ processing: '', lastResult: 'native string result' });
  });

  it('keeps concurrent registration and discovery processing visible after execution ends', async () => {
    const context = installContext();
    const discovery = deferred<WebMcpRegisteredTool[]>();
    const registration = deferred<void>();
    const execution = deferred<string>();
    context.getTools.mockReturnValueOnce(discovery.promise);
    context.registerTool.mockReturnValueOnce(registration.promise);
    context.executeTool.mockReturnValueOnce(execution.promise);
    const controller = createWebMcp();
    const discover = controller.refreshTools();
    const register = controller.registerTool(simpleTool());
    const execute = controller.executeTool(registeredTool());
    expect(controller.state.getSnapshot().processing).toBe('executing');
    execution.resolve('done');
    await execute;
    expect(controller.state.getSnapshot().processing).toBe('registering');
    registration.resolve();
    await register;
    expect(controller.state.getSnapshot().processing).toBe('discovering');
    discovery.resolve([]);
    await discover;
    expect(controller.state.getSnapshot().processing).toBe('');
  });

  it('does not publish failures from superseded pending registrations', async () => {
    const context = installContext();
    const pending = deferred<void>();
    context.registerTool.mockReturnValueOnce(pending.promise);
    const controller = createWebMcp();
    const first = controller.registerTool(simpleTool());
    const replacement = simpleTool({ description: 'Replacement.' });
    await controller.registerTool(replacement);
    pending.reject(new Error('obsolete failure'));
    await expect(first).rejects.toThrow('obsolete failure');
    expect(controller.state.getSnapshot()).toMatchObject({
      registeredTools: [replacement],
      error: null,
      processing: ''
    });
  });

  it('executes discovered tools from object or string input with local validation', async () => {
    const context = installContext();
    const tool = registeredTool({
      inputSchema: JSON.stringify({
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
        additionalProperties: false
      })
    });
    const controller = createWebMcp();
    const signal = new AbortController().signal;
    await expect(controller.executeTool(tool, { value: 'object' }, { signal })).resolves.toBe('{"ok":true}');
    const nativeTool = { ...tool, inputSchema: JSON.parse(tool.inputSchema as string) };
    expect(context.executeTool).toHaveBeenCalledWith(
      nativeTool,
      { value: 'object' },
      { signal: expect.any(AbortSignal) }
    );
    await controller.executeTool(tool, '{"value":"string"}');
    expect(context.executeTool).toHaveBeenLastCalledWith(
      nativeTool,
      { value: 'string' },
      { signal: expect.any(AbortSignal) }
    );
    expect(controller.state.getSnapshot()).toMatchObject({ lastResult: '{"ok":true}', processing: '' });
    await expect(controller.executeTool(tool, {})).rejects.toThrow('schema validation');
    await expect(controller.executeTool(tool, '{')).rejects.toThrow(SyntaxError);
    context.executeTool.mockRejectedValueOnce(new Error('execution failed'));
    await expect(controller.executeTool(tool, { value: 'x' })).rejects.toThrow('execution failed');
    expect(controller.state.getSnapshot().error).toEqual(new Error('execution failed'));
  });

  it.each(['null', '[]', '"text"', '1'])('rejects non-object JSON tool input: %s', async (input) => {
    const context = installContext();
    await expect(createWebMcp().executeTool(registeredTool(), input)).rejects.toThrow('input must be a JSON object');
    expect(context.executeTool).not.toHaveBeenCalled();
  });

  it.each([undefined, 'json'] as const)('serializes legacy input once with mode %s', async (inputFormat) => {
    const context = installContext();
    if (!inputFormat) Object.defineProperty(context.executeTool, 'length', { value: 2 });
    const tool = registeredTool({ inputSchema: '{"type":"object"}' });
    const controller = createWebMcp();
    await controller.executeTool(tool, '{"value":"text"}', { inputFormat });
    expect(context.executeTool).toHaveBeenCalledExactlyOnceWith(tool, '{"value":"text"}', {
      signal: expect.any(AbortSignal)
    });
  });

  it('allows object input for wrappers with a legacy-looking signature', async () => {
    const context = installContext();
    Object.defineProperty(context.executeTool, 'length', { value: 2 });
    const tool = registeredTool();
    await createWebMcp().executeTool(tool, { value: 'text' }, { inputFormat: 'object' });
    expect(context.executeTool).toHaveBeenCalledExactlyOnceWith(
      tool,
      { value: 'text' },
      {
        signal: expect.any(AbortSignal)
      }
    );
  });

  it('never retries failed native execution', async () => {
    const context = installContext();
    const error = new Error('Failed to parse input arguments');
    context.executeTool.mockRejectedValueOnce(error);
    const controller = createWebMcp();
    await expect(controller.executeTool(registeredTool(), {})).rejects.toBe(error);
    expect(context.executeTool).toHaveBeenCalledOnce();
    expect(controller.state.getSnapshot()).toMatchObject({ error, processing: '', lastResult: null });
  });

  it.each(['resolve', 'reject'] as const)(
    'aborts owned executions on dispose and suppresses late %s',
    async (settlement) => {
      const context = installContext();
      const pending = deferred<string>();
      context.executeTool.mockReturnValueOnce(pending.promise);
      const controller = createWebMcp();
      const external = new AbortController();
      const execution = controller.executeTool(registeredTool(), {}, { signal: external.signal });
      const signal = (context.executeTool.mock.calls[0]?.[2] as { signal: AbortSignal }).signal;
      expect(signal).not.toBe(external.signal);
      controller.dispose();
      expect(signal.aborted).toBe(true);
      expect(external.signal.aborted).toBe(false);
      if (settlement === 'resolve') pending.resolve('late result');
      else pending.reject(new Error('late error'));
      await expect(execution).rejects.toBeDefined();
      expect(controller.state.getSnapshot()).toMatchObject({ lastResult: null, error: null, processing: '' });
    }
  );

  it('forwards caller cancellation and skips native execution for pre-aborted signals', async () => {
    const context = installContext();
    const pending = deferred<string>();
    context.executeTool.mockReturnValueOnce(pending.promise);
    const controller = createWebMcp();
    const external = new AbortController();
    const execution = controller.executeTool(registeredTool(), {}, { signal: external.signal });
    const signal = (context.executeTool.mock.calls[0]?.[2] as { signal: AbortSignal }).signal;
    external.abort('caller cancelled');
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe('caller cancelled');
    pending.resolve('ignored native response');
    await expect(execution).rejects.toBe('caller cancelled');
    expect(controller.state.getSnapshot().lastResult).toBeNull();
    await expect(controller.executeTool(registeredTool(), {}, { signal: external.signal })).rejects.toBe(
      'caller cancelled'
    );
    expect(context.executeTool).toHaveBeenCalledOnce();
  });

  it('does not let stale execution results or errors replace the latest state', async () => {
    const context = installContext();
    const staleResult = deferred<unknown>();
    const staleError = deferred<unknown>();
    context.executeTool
      .mockReturnValueOnce(staleResult.promise)
      .mockResolvedValueOnce('latest result')
      .mockReturnValueOnce(staleError.promise)
      .mockResolvedValueOnce('latest again');
    const controller = createWebMcp();
    const tool = registeredTool({ inputSchema: undefined });
    const first = controller.executeTool(tool);
    await flushPromises();
    await controller.executeTool(tool);
    staleResult.resolve('stale result');
    await first;
    expect(controller.state.getSnapshot().lastResult).toBe('latest result');

    const failing = controller.executeTool(tool);
    await flushPromises();
    await controller.executeTool(tool);
    staleError.reject(new Error('stale execution failure'));
    await expect(failing).rejects.toThrow('stale execution failure');
    expect(controller.state.getSnapshot()).toMatchObject({ lastResult: 'latest again', error: null, processing: '' });
  });

  it('disposes owned registrations, observers, and transient state', async () => {
    const context = installContext();
    context.getTools.mockResolvedValue([registeredTool()]);
    const controller = createWebMcp();
    await controller.registerTool(simpleTool());
    await controller.refreshTools();
    await controller.executeTool(registeredTool());
    const signal = (context.registerTool.mock.calls[0]?.[1] as { signal: AbortSignal }).signal;
    controller.dispose();
    expect(signal.aborted).toBe(true);
    expect(controller.state.getSnapshot()).toMatchObject({
      processing: '',
      registeredTools: [],
      discoveredTools: [],
      lastResult: null
    });
    context.getTools.mockClear();
    context.dispatchEvent(new Event('toolchange'));
    await flushPromises();
    expect(context.getTools).not.toHaveBeenCalled();
  });
});
