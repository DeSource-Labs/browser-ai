import { computed, ref, shallowRef } from 'vue';
import { createDownloadMonitor, safeCheckAvailability } from '../utils/browserAi';

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

export function usePromptApi(options: UsePromptApiOptions = {}) {
  const { onContextOverflow } = options;

  // Browser model instances are mutable platform objects. Keeping them shallow avoids
  // Vue proxying and recursively traversing a live native session on every render.
  const session = shallowRef<LanguageModel | null>(null);
  const processing = ref<LLMProcessingState>('');
  const availability = ref<Availability | null>(null);
  const defaultParams = ref<LanguageModelParams | null>(null);
  const params = ref<LanguageModelCreateCoreOptions | null>(null);
  const downloadProgress = ref(0);

  const temperature = ref<number | null>(null);
  const topK = ref<number | null>(null);
  const contextWindow = ref<number | null>(null);
  const contextUsage = ref<number | null>(null);
  const contextRestoreState = ref<LLMContextRestoreState>(createEmptyContextRestoreState());

  const abortController = shallowRef<AbortController | null>(null);

  const isReady = computed(() => {
    return session.value !== null && availability.value === 'available';
  });

  const isProcessing = computed(() => processing.value !== '');

  const contextWindowAvailable = computed(() => {
    if (contextWindow.value == null || contextUsage.value == null) {
      return null;
    }

    return Math.max(contextWindow.value - contextUsage.value, 0);
  });

  const updateSessionProps = (sessionInstance?: LanguageModel | null) => {
    temperature.value = sessionInstance?.temperature ?? null;
    topK.value = sessionInstance?.topK ?? null;
    contextWindow.value = sessionInstance?.contextWindow ?? null;
    contextUsage.value = sessionInstance?.contextUsage ?? null;
  };

  const handleContextOverflow = (event: Event) => {
    updateSessionProps(session.value);
    onContextOverflow?.(event);
  };

  const beginOperation = () => {
    interrupt();
    abortController.value = new AbortController();
    return abortController.value.signal;
  };

  const endOperation = (signal: AbortSignal) => {
    if (abortController.value?.signal === signal) {
      abortController.value = null;
    }
  };

  /**
   * Get default LLM params.
   * @deprecated Restricted to web extension contexts only.
   */
  const requestDefaultParams = async () => {
    const LanguageModel = getLanguageModel();
    if (typeof LanguageModel?.params !== 'function') {
      defaultParams.value = null;
      return null;
    }

    try {
      defaultParams.value = await LanguageModel.params();
      return defaultParams.value;
    } catch {
      defaultParams.value = null;
      return null;
    }
  };

  const checkAvailability = async (model: LanguageModelCreateCoreOptions = {}) => {
    return safeCheckAvailability(getLanguageModel(), model);
  };

  const requestAvailability = async (model: LanguageModelCreateCoreOptions = {}) => {
    processing.value = 'availability';
    try {
      availability.value = await checkAvailability(model);
      return availability.value;
    } finally {
      processing.value = '';
    }
  };

  const init = async (model: LanguageModelCreateCoreOptions = {}) => {
    destroy();
    params.value = model;
    const status = await requestAvailability(model);

    if (status === 'unavailable') {
      throw new Error('LanguageModel is unavailable with the provided options.');
    }

    return status;
  };

  const create = async (createOptions: LLMCreateOptions = {}) => {
    const LanguageModel = getLanguageModel();
    if (typeof LanguageModel?.create !== 'function') {
      throw new Error('LanguageModel is not available in this browser context.');
    }

    const coreOptions = getCreateCoreOptions(createOptions);
    const modelOptions = params.value ?? coreOptions;
    params.value = modelOptions;

    if (availability.value === 'unavailable') {
      throw new Error('LanguageModel is unavailable with the provided options.');
    }

    if (!availability.value) {
      availability.value = await checkAvailability(modelOptions);
      if (availability.value === 'unavailable') {
        throw new Error('LanguageModel is unavailable with the provided options.');
      }
    }

    processing.value = 'create';
    const signal = beginOperation();
    destroy();

    const monitor = createDownloadMonitor((progress) => {
      downloadProgress.value = progress;
    });

    try {
      session.value = await LanguageModel.create(mergeCreateOptions(modelOptions, createOptions, signal, monitor));
      session.value.addEventListener('contextoverflow', handleContextOverflow);
      availability.value = 'available';
      downloadProgress.value = 100;
      updateSessionProps(session.value);
      return session.value;
    } finally {
      endOperation(signal);
      processing.value = '';
    }
  };

  const destroy = () => {
    if (!session.value) {
      updateSessionProps(null);
      return;
    }

    session.value.removeEventListener('contextoverflow', handleContextOverflow);
    session.value.destroy();
    session.value = null;
    updateSessionProps(null);
  };

  const dispose = () => {
    interrupt();
    destroy();
    params.value = null;
    availability.value = null;
    downloadProgress.value = 0;
    processing.value = '';
  };

  const prompt = async (input: LanguageModelPrompt, options?: LLMPromptOptions): Promise<string> => {
    if (!session.value) {
      throw new Error('Session is not initialized. Call create() first.');
    }

    processing.value = 'prompt';
    const signal = beginOperation();

    try {
      const response = await session.value.prompt(input, {
        ...options,
        signal
      });
      updateSessionProps(session.value);
      return response;
    } finally {
      endOperation(signal);
      processing.value = '';
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
    const sourceSession = session.value;
    if (!sourceSession) {
      throw new Error('Session is not initialized. Call create() first.');
    }

    processing.value = 'create';
    const signal = beginOperation();
    try {
      return await sourceSession.clone({ ...options, signal });
    } finally {
      endOperation(signal);
      processing.value = '';
    }
  };

  const promptStreaming = (input: LanguageModelPrompt, options?: LLMPromptOptions): ReadableStream<string> => {
    if (!session.value) {
      throw new Error('Session is not initialized. Call create() first.');
    }

    processing.value = 'prompt';
    const signal = beginOperation();
    const stream = session.value.promptStreaming(input, { ...options, signal });
    const reader = stream.getReader();

    return new ReadableStream<string>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            updateSessionProps(session.value);
            endOperation(signal);
            processing.value = '';
            return;
          }

          controller.enqueue(value);
        } catch (error) {
          updateSessionProps(session.value);
          endOperation(signal);
          processing.value = '';
          controller.error(error);
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason);
        } finally {
          updateSessionProps(session.value);
          endOperation(signal);
          processing.value = '';
        }
      }
    });
  };

  const append = async (input: LanguageModelPrompt) => {
    if (!session.value) {
      throw new Error('Session is not initialized. Call create() first.');
    }

    processing.value = 'prompt';
    const signal = beginOperation();

    try {
      await session.value.append(input, { signal });
      updateSessionProps(session.value);
    } finally {
      endOperation(signal);
      processing.value = '';
    }
  };

  const measureContextUsage = async (input: LanguageModelPrompt, options?: LLMPromptOptions): Promise<number> => {
    if (!session.value) {
      throw new Error('Session is not initialized. Call create() first.');
    }

    processing.value = 'measure';
    const signal = beginOperation();

    try {
      return await session.value.measureContextUsage(input, {
        ...options,
        signal
      });
    } finally {
      endOperation(signal);
      processing.value = '';
    }
  };

  const cloneContextRestoreState = (): LLMContextRestoreState => ({
    ...contextRestoreState.value
  });

  const setContextRestoreState = (
    patch: Partial<LLMContextRestoreState>,
    event: 'start' | 'progress' | 'complete' = 'progress',
    onStateChange?: LLMRestoreSessionOptions['onStateChange']
  ) => {
    contextRestoreState.value = {
      ...contextRestoreState.value,
      ...patch
    };
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

    return contextWindow.value ? Math.floor(contextWindow.value * ratio) : null;
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
    ...(modelOptions ?? params.value ?? {}),
    expectedInputs: [{ type: 'text' }],
    expectedOutputs: [{ type: 'text' }]
  });

  const promptWithTemporarySession = async (
    input: LanguageModelPrompt,
    temporaryOptions: LLMTemporaryPromptOptions = {}
  ) => {
    const LanguageModel = getLanguageModel();
    if (typeof LanguageModel?.create !== 'function') {
      throw new Error('LanguageModel is not available in this browser context.');
    }

    const timeoutMs = temporaryOptions.timeoutMs == null ? null : Math.max(temporaryOptions.timeoutMs, 1000);
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let temporarySession: LanguageModel | null = null;

    if (timeoutMs) {
      timeoutId = setTimeout(() => {
        controller.abort(new DOMException('Temporary LanguageModel prompt timed out.', 'AbortError'));
      }, timeoutMs);
    }

    try {
      temporarySession = await LanguageModel.create({
        ...(temporaryOptions.modelOptions ?? params.value ?? {})
      });

      return await temporarySession.prompt(input, {
        ...(temporaryOptions.promptOptions ?? {}),
        signal: controller.signal
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      temporarySession?.destroy();
    }
  };

  const summarizeMessages = async (
    items: LanguageModelMessage[],
    restoreOptions: LLMRestoreSessionOptions,
    trackState = true
  ) => {
    const transcript = formatMessagesForSummary(items, restoreOptions.summaryMaxCharacters);
    if (!transcript.trim()) {
      return '';
    }

    if (trackState) {
      setContextRestoreState(
        {
          phase: 'summarizing',
          loadedMessages: Math.max(contextRestoreState.value.totalMessages - items.length, 0),
          summarizedMessages: items.length
        },
        'progress',
        restoreOptions.onStateChange
      );
    }

    const summary = await promptWithTemporarySession(createSummaryPrompt(transcript), {
      modelOptions: resolveSummaryModelOptions(restoreOptions.modelOptions),
      timeoutMs: restoreOptions.summaryTimeoutMs ?? DEFAULT_SUMMARY_TIMEOUT_MS
    });

    return summary.trim();
  };

  const createSummaryRecord = async (
    messagesToSummarize: LanguageModelMessage[],
    window: Pick<SummaryWindow, 'startIndex' | 'endIndex' | 'hash' | 'messageIds'>,
    level: number,
    restoreOptions: LLMRestoreSessionOptions,
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
    restoreOptions: LLMRestoreSessionOptions,
    trackState = true
  ) => {
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

    await restoreOptions.onSummaryCacheUpdate?.(cache.records.map((summary) => ({ ...summary })));
  };

  const getSummaryChunkBudget = (restoreOptions: LLMRestoreSessionOptions) => {
    if (!contextWindow.value) {
      return null;
    }

    const ratio = Number.isFinite(restoreOptions.summaryChunkBudgetRatio)
      ? Math.min(Math.max(restoreOptions.summaryChunkBudgetRatio as number, 0.1), 0.95)
      : DEFAULT_SUMMARY_CHUNK_BUDGET_RATIO;

    return Math.floor(contextWindow.value * ratio);
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
    restoreOptions: LLMRestoreSessionOptions
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
    restoreOptions: LLMRestoreSessionOptions,
    trackState = true
  ) => {
    const cached = findCachedSummary(cache, window.startIndex, window.endIndex, window.hash, level);

    if (cached) {
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
    }

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
      .sort((a, b) => a.startIndex - b.startIndex || a.level - b.level)
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
    restoreOptions: LLMRestoreSessionOptions,
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
    restoreOptions: LLMRestoreSessionOptions,
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

  const warmRollupSummaryRecord = (
    cache: SummaryCacheState,
    records: LLMContextSummaryRecord[],
    level: number,
    restoreOptions: LLMRestoreSessionOptions
  ) => {
    if (records.length === 0 || typeof window === 'undefined') {
      return;
    }

    const rollupRecords = [...records];
    window.setTimeout(() => {
      void (async () => {
        const backgroundRestoreOptions: LLMRestoreSessionOptions = {
          ...restoreOptions,
          summaryTimeoutMs: restoreOptions.summaryBackgroundTimeoutMs ?? DEFAULT_BACKGROUND_SUMMARY_TIMEOUT_MS,
          shouldContinue: undefined
        };

        try {
          await createRollupSummaryRecord(cache, rollupRecords, level, backgroundRestoreOptions, false);
        } catch (error) {
          backgroundRestoreOptions.onSummaryCacheError?.(error);
          console.warn('Browser AI background summary rollup cache update failed.', error);
        }
      })();
    }, 0);
  };

  const warmMissingSummaryRecords = (
    cache: SummaryCacheState,
    windows: SummaryWindow[],
    restoreOptions: LLMRestoreSessionOptions
  ) => {
    if (windows.length === 0 || typeof window === 'undefined') {
      return;
    }

    window.setTimeout(() => {
      void (async () => {
        const backgroundRestoreOptions: LLMRestoreSessionOptions = {
          ...restoreOptions,
          summaryTimeoutMs: restoreOptions.summaryBackgroundTimeoutMs ?? DEFAULT_BACKGROUND_SUMMARY_TIMEOUT_MS,
          shouldContinue: undefined
        };

        for (const summaryWindow of windows) {
          if (findCachedSummary(cache, summaryWindow.startIndex, summaryWindow.endIndex, summaryWindow.hash, 0)) {
            continue;
          }

          try {
            await getOrCreateSummaryRecord(cache, summaryWindow, 0, null, backgroundRestoreOptions, false);
          } catch (error) {
            backgroundRestoreOptions.onSummaryCacheError?.(error);
            console.warn('Browser AI background summary cache update failed.', error);
            break;
          }
        }
      })();
    }, 0);
  };

  const createCachedSummary = async (
    messagesToSummarize: LanguageModelMessage[],
    metadata: LLMContextMessageMetadata[],
    startIndex: number,
    tailMessages: LanguageModelMessage[],
    systemMessage: LanguageModelSystemMessage | null,
    budget: number | null,
    measureSession: LanguageModel,
    restoreOptions: LLMRestoreSessionOptions,
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
      if (!budget) {
        return { text: summaryText };
      }

      const summarySystem = mergeSystemContent(systemMessage, summaryText);
      const candidate = summarySystem ? [summarySystem, ...tailMessages] : tailMessages;
      const usage = await measurePromptsSafely(measureSession, candidate, restoreOptions);
      if (usage <= budget) {
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
    restoreOptions: LLMRestoreSessionOptions
  ) => {
    try {
      const usage = await measureSession.measureContextUsage(toMeasurablePrompt(prompts));
      setContextRestoreState({ measuredTokens: usage }, 'progress', restoreOptions.onStateChange);
      return usage;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  };

  const fitPromptHistory = async (
    systemMessage: LanguageModelSystemMessage | null,
    conversationHistory: LanguageModelMessage[],
    budget: number | null,
    measureSession: LanguageModel,
    restoreOptions: LLMRestoreSessionOptions
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
    restoreOptions: LLMRestoreSessionOptions
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
    const modelOptions = restoreOptions.modelOptions ?? params.value ?? {};
    const { conversationHistory } = getConversationMessages(history);
    const totalConversationCount = conversationHistory.length;
    const shouldContinue = () => restoreOptions.shouldContinue?.() ?? true;

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

    try {
      restoreOptions.onInitStart?.();
      await init(modelOptions);
      restoreOptions.onInitComplete?.();

      if (!shouldContinue()) {
        return createRestoreResult(false, [], 0, totalConversationCount);
      }

      if (!restoreOptions.autoCreate && !restoreOptions.allowDownloadCreate) {
        setContextRestoreState({ phase: 'idle' }, 'complete', restoreOptions.onStateChange);
        return createRestoreResult(false, [], 0, totalConversationCount);
      }

      if (availability.value !== 'available' && !restoreOptions.allowDownloadCreate) {
        setContextRestoreState({ phase: 'idle' }, 'complete', restoreOptions.onStateChange);
        return createRestoreResult(false, [], 0, totalConversationCount);
      }

      if (history.length === 0) {
        setContextRestoreState({ phase: 'creating' }, 'progress', restoreOptions.onStateChange);
        restoreOptions.onCreateStart?.();
        await create();
        restoreOptions.onCreateComplete?.();
        setContextRestoreState({ phase: 'ready' }, 'complete', restoreOptions.onStateChange);
        return createRestoreResult(true, [], 0, 0);
      }

      setContextRestoreState({ phase: 'creating' }, 'progress', restoreOptions.onStateChange);
      restoreOptions.onCreateStart?.();
      const measureSession = await create();
      restoreOptions.onCreateComplete?.();

      if (!shouldContinue()) {
        return createRestoreResult(false, [], 0, totalConversationCount);
      }

      const fitted = await pickMessagesForRestore(history, measureSession, {
        strategy: 'summarize',
        ...restoreOptions,
        modelOptions
      });

      if (!shouldContinue()) {
        return createRestoreResult(
          false,
          fitted.selected,
          fitted.selectedConversationCount,
          totalConversationCount,
          fitted.summarizedMessages ?? 0
        );
      }

      const summarizedMessages = fitted.summarizedMessages ?? 0;
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
      await create({
        initialPrompts: fitted.selected as LanguageModelCreateOptions['initialPrompts']
      });
      restoreOptions.onCreateComplete?.();
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
      setContextRestoreState({ phase: 'error' }, 'progress', restoreOptions.onStateChange);
      throw error;
    }
  };

  const interrupt = () => {
    abortController.value?.abort();
    abortController.value = null;
  };

  return {
    session: computed(() => session.value),
    processing: computed(() => processing.value),
    availability: computed(() => availability.value),
    downloadProgress: computed(() => downloadProgress.value),
    /** @deprecated Restricted to web extension contexts only */
    defaultParams: computed(() => defaultParams.value),
    /** @deprecated Restricted to web extension contexts only */
    temperature: computed(() => temperature.value),
    /** @deprecated Restricted to web extension contexts only */
    topK: computed(() => topK.value),
    contextWindow: computed(() => contextWindow.value),
    contextUsage: computed(() => contextUsage.value),
    contextWindowAvailable,
    contextRestoreState: computed(() => contextRestoreState.value),

    isProcessing,
    isReady,

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
  };
}
