import { createBrowserAiStore } from './store.js';
import { assertJsonSchema } from './schema.js';

export type WebMcpToolInput = Record<string, unknown>;
export type WebMcpInputSchema = object | string;

export type WebMcpToolExecuteOptions = WebMCP.ToolExecuteCallbackOptions;
export type WebMcpToolAnnotations = WebMCP.ToolAnnotations;

export interface WebMcpTool<Input extends WebMcpToolInput = WebMcpToolInput> {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: WebMcpToolAnnotations;
  validateInput?(input: unknown): input is Input;
  execute(input: Input, options: WebMcpToolExecuteOptions): unknown | Promise<unknown>;
}

export interface WebMcpRegisteredTool {
  name: string;
  title: string;
  description: string;
  inputSchema?: WebMcpInputSchema;
  window: Window;
  origin: string;
  annotations?: WebMcpToolAnnotations;
}

export interface WebMcpRegisterOptions extends WebMCP.ModelContextRegisterToolOptions {
  replaceExisting?: boolean;
}

export type WebMcpGetToolsOptions = WebMCP.ModelContextGetToolOptions;
export interface WebMcpExecuteOptions extends WebMCP.ModelContextExecuteToolOptions {
  /** Override native signature detection for a wrapped or polyfilled implementation. */
  inputFormat?: 'object' | 'json';
}

export interface WebMcpSupportState {
  supported: boolean;
  secureContext: boolean | null;
  originIsolated: boolean | null;
  permissionAllowed: boolean | null;
  reason: 'supported' | 'server' | 'insecure-context' | 'origin-not-isolated' | 'permission-disabled' | 'unsupported';
}

export interface WebMcpState {
  support: WebMcpSupportState;
  processing: 'registering' | 'discovering' | 'executing' | '';
  discoveredTools: WebMcpRegisteredTool[];
  registeredTools: WebMcpTool[];
  lastResult: unknown | null;
  error: unknown;
}

export interface WebMcpFormDefinition {
  name: string;
  description: string;
  autoSubmit?: boolean;
}

interface NativeWebMcpTool extends Omit<WebMcpTool, 'execute' | 'validateInput'> {
  execute(input: WebMcpToolInput, options: WebMcpToolExecuteOptions): unknown | Promise<unknown>;
}

interface Registration {
  tool: WebMcpTool;
  controller: AbortController;
  externalSignal?: AbortSignal;
  externalAbort?: () => void;
}

type DocumentPolicy = Document & {
  permissionsPolicy?: { allowsFeature(feature: string): boolean };
  featurePolicy?: { allowsFeature(feature: string): boolean };
};

const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

const getModelContext = () => {
  if (typeof document === 'undefined') return null;
  return document.modelContext ?? null;
};

const getPermissionAllowed = () => {
  if (typeof document === 'undefined') return null;
  const policyDocument = document as DocumentPolicy;
  const policy = policyDocument.permissionsPolicy ?? policyDocument.featurePolicy;
  if (!policy?.allowsFeature) return null;
  try {
    return policy.allowsFeature('tools');
  } catch {
    return null;
  }
};

export const getWebMcpSupport = (): WebMcpSupportState => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      supported: false,
      secureContext: null,
      originIsolated: null,
      permissionAllowed: null,
      reason: 'server'
    };
  }

  const secureContext = window.isSecureContext;
  const originIsolated = typeof window.originAgentCluster === 'boolean' ? window.originAgentCluster : null;
  const permissionAllowed = getPermissionAllowed();
  const supported = getModelContext() !== null;
  const reason = supported
    ? 'supported'
    : !secureContext
      ? 'insecure-context'
      : originIsolated === false
        ? 'origin-not-isolated'
        : permissionAllowed === false
          ? 'permission-disabled'
          : 'unsupported';

  return { supported, secureContext, originIsolated, permissionAllowed, reason };
};

export const parseWebMcpInputSchema = (schema: WebMcpInputSchema | undefined): object | undefined => {
  if (!schema) return undefined;
  if (typeof schema !== 'string') {
    if (Array.isArray(schema)) throw new TypeError('WebMCP input schema must be a JSON object.');
    return schema;
  }
  const parsed = JSON.parse(schema) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('WebMCP input schema must decode to a JSON object.');
  }
  return parsed;
};

export const validateWebMcpInput = <Input extends WebMcpToolInput>(tool: WebMcpTool<Input>, input: unknown): Input => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`WebMCP tool "${tool.name}" input must be a JSON object.`);
  }
  if (tool.inputSchema) assertJsonSchema(input, tool.inputSchema, `WebMCP tool "${tool.name}" input`);
  if (tool.validateInput && !tool.validateInput(input)) {
    throw new TypeError(`WebMCP tool "${tool.name}" input failed custom validation.`);
  }
  return input as Input;
};

const validateNameAndDescription = (name: string, description: string, subject: string) => {
  if (!TOOL_NAME_PATTERN.test(name)) {
    throw new TypeError(`${subject} names must be 1-128 ASCII letters, numbers, "_", "-", or ".".`);
  }
  if (!description.trim()) throw new TypeError(`${subject} require a non-empty description.`);
};

export const createWebMcpFormAttributes = (definition: WebMcpFormDefinition) => {
  validateNameAndDescription(definition.name, definition.description, 'WebMCP form tool');
  return {
    toolname: definition.name,
    tooldescription: definition.description,
    ...(definition.autoSubmit ? { toolautosubmit: true } : {})
  };
};

export const createWebMcpFieldAttributes = (description: string) => {
  const normalized = description.trim();
  if (!normalized) throw new TypeError('WebMCP field descriptions cannot be empty.');
  return { toolparamdescription: normalized };
};

export const createWebMcp = () => {
  const state = createBrowserAiStore<WebMcpState>({
    support: getWebMcpSupport(),
    processing: '',
    discoveredTools: [],
    registeredTools: [],
    lastResult: null,
    error: null
  });
  const registrations = new Map<string, Registration>();
  const pendingRegistrations = new Map<string, Registration>();
  const pendingOperations = new Map<number, Exclude<WebMcpState['processing'], ''>>();
  const executions = new Set<AbortController>();
  let observedContext: WebMCP.ModelContext | null = null;
  let operationVersion = 0;
  let discoveryVersion = 0;
  let executionVersion = 0;
  let registrationVersion = 0;
  let discoveryOptions: WebMcpGetToolsOptions = {};

  const syncProcessing = () => {
    let processing: WebMcpState['processing'] = '';
    for (const pending of pendingOperations.values()) {
      if (pending === 'executing') {
        processing = pending;
        break;
      }
      if (!processing || pending === 'registering') processing = pending;
    }
    state.update({ processing });
  };
  const beginProcessing = (processing: Exclude<WebMcpState['processing'], ''>) => {
    const version = ++operationVersion;
    pendingOperations.set(version, processing);
    state.update({ error: null });
    syncProcessing();
    return version;
  };
  const endProcessing = (version: number) => {
    if (pendingOperations.delete(version)) syncProcessing();
  };

  const requireContext = () => {
    const context = getModelContext();
    if (!context) throw new Error(`WebMCP is not available in this document (${getWebMcpSupport().reason}).`);
    return context;
  };
  const syncRegistrations = () =>
    state.update({ registeredTools: Array.from(registrations.values(), ({ tool }) => tool) });
  const refreshSupport = () => {
    const support = getWebMcpSupport();
    state.update({ support });
    return support;
  };
  const refreshTools = async (options: WebMcpGetToolsOptions = {}) => {
    const context = requireContext();
    observe();
    discoveryOptions = options;
    const request = ++discoveryVersion;
    const version = beginProcessing('discovering');
    try {
      if (typeof context.getTools !== 'function') {
        throw new Error('WebMCP tool discovery is not available in this document.');
      }
      const discoveredTools = await context.getTools(options);
      if (request === discoveryVersion) state.update({ discoveredTools });
      return discoveredTools;
    } catch (error) {
      if (request === discoveryVersion) state.update({ error });
      throw error;
    } finally {
      endProcessing(version);
    }
  };
  const handleToolChange = () => void refreshTools(discoveryOptions).catch(() => undefined);
  const observe = () => {
    const context = getModelContext();
    if (context === observedContext) return;
    if (typeof observedContext?.removeEventListener === 'function') {
      observedContext.removeEventListener('toolchange', handleToolChange);
    }
    observedContext = null;
    if (typeof context?.addEventListener === 'function' && typeof context.removeEventListener === 'function') {
      observedContext = context;
      context.addEventListener('toolchange', handleToolChange);
    }
  };
  const unregisterTool = (name: string) => {
    const pending = pendingRegistrations.get(name);
    const registration = registrations.get(name);
    if (!pending && !registration) return false;
    for (const item of [pending, registration]) {
      if (!item) continue;
      if (item.externalSignal && item.externalAbort) {
        item.externalSignal.removeEventListener('abort', item.externalAbort);
      }
      item.controller.abort();
    }
    pendingRegistrations.delete(name);
    registrations.delete(name);
    syncRegistrations();
    return true;
  };
  const registerTool: {
    <const Schema extends object>(
      tool: WebMCP.ModelContextToolFromSchema<Schema>,
      options?: WebMcpRegisterOptions
    ): Promise<() => boolean>;
    <Input extends WebMcpToolInput>(tool: WebMcpTool<Input>, options?: WebMcpRegisterOptions): Promise<() => boolean>;
  } = async <Input extends WebMcpToolInput>(tool: WebMcpTool<Input>, options: WebMcpRegisterOptions = {}) => {
    validateNameAndDescription(tool.name, tool.description, 'WebMCP tool');
    if (typeof tool.execute !== 'function') throw new TypeError('WebMCP tools require an execute function.');
    const context = requireContext();
    if (options.signal?.aborted) return () => false;
    if ((registrations.has(tool.name) || pendingRegistrations.has(tool.name)) && options.replaceExisting === false) {
      throw new Error(`A WebMCP tool named "${tool.name}" is already registered.`);
    }
    unregisterTool(tool.name);

    const controller = new AbortController();
    const externalAbort = options.signal
      ? () => {
          controller.abort(options.signal?.reason);
          if (pendingRegistrations.get(tool.name)?.controller === controller) pendingRegistrations.delete(tool.name);
          if (registrations.get(tool.name)?.controller === controller) {
            registrations.delete(tool.name);
            syncRegistrations();
          }
        }
      : undefined;
    const registration: Registration = {
      tool: tool as WebMcpTool,
      controller,
      externalSignal: options.signal,
      externalAbort
    };
    pendingRegistrations.set(tool.name, registration);
    if (externalAbort) options.signal?.addEventListener('abort', externalAbort, { once: true });

    const { validateInput: _validateInput, execute, ...definition } = tool;
    const nativeTool: NativeWebMcpTool = {
      ...definition,
      execute: (input, callbackOptions) => {
        const signal = callbackOptions?.signal ?? new AbortController().signal;
        if (signal.aborted) throw signal.reason;
        return execute(validateWebMcpInput(tool, input), { signal });
      }
    };

    const version = beginProcessing('registering');
    try {
      const { replaceExisting: _replaceExisting, ...nativeOptions } = options;
      await Promise.resolve(
        context.registerTool(nativeTool, {
          ...nativeOptions,
          signal: controller.signal
        })
      );
      if (pendingRegistrations.get(tool.name)?.controller !== controller || controller.signal.aborted) {
        return () => false;
      }
      pendingRegistrations.delete(tool.name);
      registrations.set(tool.name, registration);
      syncRegistrations();
      observe();
      return () => registrations.get(tool.name) === registration && unregisterTool(tool.name);
    } catch (error) {
      const current = pendingRegistrations.get(tool.name) === registration;
      if (current) pendingRegistrations.delete(tool.name);
      if (options.signal && externalAbort) options.signal.removeEventListener('abort', externalAbort);
      controller.abort();
      if (current && pendingOperations.has(version)) state.update({ error });
      throw error;
    } finally {
      endProcessing(version);
    }
  };
  const registerTools = async (tools: WebMcpTool[], options: WebMcpRegisterOptions = {}) => {
    if (options.signal?.aborted) return () => undefined;
    const version = registrationVersion;
    const cleanups: Array<() => boolean> = [];
    try {
      for (const tool of tools) {
        if (version !== registrationVersion || options.signal?.aborted) break;
        cleanups.push(await registerTool(tool, options));
      }
      return () => cleanups.forEach((cleanup) => cleanup());
    } catch (error) {
      cleanups.forEach((cleanup) => cleanup());
      throw error;
    }
  };
  const unregisterAll = () => {
    registrationVersion += 1;
    const names = new Set([...registrations.keys(), ...pendingRegistrations.keys()]);
    names.forEach(unregisterTool);
  };
  const executeTool = async (
    tool: WebMcpRegisteredTool,
    input: WebMcpToolInput | string = {},
    options: WebMcpExecuteOptions = {}
  ) => {
    const context = requireContext();
    const request = ++executionVersion;
    const controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
    executions.add(controller);
    const version = beginProcessing('executing');
    try {
      signal.throwIfAborted();
      if (typeof context.executeTool !== 'function') {
        throw new Error('WebMCP tool execution is not available in this document.');
      }
      const schema = parseWebMcpInputSchema(tool.inputSchema);
      const parsedInput = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
      if (!parsedInput || typeof parsedInput !== 'object' || Array.isArray(parsedInput)) {
        throw new TypeError(`WebMCP tool "${tool.name}" input must be a JSON object.`);
      }
      if (schema) assertJsonSchema(parsedInput, schema, `WebMCP tool "${tool.name}" input`);
      const { inputFormat, ...nativeOptions } = options;
      // Chromium's earlier IDL requires a JSON string (arity 2). The current
      // optional object argument has arity 1. Select before calling; never retry
      // a tool that may already have changed application state.
      const jsonInput = inputFormat ? inputFormat === 'json' : context.executeTool.length >= 2;
      const nativeTool = jsonInput ? tool : { ...tool, inputSchema: schema };
      const execute = context.executeTool as (
        tool: WebMcpRegisteredTool,
        input: object | string,
        options: WebMCP.ModelContextExecuteToolOptions
      ) => Promise<string | null>;
      const lastResult = await execute.call(
        context,
        nativeTool,
        jsonInput ? JSON.stringify(parsedInput) : parsedInput,
        { ...nativeOptions, signal }
      );
      signal.throwIfAborted();
      if (request === executionVersion) state.update({ lastResult });
      return lastResult;
    } catch (error) {
      if (request === executionVersion) state.update({ error });
      throw error;
    } finally {
      executions.delete(controller);
      endProcessing(version);
    }
  };
  const dispose = () => {
    discoveryVersion += 1;
    executionVersion += 1;
    if (typeof observedContext?.removeEventListener === 'function') {
      observedContext.removeEventListener('toolchange', handleToolChange);
    }
    observedContext = null;
    unregisterAll();
    executions.forEach((controller) => controller.abort());
    executions.clear();
    pendingOperations.clear();
    state.update({ processing: '', discoveredTools: [], lastResult: null, error: null });
  };

  return {
    state,
    refreshSupport,
    refreshTools,
    registerTool,
    registerTools,
    unregisterTool,
    unregisterAll,
    executeTool,
    dispose
  };
};
