import { computed, getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue';

export type WebMcpProcessingState = 'registering' | 'discovering' | 'executing' | '';
export type WebMcpToolInput = Record<string, unknown>;

export interface WebMcpToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface WebMcpTool<TInput extends WebMcpToolInput = WebMcpToolInput> {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMcpToolAnnotations;
  execute: (input: TInput) => unknown | Promise<unknown>;
}

export interface WebMcpRegisterToolOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
  /** Replace a tool previously registered through this composable. */
  replaceExisting?: boolean;
}

export interface WebMcpGetToolsOptions {
  fromOrigins?: string[];
}

export interface WebMcpExecuteToolOptions {
  signal?: AbortSignal;
}

export interface WebMcpDiscoveredTool {
  annotations?: WebMcpToolAnnotations;
  description: string;
  inputSchema?: string;
  name: string;
  origin: string;
  title?: string;
  window: Window;
}

export interface WebMcpSupportState {
  supported: boolean;
  secureContext: boolean | null;
  originIsolated: boolean | null;
  permissionAllowed: boolean | null;
  reason: 'supported' | 'server' | 'insecure-context' | 'origin-not-isolated' | 'permission-disabled' | 'unsupported';
}

export interface WebMcpFormDefinition {
  name: string;
  description: string;
  autoSubmit?: boolean;
}

type ModelContextWithClientMethods = WebMCP.ModelContext & {
  getTools?: (options?: WebMcpGetToolsOptions) => Promise<WebMcpDiscoveredTool[]>;
  executeTool?: (
    tool: WebMcpDiscoveredTool,
    input: string,
    options?: WebMcpExecuteToolOptions
  ) => Promise<unknown | null>;
};

type DocumentWithToolPolicy = Document & {
  permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
  featurePolicy?: { allowsFeature: (feature: string) => boolean };
};

interface RegistrationRecord {
  tool: WebMcpTool;
  controller: AbortController;
  externalSignal?: AbortSignal;
  externalAbortListener?: () => void;
}

const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

const getModelContext = (): ModelContextWithClientMethods | null => {
  if (typeof document === 'undefined') return null;
  return (document.modelContext as ModelContextWithClientMethods | undefined) ?? null;
};

const getPermissionAllowed = () => {
  if (typeof document === 'undefined') return null;
  const policyDocument = document as DocumentWithToolPolicy;
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

  if (supported) {
    return {
      supported,
      secureContext,
      originIsolated,
      permissionAllowed,
      reason: 'supported'
    };
  }
  if (!secureContext) {
    return {
      supported,
      secureContext,
      originIsolated,
      permissionAllowed,
      reason: 'insecure-context'
    };
  }
  if (originIsolated === false) {
    return {
      supported,
      secureContext,
      originIsolated,
      permissionAllowed,
      reason: 'origin-not-isolated'
    };
  }
  if (permissionAllowed === false) {
    return {
      supported,
      secureContext,
      originIsolated,
      permissionAllowed,
      reason: 'permission-disabled'
    };
  }
  return {
    supported,
    secureContext,
    originIsolated,
    permissionAllowed,
    reason: 'unsupported'
  };
};

const validateTool = (tool: WebMcpTool) => {
  if (!TOOL_NAME_PATTERN.test(tool.name)) {
    throw new TypeError('WebMCP tool names must be 1-128 ASCII letters, numbers, "_", "-", or ".".');
  }
  if (!tool.description.trim()) {
    throw new TypeError('WebMCP tools require a non-empty description.');
  }
  if (typeof tool.execute !== 'function') {
    throw new TypeError('WebMCP tools require an execute function.');
  }
};

const getRequiredModelContext = () => {
  const modelContext = getModelContext();
  if (!modelContext) {
    const support = getWebMcpSupport();
    throw new Error(`WebMCP is not available in this document (${support.reason}).`);
  }
  return modelContext;
};

export const createWebMcpFormAttributes = (definition: WebMcpFormDefinition) => {
  if (!TOOL_NAME_PATTERN.test(definition.name)) {
    throw new TypeError('WebMCP form tool names must be 1-128 ASCII letters, numbers, "_", "-", or ".".');
  }
  if (!definition.description.trim()) {
    throw new TypeError('WebMCP forms require a non-empty description.');
  }

  return {
    toolname: definition.name,
    tooldescription: definition.description,
    ...(definition.autoSubmit ? { toolautosubmit: true } : {})
  };
};

export const createWebMcpFieldAttributes = (description: string) => {
  const normalized = description.trim();
  if (!normalized) {
    throw new TypeError('WebMCP field descriptions cannot be empty.');
  }
  return { toolparamdescription: normalized };
};

export function useWebMcp() {
  const support = ref<WebMcpSupportState>(getWebMcpSupport());
  const processing = ref<WebMcpProcessingState>('');
  const discoveredTools = shallowRef<WebMcpDiscoveredTool[]>([]);
  const registeredTools = shallowRef<WebMcpTool[]>([]);
  const error = shallowRef<unknown>(null);
  const lastResult = shallowRef<unknown | null>(null);
  const registrations = new Map<string, RegistrationRecord>();

  let observedContext: ModelContextWithClientMethods | null = null;

  const syncRegisteredTools = () => {
    registeredTools.value = Array.from(registrations.values(), ({ tool }) => tool);
  };

  const refreshSupport = () => {
    support.value = getWebMcpSupport();
    return support.value;
  };

  const refreshTools = async (options: WebMcpGetToolsOptions = {}) => {
    const modelContext = getRequiredModelContext();
    if (typeof modelContext.getTools !== 'function') {
      discoveredTools.value = [];
      return discoveredTools.value;
    }

    processing.value = 'discovering';
    error.value = null;
    try {
      discoveredTools.value = await modelContext.getTools(options);
      return discoveredTools.value;
    } catch (caughtError) {
      error.value = caughtError;
      throw caughtError;
    } finally {
      processing.value = '';
    }
  };

  const handleToolChange = () => {
    void refreshTools().catch(() => undefined);
  };

  const observeToolChanges = () => {
    const modelContext = getModelContext();
    if (modelContext === observedContext) return;

    observedContext?.removeEventListener('toolchange', handleToolChange);
    observedContext = modelContext;
    observedContext?.addEventListener('toolchange', handleToolChange);
  };

  const unregisterTool = (name: string) => {
    const registration = registrations.get(name);
    if (!registration) return false;

    if (registration.externalSignal && registration.externalAbortListener) {
      registration.externalSignal.removeEventListener('abort', registration.externalAbortListener);
    }
    registration.controller.abort();
    registrations.delete(name);
    syncRegisteredTools();
    return true;
  };

  const registerTool = async <TInput extends WebMcpToolInput>(
    tool: WebMcpTool<TInput>,
    options: WebMcpRegisterToolOptions = {}
  ) => {
    validateTool(tool as WebMcpTool);
    const modelContext = getRequiredModelContext();
    const existing = registrations.get(tool.name);
    if (existing && options.replaceExisting === false) {
      throw new Error(`A WebMCP tool named "${tool.name}" is already registered.`);
    }
    if (existing) unregisterTool(tool.name);

    const controller = new AbortController();
    const externalAbortListener = options.signal
      ? () => {
          controller.abort(options.signal?.reason);
          const currentRegistration = registrations.get(tool.name);
          if (currentRegistration?.controller === controller) {
            registrations.delete(tool.name);
            syncRegisteredTools();
          }
        }
      : undefined;
    if (options.signal?.aborted) {
      controller.abort(options.signal.reason);
    } else if (externalAbortListener) {
      options.signal?.addEventListener('abort', externalAbortListener, {
        once: true
      });
    }

    processing.value = 'registering';
    error.value = null;
    try {
      await modelContext.registerTool(tool as unknown as WebMCP.ModelContextTool, {
        signal: controller.signal,
        exposedTo: options.exposedTo
      });
      registrations.set(tool.name, {
        tool: tool as WebMcpTool,
        controller,
        externalSignal: options.signal,
        externalAbortListener
      });
      syncRegisteredTools();
      observeToolChanges();
      return () => unregisterTool(tool.name);
    } catch (caughtError) {
      if (options.signal && externalAbortListener) {
        options.signal.removeEventListener('abort', externalAbortListener);
      }
      controller.abort();
      error.value = caughtError;
      throw caughtError;
    } finally {
      processing.value = '';
    }
  };

  const registerTools = async (tools: WebMcpTool[], options: WebMcpRegisterToolOptions = {}) => {
    const registeredNames: string[] = [];
    try {
      for (const tool of tools) {
        await registerTool(tool, options);
        registeredNames.push(tool.name);
      }
      return () => registeredNames.forEach(unregisterTool);
    } catch (caughtError) {
      registeredNames.forEach(unregisterTool);
      throw caughtError;
    }
  };

  const unregisterAll = () => {
    Array.from(registrations.keys()).forEach(unregisterTool);
  };

  const executeTool = async (
    tool: WebMcpDiscoveredTool,
    input: WebMcpToolInput | string = {},
    options: WebMcpExecuteToolOptions = {}
  ) => {
    const modelContext = getRequiredModelContext();
    if (typeof modelContext.executeTool !== 'function') {
      throw new Error('This WebMCP implementation does not expose executeTool().');
    }

    processing.value = 'executing';
    error.value = null;
    try {
      const serializedInput = typeof input === 'string' ? input : JSON.stringify(input);
      lastResult.value = await modelContext.executeTool(tool, serializedInput, options);
      return lastResult.value;
    } catch (caughtError) {
      error.value = caughtError;
      throw caughtError;
    } finally {
      processing.value = '';
    }
  };

  const dispose = () => {
    unregisterAll();
    observedContext?.removeEventListener('toolchange', handleToolChange);
    observedContext = null;
    discoveredTools.value = [];
    processing.value = '';
  };

  observeToolChanges();
  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }

  return {
    modelContext: computed(() => {
      void support.value;
      return getModelContext();
    }),
    support: computed(() => support.value),
    isSupported: computed(() => support.value.supported),
    processing: computed(() => processing.value),
    isProcessing: computed(() => processing.value !== ''),
    discoveredTools: computed(() => discoveredTools.value),
    registeredTools: computed(() => registeredTools.value),
    error: computed(() => error.value),
    lastResult: computed(() => lastResult.value),
    refreshSupport,
    refreshTools,
    registerTool,
    registerTools,
    unregisterTool,
    unregisterAll,
    executeTool,
    dispose
  };
}
