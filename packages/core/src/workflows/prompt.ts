import { createBrowserAiStore } from '../store.js';
import { projectWorkflow } from './state.js';
import { createDownloadMonitor, safeCheckAvailability } from '../platform.js';
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, Extract<keyof T, K>> : never;
export type LLMAvailability = Availability;
export type LLMPromptOptions = Omit<LanguageModelPromptOptions, 'signal'>;
export type LLMProcessingState = 'availability' | 'create' | 'measure' | 'prompt' | '';
export type LLMCreateCoreOptions = LanguageModelCreateCoreOptions;
export type LLMCreateOptions = DistributiveOmit<LanguageModelCreateOptions, 'signal' | 'monitor'>;
export type LLMCloneOptions = Omit<LanguageModelCloneOptions, 'signal'>;
export type LLMSamplingMode = LanguageModelSamplingMode;
export type LLMPrompt = LanguageModelPrompt;
export type LLMContextStrategy = 'recent' | 'summarize';
export type LLMContextSummaryMode = 'cache-first' | 'eager';
export type LLMContextRestorePhase =
  'idle' | 'checking' | 'creating' | 'measuring' | 'summarizing' | 'restoring' | 'ready' | 'error';
export interface LLMContextRestoreState {
  phase: LLMContextRestorePhase;
  loadedMessages: number;
  totalMessages: number;
  summarizedMessages: number;
  includedMessages: number;
  measuredTokens: number | null;
  cachedSummaries?: number;
  createdSummaries?: number;
  summaryChunks?: number;
}
export interface LLMContextMessageMetadata {
  id: string;
  timestamp?: number;
  hash?: string;
}
export interface LLMContextSummaryRecord {
  id: string;
  startIndex: number;
  endIndex: number;
  messageIds: string[];
  hash: string;
  summary: string;
  tokenUsage: number | null;
  level: number;
  createdAt: number;
  updatedAt: number;
}
export interface LLMRestoreSessionOptions {
  modelOptions?: LanguageModelCreateCoreOptions;
  allowDownloadCreate?: boolean;
  autoCreate?: boolean;
  strategy?: LLMContextStrategy;
  summaryMode?: LLMContextSummaryMode;
  budgetRatio?: number;
  summaryChunkBudgetRatio?: number;
  summaryMaxCharacters?: number;
  summaryTimeoutMs?: number;
  summaryBackgroundTimeoutMs?: number;
  messageMetadata?: LLMContextMessageMetadata[];
  summaryCache?: LLMContextSummaryRecord[];
  onSummaryCacheUpdate?: (summaries: LLMContextSummaryRecord[]) => void | Promise<void>;
  onSummaryCacheError?: (error: unknown) => void;
  shouldContinue?: () => boolean;
  onStateChange?: (state: LLMContextRestoreState, event: 'start' | 'progress' | 'complete') => void;
  onInitStart?: () => void;
  onInitComplete?: () => void;
  onCreateStart?: () => void;
  onCreateComplete?: () => void;
}
export interface LLMRestoreSessionResult {
  ready: boolean;
  selectedMessages: Array<LanguageModelSystemMessage | LanguageModelMessage>;
  selectedConversationCount: number;
  totalConversationCount: number;
  summarizedMessages: number;
  partiallyLoaded: boolean;
}
export interface UsePromptApiOptions {
  onContextOverflow?: (event: Event) => void;
}
export interface LLMTemporaryPromptOptions {
  modelOptions?: LanguageModelCreateCoreOptions;
  promptOptions?: LLMPromptOptions;
  timeoutMs?: number;
}
export interface LLMStructuredPromptOptions extends LLMPromptOptions {
  responseConstraint: Record<string, unknown>;
}
type GlobalWithLanguageModel = typeof globalThis & {
  LanguageModel?: typeof LanguageModel;
};
type RestorePrompt = LanguageModelSystemMessage | LanguageModelMessage;
interface PromptFitResult {
  selected: RestorePrompt[];
  selectedConversationCount: number;
  omitted: LanguageModelMessage[];
  summarizedMessages?: number;
  warmSummaryCache?: () => void;
}
type ActiveRestoreOptions = LLMRestoreSessionOptions & { signal: AbortSignal };
interface SummaryCacheState {
  records: LLMContextSummaryRecord[];
  cachedSummaries: number;
  createdSummaries: number;
}
interface SummaryWindow {
  startIndex: number;
  endIndex: number;
  messages: LanguageModelMessage[];
  metadata: LLMContextMessageMetadata[];
  hash: string;
  messageIds: string[];
}
interface CachedSummaryResult {
  text: string;
  warmCache?: () => void;
}
const DEFAULT_CONTEXT_BUDGET_RATIO = 0.88;
const DEFAULT_SUMMARY_CHUNK_BUDGET_RATIO = 0.18;
const DEFAULT_SUMMARY_MAX_CHARACTERS = 0;
const DEFAULT_SUMMARY_TIMEOUT_MS = 15000;
const DEFAULT_BACKGROUND_SUMMARY_TIMEOUT_MS = 60000;
const DEFAULT_SUMMARY_MODE: LLMContextSummaryMode = 'cache-first';
const SUMMARY_CACHE_VERSION = 1;
const MAX_SUMMARY_ROLLUP_ATTEMPTS = 4;
const getLanguageModel = () => {
  return (globalThis as GlobalWithLanguageModel).LanguageModel;
};
const getCreateCoreOptions = (options: LLMCreateOptions = {}): LanguageModelCreateCoreOptions => {
  const commonOptions = {
    expectedInputs: options.expectedInputs,
    expectedOutputs: options.expectedOutputs,
    tools: options.tools
  };
  if (options.samplingMode !== undefined) {
    return {
      ...commonOptions,
      samplingMode: options.samplingMode
    };
  }
  return {
    ...commonOptions,
    topK: options.topK,
    temperature: options.temperature
  };
};
const mergeCreateOptions = (
  baseOptions: LanguageModelCreateCoreOptions,
  createOptions: LLMCreateOptions,
  signal: AbortSignal,
  monitor: CreateMonitorCallback
): LanguageModelCreateOptions => {
  const commonOptions = {
    expectedInputs: createOptions.expectedInputs ?? baseOptions.expectedInputs,
    expectedOutputs: createOptions.expectedOutputs ?? baseOptions.expectedOutputs,
    tools: createOptions.tools ?? baseOptions.tools,
    initialPrompts: createOptions.initialPrompts,
    signal,
    monitor
  };
  const overridesRawSampling = createOptions.topK !== undefined || createOptions.temperature !== undefined;
  const samplingMode = overridesRawSampling ? undefined : (createOptions.samplingMode ?? baseOptions.samplingMode);
  if (samplingMode !== undefined) {
    return {
      ...commonOptions,
      samplingMode
    };
  }
  return {
    ...commonOptions,
    topK: createOptions.topK ?? baseOptions.topK,
    temperature: createOptions.temperature ?? baseOptions.temperature
  };
};
const createEmptyContextRestoreState = (): LLMContextRestoreState => ({
  phase: 'idle',
  loadedMessages: 0,
  totalMessages: 0,
  summarizedMessages: 0,
  includedMessages: 0,
  measuredTokens: null,
  cachedSummaries: 0,
  createdSummaries: 0,
  summaryChunks: 0
});
export function createPromptWorkflow(options: UsePromptApiOptions = {}) {
  const { onContextOverflow } = options;
  let current = {
    session: null as LanguageModel | null,
    processing: '' as LLMProcessingState,
    availability: null as Availability | null,
    defaultParams: null as LanguageModelParams | null,
    params: null as LanguageModelCreateCoreOptions | null,
    downloadProgress: 0,
    temperature: null as number | null,
    topK: null as number | null,
    contextWindow: null as number | null,
    contextUsage: null as number | null,
    contextRestoreState: createEmptyContextRestoreState() as LLMContextRestoreState,
    abortController: null as AbortController | null
  };
  const store = createBrowserAiStore(current);
  const update = (patch: Partial<typeof current>) => {
    current = { ...current, ...patch };
    store.update(() => current);
  };
  const isReady = () => {
    return current.session !== null && current.availability === 'available';
  };
  const isProcessing = () => current.processing !== '';
  const contextWindowAvailable = () => {
    if (current.contextWindow == null || current.contextUsage == null) {
      return null;
    }
    return Math.max(current.contextWindow - current.contextUsage, 0);
  };
  const updateSessionProps = (sessionInstance?: LanguageModel | null) => {
    update({ temperature: sessionInstance?.temperature ?? null });
    update({ topK: sessionInstance?.topK ?? null });
    update({ contextWindow: sessionInstance?.contextWindow ?? null });
    update({ contextUsage: sessionInstance?.contextUsage ?? null });
  };
  const handleContextOverflow = (event: Event) => {
    updateSessionProps(current.session);
    onContextOverflow?.(event);
  };
  let availabilityRequest = 0;
  let paramsRequest = 0;
  const temporaryControllers = new Set<AbortController>();
  const backgroundControllers = new Set<AbortController>();
  const backgroundTimers = new Set<ReturnType<typeof setTimeout>>();
  const waitFor = <T>(pending: PromiseLike<T>, signal: AbortSignal, release?: (value: T) => void): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      Promise.resolve(pending).then(
        (value) => {
          signal.removeEventListener('abort', abort);
          if (signal.aborted) release?.(value);
          else resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', abort);
          reject(signal.aborted ? signal.reason : error);
        }
      );
    });
  };
  const createDetached = async <T extends { destroy(): void }>(
    factory: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal
  ) => {
    signal.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    try {
      const session = await waitFor(factory(controller.signal), signal, (value) => value.destroy());
      if (signal.aborted) {
        session.destroy();
        signal.throwIfAborted();
      }
      return session;
    } finally {
      // The native creation signal owns the session lifetime. Stop forwarding
      // operation cancellation once ownership transfers to this workflow.
      signal.removeEventListener('abort', abort);
    }
  };
  const interruptForeground = () => {
    ++availabilityRequest;
    ++paramsRequest;
    current.abortController?.abort();
  };
  const beginOperation = (processing: LLMProcessingState, preserveBackground = false) => {
    // Normal turns share a conversation with its independent summary sessions.
    // Restoring/replacing the session, or an explicit interrupt, invalidates both.
    if (preserveBackground) interruptForeground();
    else interrupt();
    const controller = new AbortController();
    update({ abortController: controller, processing });
    return controller.signal;
  };
  const endOperation = (signal: AbortSignal) => {
    if (current.abortController?.signal === signal) {
      update({ abortController: null, processing: '' });
    }
  };
  const releaseSession = () => {
    const session = current.session;
    if (session) {
      session.removeEventListener('contextoverflow', handleContextOverflow);
      session.destroy();
      update({ session: null });
    }
    updateSessionProps(null);
  };
  /**
   * Get default LLM params.
   * @deprecated Restricted to web extension contexts only.
   */
  const requestDefaultParams = async () => {
    const request = ++paramsRequest;
    const LanguageModel = getLanguageModel();
    if (typeof LanguageModel?.params !== 'function') {
      update({ defaultParams: null });
      return null;
    }
    try {
      const defaultParamsValue = await LanguageModel.params();
      if (request === paramsRequest) update({ defaultParams: defaultParamsValue });
      return defaultParamsValue;
    } catch {
      if (request === paramsRequest) update({ defaultParams: null });
      return null;
    }
  };
  const checkAvailability = async (model: LanguageModelCreateCoreOptions = {}) => {
    return safeCheckAvailability(getLanguageModel(), model);
  };
  const requestAvailability = async (model: LanguageModelCreateCoreOptions = {}) => {
    const request = ++availabilityRequest;
    const ownsProcessing = !current.abortController;
    if (ownsProcessing) update({ processing: 'availability' });
    try {
      const availabilityValue = await checkAvailability(model);
      if (request === availabilityRequest) update({ availability: availabilityValue });
      return availabilityValue;
    } finally {
      if (ownsProcessing && request === availabilityRequest && !current.abortController) update({ processing: '' });
    }
  };
  const initInternal = async (model: LanguageModelCreateCoreOptions, signal: AbortSignal) => {
    signal.throwIfAborted();
    releaseSession();
    update({ params: model, processing: 'availability' });
    const status = await waitFor(checkAvailability(model), signal);
    signal.throwIfAborted();
    update({ availability: status });
    if (status === 'unavailable') throw new Error('LanguageModel is unavailable with the provided options.');
    return status;
  };
  const init = async (model: LanguageModelCreateCoreOptions = {}) => {
    const signal = beginOperation('availability');
    try {
      return await initInternal(model, signal);
    } finally {
      endOperation(signal);
    }
  };
  const createInternal = async (createOptions: LLMCreateOptions, signal: AbortSignal) => {
    signal.throwIfAborted();
    const LanguageModel = getLanguageModel();
    if (typeof LanguageModel?.create !== 'function') {
      throw new Error('LanguageModel is not available in this browser context.');
    }
    const coreOptions = getCreateCoreOptions(createOptions);
    const modelOptions = current.params ?? coreOptions;
    update({ params: modelOptions });
    if (current.availability === 'unavailable') {
      throw new Error('LanguageModel is unavailable with the provided options.');
    }
    if (!current.availability) {
      const availabilityValue = await waitFor(checkAvailability(modelOptions), signal);
      signal.throwIfAborted();
      update({ availability: availabilityValue });
      if (availabilityValue === 'unavailable') {
        throw new Error('LanguageModel is unavailable with the provided options.');
      }
    }
    update({ processing: 'create' });
    const monitor = createDownloadMonitor((progress) => {
      if (!signal.aborted) update({ downloadProgress: progress });
    });
    const sessionValue = await createDetached(
      (creationSignal) =>
        LanguageModel.create(mergeCreateOptions(modelOptions, createOptions, creationSignal, monitor)),
      signal
    );
    if (signal.aborted) {
      sessionValue.destroy();
      signal.throwIfAborted();
    }
    releaseSession();
    update({ session: sessionValue });
    signal.throwIfAborted();
    sessionValue.addEventListener('contextoverflow', handleContextOverflow);
    update({ availability: 'available', downloadProgress: 100 });
    updateSessionProps(sessionValue);
    signal.throwIfAborted();
    return sessionValue;
  };
  const create = async (createOptions: LLMCreateOptions = {}) => {
    const signal = beginOperation('create');
    try {
      return await createInternal(createOptions, signal);
    } finally {
      endOperation(signal);
    }
  };
  const destroy = () => {
    interrupt();
    releaseSession();
  };
  const dispose = () => {
    destroy();
    update({
      params: null,
      availability: null,
      downloadProgress: 0,
      defaultParams: null,
      contextRestoreState: createEmptyContextRestoreState()
    });
  };
  const requireSession = () => {
    if (!current.session) throw new Error('Session is not initialized. Call create() first.');
    return current.session;
  };
  const prompt = async (input: LanguageModelPrompt, options?: LLMPromptOptions): Promise<string> => {
    const session = requireSession();
    const signal = beginOperation('prompt', true);
    try {
      const response = await waitFor(session.prompt(input, { ...options, signal }), signal);
      signal.throwIfAborted();
      updateSessionProps(session);
      return response;
    } finally {
      endOperation(signal);
    }
  };
  const promptJson = async <T = unknown>(
    input: LanguageModelPrompt,
    options: LLMStructuredPromptOptions
  ): Promise<T> => {
    const response = await prompt(input, options);
    return JSON.parse(response) as T;
  };
  /**
   * Clone the current native session, including its initial prompts and interaction
   * history. The caller owns the returned session and must destroy it when finished.
   */
  const clone = async (options: LLMCloneOptions = {}): Promise<LanguageModel> => {
    const session = requireSession();
    const signal = beginOperation('create', true);
    try {
      const cloned = await createDetached(
        (creationSignal) => session.clone({ ...options, signal: creationSignal }),
        signal
      );
      if (signal.aborted) {
        cloned.destroy();
        signal.throwIfAborted();
      }
      return cloned;
    } finally {
      endOperation(signal);
    }
  };
  const promptStreaming = (input: LanguageModelPrompt, options?: LLMPromptOptions): ReadableStream<string> => {
    const session = requireSession();
    const signal = beginOperation('prompt', true);
    let reader: ReadableStreamDefaultReader<string>;
    try {
      reader = session.promptStreaming(input, { ...options, signal }).getReader();
    } catch (error) {
      endOperation(signal);
      throw error;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      signal.removeEventListener('abort', abort);
      reader.releaseLock();
      if (!signal.aborted) updateSessionProps(session);
      endOperation(signal);
    };
    const cancelReader = async (reason: unknown) => {
      try {
        await reader.cancel(reason);
      } finally {
        finish();
      }
    };
    const abort = () => {
      void cancelReader(signal.reason).catch(() => undefined);
    };
    signal.addEventListener('abort', abort, { once: true });
    return new ReadableStream<string>({
      async pull(controller) {
        try {
          const { done, value } = await waitFor(reader.read(), signal);
          signal.throwIfAborted();
          if (done) {
            finish();
            controller.close();
          } else controller.enqueue(value);
        } catch (error) {
          try {
            await cancelReader(error);
          } catch {
            /* Keep the read error. */
          }
          controller.error(error);
        }
      },
      cancel: cancelReader
    });
  };
  const append = async (input: LanguageModelPrompt) => {
    const session = requireSession();
    const signal = beginOperation('prompt', true);
    try {
      await waitFor(session.append(input, { signal }), signal);
      signal.throwIfAborted();
      updateSessionProps(session);
    } finally {
      endOperation(signal);
    }
  };
  const measureContextUsage = async (input: LanguageModelPrompt, options?: LLMPromptOptions): Promise<number> => {
    const session = requireSession();
    const signal = beginOperation('measure', true);
    try {
      const usage = await waitFor(session.measureContextUsage(input, { ...options, signal }), signal);
      signal.throwIfAborted();
      return usage;
    } finally {
      endOperation(signal);
    }
  };
  const cloneContextRestoreState = (): LLMContextRestoreState => ({
    ...current.contextRestoreState
  });
  const setContextRestoreState = (
    patch: Partial<LLMContextRestoreState>,
    event: 'start' | 'progress' | 'complete' = 'progress',
    onStateChange?: LLMRestoreSessionOptions['onStateChange']
  ) => {
    update({
      contextRestoreState: {
        ...current.contextRestoreState,
        ...patch
      }
    });
    onStateChange?.(cloneContextRestoreState(), event);
  };
  const createRestoreResult = (
    ready: boolean,
    selectedMessages: RestorePrompt[],
    selectedConversationCount: number,
    totalConversationCount: number,
    summarizedMessages = 0
  ): LLMRestoreSessionResult => ({
    ready,
    selectedMessages,
    selectedConversationCount,
    totalConversationCount,
    summarizedMessages,
    partiallyLoaded: ready && (summarizedMessages > 0 || selectedConversationCount < totalConversationCount)
  });
  const createId = () => {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  };
  const hashString = (value: string) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };
  const normalizeSummaryCache = (summaries: LLMContextSummaryRecord[] = []): LLMContextSummaryRecord[] => {
    const seen = new Set<string>();
    const normalized: LLMContextSummaryRecord[] = [];
    summaries.forEach((summary) => {
      if (
        typeof summary.id !== 'string' ||
        typeof summary.summary !== 'string' ||
        summary.summary.trim().length === 0 ||
        !Number.isInteger(summary.startIndex) ||
        !Number.isInteger(summary.endIndex) ||
        summary.startIndex < 0 ||
        summary.endIndex <= summary.startIndex ||
        typeof summary.hash !== 'string'
      ) {
        return;
      }
      const key = `${summary.level}:${summary.startIndex}:${summary.endIndex}:${summary.hash}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      normalized.push({
        ...summary,
        messageIds: Array.isArray(summary.messageIds) ? [...summary.messageIds] : [],
        level: Number.isInteger(summary.level) ? summary.level : 0,
        tokenUsage: typeof summary.tokenUsage === 'number' ? summary.tokenUsage : null
      });
    });
    return normalized.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
      return a.endIndex - b.endIndex;
    });
  };
  const getConversationMessages = (history: RestorePrompt[]) => {
    const leadingSystemMessage = history[0]?.role === 'system' ? (history[0] as LanguageModelSystemMessage) : null;
    const rest = leadingSystemMessage ? history.slice(1) : history;
    const conversationHistory = rest.filter((message): message is LanguageModelMessage => {
      return message.role !== 'system';
    });
    return {
      leadingSystemMessage,
      conversationHistory
    };
  };
  const getContextBudget = (budgetRatio?: number) => {
    const ratio = Number.isFinite(budgetRatio)
      ? Math.min(Math.max(budgetRatio as number, 0.5), 1)
      : DEFAULT_CONTEXT_BUDGET_RATIO;
    return current.contextWindow ? Math.floor(current.contextWindow * ratio) : null;
  };
  const getMessageText = (message: LanguageModelMessage) => {
    if (typeof message.content === 'string') {
      return message.content;
    }
    return message.content
      .filter((item) => item.type === 'text')
      .map((item) => String(item.value))
      .join('\n');
  };
  const getMessageHash = (message: LanguageModelMessage, metadata?: LLMContextMessageMetadata) => {
    return metadata?.hash ?? hashString([metadata?.id ?? '', message.role, getMessageText(message)].join('\u001f'));
  };
  const formatMessagesForSummary = (
    items: LanguageModelMessage[],
    summaryMaxCharacters = DEFAULT_SUMMARY_MAX_CHARACTERS
  ) => {
    const transcript = items
      .map((message) => {
        const role = message.role === 'assistant' ? 'Assistant' : 'User';
        return `${role}: ${getMessageText(message).trim()}`;
      })
      .join('\n\n');
    if (summaryMaxCharacters > 0 && transcript.length > summaryMaxCharacters) {
      return transcript.slice(-summaryMaxCharacters);
    }
    return transcript;
  };
  const createSummaryPrompt = (transcript: string): LanguageModelMessage[] => [
    {
      role: 'user',
      content: [
        'Summarize the earlier chat history below for a future assistant session.',
        'Keep durable facts, user preferences, decisions, unresolved tasks, names, IDs, and constraints.',
        'Preserve chronological order when it matters. Do not invent details.',
        'Do not include filler. Use concise bullet points.',
        '',
        transcript
      ].join('\n')
    }
  ];
  const mergeSystemContent = (systemMessage: LanguageModelSystemMessage | null, summary?: string) => {
    const parts: string[] = [];
    const systemContent = typeof systemMessage?.content === 'string' ? systemMessage.content.trim() : '';
    if (systemContent) {
      parts.push(systemContent);
    }
    if (summary?.trim()) {
      parts.push(`Summary of earlier conversation:\n${summary.trim()}`);
    }
    if (parts.length === 0) {
      return null;
    }
    return {
      role: 'system',
      content: parts.join('\n\n')
    } as LanguageModelSystemMessage;
  };
  const resolveSummaryModelOptions = (
    modelOptions?: LanguageModelCreateCoreOptions
  ): LanguageModelCreateCoreOptions => ({
    ...modelOptions,
    expectedInputs: [{ type: 'text' }],
    expectedOutputs: [{ type: 'text' }]
  });
  const temporaryPrompt = async (
    input: LanguageModelPrompt,
    temporaryOptions: LLMTemporaryPromptOptions,
    parentSignal?: AbortSignal
  ) => {
    parentSignal?.throwIfAborted();
    const LanguageModel = getLanguageModel();
    if (typeof LanguageModel?.create !== 'function') {
      throw new Error('LanguageModel is not available in this browser context.');
    }
    const timeoutMs = temporaryOptions.timeoutMs == null ? null : Math.max(temporaryOptions.timeoutMs, 1000);
    const controller = new AbortController();
    const abort = () => controller.abort(parentSignal?.reason);
    parentSignal?.addEventListener('abort', abort, { once: true });
    temporaryControllers.add(controller);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let temporarySession: LanguageModel | null = null;
    if (timeoutMs) {
      timeoutId = setTimeout(() => {
        controller.abort(new DOMException('Temporary LanguageModel prompt timed out.', 'AbortError'));
      }, timeoutMs);
    }
    try {
      temporarySession = await waitFor(
        LanguageModel.create({
          ...(temporaryOptions.modelOptions ?? current.params ?? {}),
          signal: controller.signal
        }),
        controller.signal,
        (session) => session.destroy()
      );
      controller.signal.throwIfAborted();
      const response = await waitFor(
        temporarySession.prompt(input, {
          ...(temporaryOptions.promptOptions ?? {}),
          signal: controller.signal
        }),
        controller.signal
      );
      controller.signal.throwIfAborted();
      return response;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      parentSignal?.removeEventListener('abort', abort);
      temporaryControllers.delete(controller);
      temporarySession?.destroy();
    }
  };
  const promptWithTemporarySession = (input: LanguageModelPrompt, temporaryOptions: LLMTemporaryPromptOptions = {}) =>
    temporaryPrompt(input, temporaryOptions);
  const summarizeMessages = async (
    items: LanguageModelMessage[],
    restoreOptions: ActiveRestoreOptions,
    trackState = true
  ) => {
    const transcript = formatMessagesForSummary(items, restoreOptions.summaryMaxCharacters);
    if (trackState) {
      setContextRestoreState(
        {
          phase: 'summarizing',
          loadedMessages: Math.max(current.contextRestoreState.totalMessages - items.length, 0),
          summarizedMessages: items.length
        },
        'progress',
        restoreOptions.onStateChange
      );
    }
    restoreOptions.signal.throwIfAborted();
    const summary = await temporaryPrompt(
      createSummaryPrompt(transcript),
      {
        modelOptions: resolveSummaryModelOptions(restoreOptions.modelOptions),
        timeoutMs: restoreOptions.summaryTimeoutMs ?? DEFAULT_SUMMARY_TIMEOUT_MS
      },
      restoreOptions.signal
    );
    restoreOptions.signal.throwIfAborted();
    return summary.trim();
  };
  const createSummaryRecord = async (
    messagesToSummarize: LanguageModelMessage[],
    window: Pick<SummaryWindow, 'startIndex' | 'endIndex' | 'hash' | 'messageIds'>,
    level: number,
    restoreOptions: ActiveRestoreOptions,
    tokenUsage: number | null,
    trackState = true
  ): Promise<LLMContextSummaryRecord> => {
    const summary = await summarizeMessages(messagesToSummarize, restoreOptions, trackState);
    const now = Date.now();
    return {
      id: createId(),
      startIndex: window.startIndex,
      endIndex: window.endIndex,
      messageIds: [...window.messageIds],
      hash: window.hash,
      summary,
      tokenUsage,
      level,
      createdAt: now,
      updatedAt: now
    };
  };
  const findCachedSummary = (
    cache: SummaryCacheState,
    startIndex: number,
    endIndex: number,
    hash: string,
    level: number
  ) => {
    return (
      cache.records.find((summary) => {
        return (
          summary.startIndex === startIndex &&
          summary.endIndex === endIndex &&
          summary.hash === hash &&
          summary.level === level &&
          summary.summary.trim().length > 0
        );
      }) ?? null
    );
  };
  const persistSummaryRecord = async (
    cache: SummaryCacheState,
    record: LLMContextSummaryRecord,
    restoreOptions: ActiveRestoreOptions,
    trackState = true
  ) => {
    restoreOptions.signal.throwIfAborted();
    const nextRecords = cache.records.filter((summary) => {
      return !(
        summary.startIndex === record.startIndex &&
        summary.endIndex === record.endIndex &&
        summary.level === record.level
      );
    });
    nextRecords.push(record);
    cache.records = normalizeSummaryCache(nextRecords);
    cache.createdSummaries += 1;
    if (trackState) {
      setContextRestoreState(
        {
          createdSummaries: cache.createdSummaries,
          cachedSummaries: cache.cachedSummaries
        },
        'progress',
        restoreOptions.onStateChange
      );
    }
    await waitFor(
      Promise.resolve(restoreOptions.onSummaryCacheUpdate?.(cache.records.map((summary) => ({ ...summary })))),
      restoreOptions.signal
    );
    restoreOptions.signal.throwIfAborted();
  };
  const getSummaryChunkBudget = (restoreOptions: ActiveRestoreOptions) => {
    const ratio = Number.isFinite(restoreOptions.summaryChunkBudgetRatio)
      ? Math.min(Math.max(restoreOptions.summaryChunkBudgetRatio as number, 0.1), 0.95)
      : DEFAULT_SUMMARY_CHUNK_BUDGET_RATIO;
    return Math.floor((current.contextWindow as number) * ratio);
  };
  const createWindowHash = (
    messagesToSummarize: LanguageModelMessage[],
    metadata: LLMContextMessageMetadata[],
    level: number
  ) => {
    return hashString(
      [
        SUMMARY_CACHE_VERSION,
        level,
        ...messagesToSummarize.map((message, index) => {
          const itemMetadata = metadata[index];
          return [itemMetadata?.id ?? index, itemMetadata?.timestamp ?? '', getMessageHash(message, itemMetadata)].join(
            '\u001f'
          );
        })
      ].join('\u001e')
    );
  };
  const buildSummaryWindows = async (
    messagesToSummarize: LanguageModelMessage[],
    metadata: LLMContextMessageMetadata[],
    startIndex: number,
    measureSession: LanguageModel,
    restoreOptions: ActiveRestoreOptions
  ): Promise<SummaryWindow[]> => {
    const chunkBudget = getSummaryChunkBudget(restoreOptions);
    if (!chunkBudget || messagesToSummarize.length <= 1) {
      return [
        {
          startIndex,
          endIndex: startIndex + messagesToSummarize.length,
          messages: messagesToSummarize,
          metadata,
          hash: createWindowHash(messagesToSummarize, metadata, 0),
          messageIds: metadata.map((item) => item.id)
        }
      ];
    }
    const windows: SummaryWindow[] = [];
    let cursor = 0;
    while (cursor < messagesToSummarize.length) {
      let low = cursor + 1;
      let high = messagesToSummarize.length;
      let bestEnd = low;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidateMessages = messagesToSummarize.slice(cursor, middle);
        const usage = await measurePromptsSafely(
          measureSession,
          createSummaryPrompt(formatMessagesForSummary(candidateMessages, restoreOptions.summaryMaxCharacters)),
          restoreOptions
        );
        if (usage <= chunkBudget) {
          bestEnd = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      const messages = messagesToSummarize.slice(cursor, bestEnd);
      const windowMetadata = metadata.slice(cursor, bestEnd);
      windows.push({
        startIndex: startIndex + cursor,
        endIndex: startIndex + bestEnd,
        messages,
        metadata: windowMetadata,
        hash: createWindowHash(messages, windowMetadata, 0),
        messageIds: windowMetadata.map((item) => item.id)
      });
      cursor = bestEnd;
    }
    return windows;
  };
  const getOrCreateSummaryRecord = async (
    cache: SummaryCacheState,
    window: SummaryWindow,
    level: number,
    measureSession: LanguageModel | null,
    restoreOptions: ActiveRestoreOptions,
    trackState = true
  ) => {
    const tokenUsage = measureSession
      ? await measurePromptsSafely(measureSession, window.messages, restoreOptions)
      : null;
    const record = await createSummaryRecord(
      window.messages,
      window,
      level,
      restoreOptions,
      Number.isFinite(tokenUsage) ? tokenUsage : null,
      trackState
    );
    await persistSummaryRecord(cache, record, restoreOptions, trackState);
    return record;
  };
  const formatSummaryRecords = (records: LLMContextSummaryRecord[]) => {
    return records
      .sort((a, b) => a.startIndex - b.startIndex)
      .map((record) => {
        const start = record.startIndex + 1;
        return `Messages ${start}-${record.endIndex} summary:\n${record.summary.trim()}`;
      })
      .join('\n\n');
  };
  const createRollupSummaryIdentity = (records: LLMContextSummaryRecord[], level: number) => {
    const startIndex = Math.min(...records.map((record) => record.startIndex));
    const endIndex = Math.max(...records.map((record) => record.endIndex));
    const hash = hashString(
      [
        SUMMARY_CACHE_VERSION,
        level,
        ...records.map((record) => `${record.level}:${record.startIndex}:${record.endIndex}:${record.hash}`)
      ].join('\u001e')
    );
    return {
      startIndex,
      endIndex,
      hash,
      messageIds: records.flatMap((summary) => summary.messageIds)
    };
  };
  const getCachedRollupSummaryRecord = (
    cache: SummaryCacheState,
    records: LLMContextSummaryRecord[],
    level: number,
    restoreOptions: ActiveRestoreOptions,
    trackState = true
  ) => {
    const identity = createRollupSummaryIdentity(records, level);
    const cached = findCachedSummary(cache, identity.startIndex, identity.endIndex, identity.hash, level);
    if (!cached) {
      return null;
    }
    cache.cachedSummaries += 1;
    if (trackState) {
      setContextRestoreState(
        {
          cachedSummaries: cache.cachedSummaries,
          createdSummaries: cache.createdSummaries
        },
        'progress',
        restoreOptions.onStateChange
      );
    }
    return cached;
  };
  const createRollupSummaryRecord = async (
    cache: SummaryCacheState,
    records: LLMContextSummaryRecord[],
    level: number,
    restoreOptions: ActiveRestoreOptions,
    trackState = true
  ) => {
    const cached = getCachedRollupSummaryRecord(cache, records, level, restoreOptions, trackState);
    if (cached) {
      return cached;
    }
    const identity = createRollupSummaryIdentity(records, level);
    const rollupInput: LanguageModelMessage[] = [
      {
        role: 'user',
        content: formatSummaryRecords(records)
      }
    ];
    const record = await createSummaryRecord(rollupInput, identity, level, restoreOptions, null, trackState);
    await persistSummaryRecord(cache, record, restoreOptions, trackState);
    return record;
  };
  const scheduleSummary = (
    restoreOptions: ActiveRestoreOptions,
    work: (options: ActiveRestoreOptions) => Promise<unknown>
  ) => {
    restoreOptions.signal.throwIfAborted();
    if (typeof window === 'undefined') return;
    const controller = new AbortController();
    backgroundControllers.add(controller);
    const timeout = setTimeout(() => {
      backgroundTimers.delete(timeout);
      const backgroundRestoreOptions: ActiveRestoreOptions = {
        ...restoreOptions,
        summaryTimeoutMs: restoreOptions.summaryBackgroundTimeoutMs ?? DEFAULT_BACKGROUND_SUMMARY_TIMEOUT_MS,
        shouldContinue: undefined,
        signal: controller.signal
      };
      void work(backgroundRestoreOptions)
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          backgroundRestoreOptions.onSummaryCacheError?.(error);
          console.warn('Browser AI background summary cache update failed.', error);
        })
        .finally(() => backgroundControllers.delete(controller));
    }, 0);
    backgroundTimers.add(timeout);
  };
  const warmRollupSummaryRecord = (
    cache: SummaryCacheState,
    records: LLMContextSummaryRecord[],
    level: number,
    restoreOptions: ActiveRestoreOptions
  ) => {
    if (records.length === 0) return;
    const rollupRecords = [...records];
    scheduleSummary(restoreOptions, (options) =>
      createRollupSummaryRecord(cache, rollupRecords, level, options, false)
    );
  };
  const warmMissingSummaryRecords = (
    cache: SummaryCacheState,
    windows: SummaryWindow[],
    restoreOptions: ActiveRestoreOptions
  ) => {
    if (windows.length === 0) return;
    scheduleSummary(restoreOptions, async (options) => {
      for (const summaryWindow of windows) {
        options.signal.throwIfAborted();
        if (findCachedSummary(cache, summaryWindow.startIndex, summaryWindow.endIndex, summaryWindow.hash, 0)) continue;
        await getOrCreateSummaryRecord(cache, summaryWindow, 0, null, options, false);
      }
    });
  };
  const createCachedSummary = async (
    messagesToSummarize: LanguageModelMessage[],
    metadata: LLMContextMessageMetadata[],
    startIndex: number,
    tailMessages: LanguageModelMessage[],
    systemMessage: LanguageModelSystemMessage | null,
    budget: number | null,
    measureSession: LanguageModel,
    restoreOptions: ActiveRestoreOptions,
    cache: SummaryCacheState
  ): Promise<CachedSummaryResult> => {
    const windows = await buildSummaryWindows(
      messagesToSummarize,
      metadata,
      startIndex,
      measureSession,
      restoreOptions
    );
    setContextRestoreState(
      {
        summaryChunks: windows.length,
        summarizedMessages: messagesToSummarize.length
      },
      'progress',
      restoreOptions.onStateChange
    );
    const cachedRecords = windows.map((windowItem) =>
      findCachedSummary(cache, windowItem.startIndex, windowItem.endIndex, windowItem.hash, 0)
    );
    const missingWindows = windows.filter((_windowItem, index) => cachedRecords[index] === null);
    const summaryMode = restoreOptions.summaryMode ?? DEFAULT_SUMMARY_MODE;
    if (missingWindows.length > 0 && summaryMode === 'cache-first') {
      return {
        text: '',
        warmCache: () => warmMissingSummaryRecords(cache, missingWindows, restoreOptions)
      };
    }
    let records = cachedRecords.filter((record): record is LLMContextSummaryRecord => record !== null);
    if (records.length > 0) {
      cache.cachedSummaries += records.length;
      setContextRestoreState(
        {
          cachedSummaries: cache.cachedSummaries
        },
        'progress',
        restoreOptions.onStateChange
      );
    }
    for (const summaryWindow of windows) {
      if (findCachedSummary(cache, summaryWindow.startIndex, summaryWindow.endIndex, summaryWindow.hash, 0)) {
        continue;
      }
      setContextRestoreState(
        {
          phase: 'summarizing',
          loadedMessages: summaryWindow.endIndex - startIndex,
          summarizedMessages: messagesToSummarize.length,
          summaryChunks: windows.length
        },
        'progress',
        restoreOptions.onStateChange
      );
      const record = await getOrCreateSummaryRecord(cache, summaryWindow, 0, measureSession, restoreOptions);
      records.push(record);
      setContextRestoreState(
        {
          loadedMessages: summaryWindow.endIndex - startIndex,
          summarizedMessages: messagesToSummarize.length
        },
        'progress',
        restoreOptions.onStateChange
      );
    }
    let summaryText = formatSummaryRecords(records);
    for (let attempt = 1; attempt <= MAX_SUMMARY_ROLLUP_ATTEMPTS; attempt += 1) {
      const summarySystem = mergeSystemContent(systemMessage, summaryText);
      const candidate = [summarySystem as LanguageModelSystemMessage, ...tailMessages];
      const usage = await measurePromptsSafely(measureSession, candidate, restoreOptions);
      if (usage <= (budget as number)) {
        return { text: summaryText };
      }
      if (summaryMode === 'cache-first') {
        const cachedRollup = getCachedRollupSummaryRecord(cache, records, attempt, restoreOptions);
        if (!cachedRollup) {
          return {
            text: '',
            warmCache: () => warmRollupSummaryRecord(cache, records, attempt, restoreOptions)
          };
        }
        records = [cachedRollup];
        summaryText = formatSummaryRecords(records);
        continue;
      }
      const rollup = await createRollupSummaryRecord(cache, records, attempt, restoreOptions);
      records = [rollup];
      summaryText = formatSummaryRecords(records);
    }
    return { text: summaryText };
  };
  const toMeasurablePrompt = (prompts: RestorePrompt[]) => {
    return prompts.map((message) => {
      if (message.role !== 'system') {
        return message;
      }
      return {
        role: 'user',
        content: `System instructions:\n${message.content}`
      } as LanguageModelMessage;
    });
  };
  const measurePromptsSafely = async (
    measureSession: LanguageModel,
    prompts: RestorePrompt[],
    restoreOptions: ActiveRestoreOptions
  ) => {
    try {
      restoreOptions.signal.throwIfAborted();
      const usage = await waitFor(
        measureSession.measureContextUsage(toMeasurablePrompt(prompts), { signal: restoreOptions.signal }),
        restoreOptions.signal
      );
      restoreOptions.signal.throwIfAborted();
      setContextRestoreState({ measuredTokens: usage }, 'progress', restoreOptions.onStateChange);
      return usage;
    } catch {
      restoreOptions.signal.throwIfAborted();
      return Number.POSITIVE_INFINITY;
    }
  };
  const fitPromptHistory = async (
    systemMessage: LanguageModelSystemMessage | null,
    conversationHistory: LanguageModelMessage[],
    budget: number | null,
    measureSession: LanguageModel,
    restoreOptions: ActiveRestoreOptions
  ): Promise<PromptFitResult> => {
    if (!budget || conversationHistory.length === 0) {
      return {
        selected: systemMessage ? [systemMessage, ...conversationHistory] : [...conversationHistory],
        selectedConversationCount: conversationHistory.length,
        omitted: []
      };
    }
    const buildCandidate = (startIndex: number): RestorePrompt[] => {
      const messages = conversationHistory.slice(startIndex);
      return systemMessage ? [systemMessage, ...messages] : messages;
    };
    const fullUsage = await measurePromptsSafely(measureSession, buildCandidate(0), restoreOptions);
    if (fullUsage <= budget) {
      setContextRestoreState(
        {
          phase: 'measuring',
          loadedMessages: conversationHistory.length,
          includedMessages: conversationHistory.length
        },
        'progress',
        restoreOptions.onStateChange
      );
      return {
        selected: buildCandidate(0),
        selectedConversationCount: conversationHistory.length,
        omitted: []
      };
    }
    let low = 0;
    let high = conversationHistory.length;
    let bestStart = conversationHistory.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const usage = await measurePromptsSafely(measureSession, buildCandidate(middle), restoreOptions);
      const includedMessages = conversationHistory.length - middle;
      setContextRestoreState(
        {
          phase: 'measuring',
          loadedMessages: includedMessages,
          includedMessages
        },
        'progress',
        restoreOptions.onStateChange
      );
      if (usage <= budget) {
        bestStart = middle;
        high = middle;
      } else {
        low = middle + 1;
      }
    }
    const selectedMessages = conversationHistory.slice(bestStart);
    return {
      selected: systemMessage ? [systemMessage, ...selectedMessages] : selectedMessages,
      selectedConversationCount: selectedMessages.length,
      omitted: conversationHistory.slice(0, bestStart)
    };
  };
  const pickMessagesForRestore = async (
    history: RestorePrompt[],
    measureSession: LanguageModel,
    restoreOptions: ActiveRestoreOptions
  ): Promise<PromptFitResult> => {
    const { leadingSystemMessage, conversationHistory } = getConversationMessages(history);
    const budget = getContextBudget(restoreOptions.budgetRatio);
    const cache: SummaryCacheState = {
      records: normalizeSummaryCache(restoreOptions.summaryCache),
      cachedSummaries: 0,
      createdSummaries: 0
    };
    setContextRestoreState(
      {
        phase: 'measuring',
        totalMessages: conversationHistory.length,
        loadedMessages: 0,
        includedMessages: 0,
        summarizedMessages: 0,
        cachedSummaries: 0,
        createdSummaries: 0,
        summaryChunks: 0,
        measuredTokens: null
      },
      'progress',
      restoreOptions.onStateChange
    );
    const recentFit = await fitPromptHistory(
      leadingSystemMessage,
      conversationHistory,
      budget,
      measureSession,
      restoreOptions
    );
    if (recentFit.omitted.length === 0 || restoreOptions.strategy === 'recent') {
      return {
        ...recentFit,
        summarizedMessages: 0
      };
    }
    try {
      const omittedCount = recentFit.omitted.length;
      const summary = await createCachedSummary(
        recentFit.omitted,
        (restoreOptions.messageMetadata ?? []).slice(0, omittedCount),
        0,
        conversationHistory.slice(omittedCount),
        leadingSystemMessage,
        budget,
        measureSession,
        restoreOptions,
        cache
      );
      if (!summary.text) {
        return {
          ...recentFit,
          summarizedMessages: 0,
          warmSummaryCache: summary.warmCache
        };
      }
      const summarizedSystem = mergeSystemContent(leadingSystemMessage, summary.text);
      const summarizedFit = await fitPromptHistory(
        summarizedSystem,
        conversationHistory.slice(omittedCount),
        budget,
        measureSession,
        restoreOptions
      );
      return {
        ...summarizedFit,
        summarizedMessages: omittedCount,
        warmSummaryCache: summary.warmCache
      };
    } catch (error) {
      restoreOptions.signal.throwIfAborted();
      console.warn('Browser AI context summarization failed; falling back to recent messages.', error);
      return {
        ...recentFit,
        summarizedMessages: 0
      };
    }
  };
  const restoreSession = async (
    history: RestorePrompt[] = [],
    restoreOptions: LLMRestoreSessionOptions = {}
  ): Promise<LLMRestoreSessionResult> => {
    const signal = beginOperation('availability');
    const modelOptions = restoreOptions.modelOptions ?? current.params ?? {};
    const { conversationHistory } = getConversationMessages(history);
    const totalConversationCount = conversationHistory.length;
    const shouldContinue = () => {
      signal.throwIfAborted();
      const proceed = restoreOptions.shouldContinue?.() ?? true;
      signal.throwIfAborted();
      return proceed;
    };
    try {
      setContextRestoreState(
        {
          phase: 'checking',
          loadedMessages: 0,
          totalMessages: totalConversationCount,
          summarizedMessages: 0,
          includedMessages: 0,
          measuredTokens: null
        },
        'start',
        restoreOptions.onStateChange
      );
      signal.throwIfAborted();
      restoreOptions.onInitStart?.();
      await initInternal(modelOptions, signal);
      signal.throwIfAborted();
      restoreOptions.onInitComplete?.();
      if (!shouldContinue()) {
        return createRestoreResult(false, [], 0, totalConversationCount);
      }
      if (!restoreOptions.autoCreate && !restoreOptions.allowDownloadCreate) {
        setContextRestoreState({ phase: 'idle' }, 'complete', restoreOptions.onStateChange);
        return createRestoreResult(false, [], 0, totalConversationCount);
      }
      if (current.availability !== 'available' && !restoreOptions.allowDownloadCreate) {
        setContextRestoreState({ phase: 'idle' }, 'complete', restoreOptions.onStateChange);
        return createRestoreResult(false, [], 0, totalConversationCount);
      }
      if (history.length === 0) {
        setContextRestoreState({ phase: 'creating' }, 'progress', restoreOptions.onStateChange);
        restoreOptions.onCreateStart?.();
        await createInternal({}, signal);
        signal.throwIfAborted();
        restoreOptions.onCreateComplete?.();
        signal.throwIfAborted();
        setContextRestoreState({ phase: 'ready' }, 'complete', restoreOptions.onStateChange);
        return createRestoreResult(true, [], 0, 0);
      }
      setContextRestoreState({ phase: 'creating' }, 'progress', restoreOptions.onStateChange);
      restoreOptions.onCreateStart?.();
      const measureSession = await createInternal({}, signal);
      signal.throwIfAborted();
      restoreOptions.onCreateComplete?.();
      if (!shouldContinue()) {
        return createRestoreResult(false, [], 0, totalConversationCount);
      }
      const fitted = await pickMessagesForRestore(history, measureSession, {
        strategy: 'summarize',
        ...restoreOptions,
        modelOptions,
        signal
      });
      signal.throwIfAborted();
      if (!shouldContinue()) {
        return createRestoreResult(
          false,
          fitted.selected,
          fitted.selectedConversationCount,
          totalConversationCount,
          fitted.summarizedMessages as number
        );
      }
      const summarizedMessages = fitted.summarizedMessages as number;
      setContextRestoreState(
        {
          phase: 'restoring',
          loadedMessages: fitted.selectedConversationCount,
          includedMessages: fitted.selectedConversationCount,
          summarizedMessages
        },
        'progress',
        restoreOptions.onStateChange
      );
      restoreOptions.onCreateStart?.();
      await createInternal(
        {
          initialPrompts: fitted.selected as LanguageModelCreateOptions['initialPrompts']
        },
        signal
      );
      signal.throwIfAborted();
      restoreOptions.onCreateComplete?.();
      signal.throwIfAborted();
      fitted.warmSummaryCache?.();
      setContextRestoreState(
        {
          phase: 'ready',
          loadedMessages: fitted.selectedConversationCount,
          totalMessages: totalConversationCount,
          includedMessages: fitted.selectedConversationCount,
          summarizedMessages
        },
        'complete',
        restoreOptions.onStateChange
      );
      return createRestoreResult(
        true,
        fitted.selected,
        fitted.selectedConversationCount,
        totalConversationCount,
        summarizedMessages
      );
    } catch (error) {
      if (!signal.aborted) setContextRestoreState({ phase: 'error' }, 'progress', restoreOptions.onStateChange);
      throw error;
    } finally {
      endOperation(signal);
    }
  };
  const interrupt = () => {
    interruptForeground();
    for (const timer of backgroundTimers) clearTimeout(timer);
    backgroundTimers.clear();
    for (const controller of backgroundControllers) controller.abort();
    backgroundControllers.clear();
    for (const controller of temporaryControllers) controller.abort();
    update({ abortController: null, processing: '' });
  };
  return projectWorkflow(
    store,
    () => ({
      session: current.session,
      processing: current.processing,
      availability: current.availability,
      downloadProgress: current.downloadProgress,
      /** @deprecated Restricted to web extension contexts only */
      defaultParams: current.defaultParams,
      /** @deprecated Restricted to web extension contexts only */
      temperature: current.temperature,
      /** @deprecated Restricted to web extension contexts only */
      topK: current.topK,
      contextWindow: current.contextWindow,
      contextUsage: current.contextUsage,
      contextWindowAvailable: contextWindowAvailable(),
      contextRestoreState: current.contextRestoreState,
      isProcessing: isProcessing(),
      isReady: isReady()
    }),
    {
      checkAvailability,
      requestAvailability,
      requestDefaultParams,
      init,
      create,
      destroy,
      dispose,
      prompt,
      promptJson,
      clone,
      promptStreaming,
      promptWithTemporarySession,
      restoreSession,
      append,
      measureContextUsage,
      interrupt
    }
  );
}
