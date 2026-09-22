import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPromptWorkflow, type LLMContextSummaryRecord } from '../../src/workflows';
import { emitDownloadProgress, failingTextStream, pendingTextStream, textStream } from '../workflow-helpers';
import { deferred } from '../helpers';

const promptText = (prompt: LanguageModelPrompt | undefined): string => {
  if (typeof prompt === 'string') return prompt;
  if (!Array.isArray(prompt)) return '';
  return prompt
    .flatMap((message) => {
      if (typeof message.content === 'string') return [message.content];
      return message.content.filter((item) => item.type === 'text').map((item) => String(item.value));
    })
    .join('\n');
};

class AdvancedLanguageModel extends EventTarget {
  static availabilityStatus: Availability = 'available';
  static availabilityError: unknown;
  static availability = vi.fn(async () => {
    if (AdvancedLanguageModel.availabilityError) throw AdvancedLanguageModel.availabilityError;
    return AdvancedLanguageModel.availabilityStatus;
  });
  static paramsError: unknown;
  static params = vi.fn(async () => {
    if (AdvancedLanguageModel.paramsError) throw AdvancedLanguageModel.paramsError;
    return { defaultTopK: 3, maxTopK: 8, defaultTemperature: 0.7 } as LanguageModelParams;
  });
  static createError: unknown;
  static createOptions: LanguageModelCreateOptions[] = [];
  static instances: AdvancedLanguageModel[] = [];
  static contextWindowValue: number | undefined = 100;
  static promptError: unknown;
  static pendingPrompt = false;
  static summaryError: unknown;
  static response = 'response';
  static summaryResponse = 'durable facts';
  static streamError: unknown;
  static pendingStream = false;
  static streamCancelled = vi.fn();
  static appendError: unknown;
  static measureError: unknown;
  static measure = (input: LanguageModelPrompt) => promptText(input).length;

  static async create(options: LanguageModelCreateOptions = {}) {
    if (AdvancedLanguageModel.createError) throw AdvancedLanguageModel.createError;
    AdvancedLanguageModel.createOptions.push(options);
    emitDownloadProgress(options);
    const instance = new AdvancedLanguageModel();
    AdvancedLanguageModel.instances.push(instance);
    return instance;
  }

  readonly temperature = 0.8;
  readonly topK = 4;
  readonly contextWindow = AdvancedLanguageModel.contextWindowValue as number;
  contextUsage = 12;
  destroyed = false;
  append = vi.fn(async (_input: LanguageModelPrompt, options?: { signal?: AbortSignal }) => {
    if (AdvancedLanguageModel.appendError) throw AdvancedLanguageModel.appendError;
    if (options?.signal?.aborted) throw options.signal.reason;
    this.contextUsage += 1;
  });
  measureContextUsage = vi.fn(async (input: LanguageModelPrompt) => {
    if (AdvancedLanguageModel.measureError) throw AdvancedLanguageModel.measureError;
    return AdvancedLanguageModel.measure(input);
  });
  prompt = vi.fn(async (input: LanguageModelPrompt, options?: LanguageModelPromptOptions) => {
    const text = promptText(input);
    if (text.includes('Summarize the earlier chat history')) {
      if (AdvancedLanguageModel.summaryError) throw AdvancedLanguageModel.summaryError;
      return AdvancedLanguageModel.summaryResponse;
    }
    if (AdvancedLanguageModel.pendingPrompt) {
      return await new Promise<string>((_resolve, reject) =>
        options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
      );
    }
    if (AdvancedLanguageModel.promptError) throw AdvancedLanguageModel.promptError;
    if (options?.signal?.aborted) throw options.signal.reason;
    if (options?.responseConstraint) return '{"ok":true}';
    this.contextUsage += 2;
    return AdvancedLanguageModel.response;
  });
  promptStreaming = vi.fn(() => {
    if (AdvancedLanguageModel.streamError) return failingTextStream(AdvancedLanguageModel.streamError);
    if (AdvancedLanguageModel.pendingStream) {
      const pending = pendingTextStream();
      AdvancedLanguageModel.streamCancelled = pending.cancel;
      return pending.stream;
    }
    return textStream('one', 'two');
  });
  clone = vi.fn(async (options?: LanguageModelCloneOptions) => {
    if (options?.signal?.aborted) throw options.signal.reason;
    return new AdvancedLanguageModel();
  });
  destroy() {
    this.destroyed = true;
  }
}

const history = (count: number, size = 18): LanguageModelMessage[] =>
  Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `${index}:${'x'.repeat(size)}`
  }));

const cacheRecord = (overrides: Partial<LLMContextSummaryRecord> = {}): LLMContextSummaryRecord => ({
  id: 'cache',
  startIndex: 20,
  endIndex: 21,
  messageIds: [],
  hash: 'stale',
  summary: 'Stale',
  tokenUsage: null,
  level: 0,
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

describe('createPromptWorkflow advanced behavior', () => {
  beforeEach(() => {
    AdvancedLanguageModel.availabilityStatus = 'available';
    AdvancedLanguageModel.availabilityError = undefined;
    AdvancedLanguageModel.availability.mockClear();
    AdvancedLanguageModel.paramsError = undefined;
    AdvancedLanguageModel.params.mockClear();
    AdvancedLanguageModel.createError = undefined;
    AdvancedLanguageModel.createOptions = [];
    AdvancedLanguageModel.instances = [];
    AdvancedLanguageModel.contextWindowValue = 100;
    AdvancedLanguageModel.promptError = undefined;
    AdvancedLanguageModel.pendingPrompt = false;
    AdvancedLanguageModel.summaryError = undefined;
    AdvancedLanguageModel.response = 'response';
    AdvancedLanguageModel.summaryResponse = 'durable facts';
    AdvancedLanguageModel.streamError = undefined;
    AdvancedLanguageModel.pendingStream = false;
    AdvancedLanguageModel.streamCancelled = vi.fn();
    AdvancedLanguageModel.appendError = undefined;
    AdvancedLanguageModel.measureError = undefined;
    AdvancedLanguageModel.measure = (input) => promptText(input).length;
    vi.stubGlobal('LanguageModel', AdvancedLanguageModel);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('handles default params, support, availability, and lifecycle failures', async () => {
    const api = createPromptWorkflow();
    expect(api.state.getSnapshot().contextWindowAvailable).toBeNull();
    await expect(api.requestDefaultParams()).resolves.toMatchObject({ defaultTopK: 3 });
    expect(api.state.getSnapshot().defaultParams).toMatchObject({ maxTopK: 8 });
    AdvancedLanguageModel.paramsError = new Error('restricted');
    await expect(api.requestDefaultParams()).resolves.toBeNull();

    vi.stubGlobal('LanguageModel', {});
    await expect(api.requestDefaultParams()).resolves.toBeNull();
    await expect(api.checkAvailability()).resolves.toBe('unavailable');
    await expect(api.init()).rejects.toThrow('unavailable');
    await expect(api.create()).rejects.toThrow('not available in this browser context');

    vi.stubGlobal('LanguageModel', AdvancedLanguageModel);
    AdvancedLanguageModel.availabilityStatus = 'unavailable';
    const unavailable = createPromptWorkflow();
    await expect(unavailable.requestAvailability()).resolves.toBe('unavailable');
    await expect(unavailable.create()).rejects.toThrow('unavailable with the provided options');
  });

  it('merges modalities, tools, sampling, progress, and session metrics', async () => {
    const overflow = vi.fn();
    const api = createPromptWorkflow({ onContextOverflow: overflow });
    await api.init({
      expectedInputs: [{ type: 'text' }],
      expectedOutputs: [{ type: 'text' }],
      samplingMode: 'balanced'
    });
    const instance = (await api.create({
      expectedInputs: [{ type: 'image' }, { type: 'text' }],
      tools: [{ name: 'lookup', description: 'Lookup.', inputSchema: {}, execute: async () => 'ok' }],
      initialPrompts: [{ role: 'system', content: 'Stay concise.' }]
    })) as unknown as AdvancedLanguageModel;
    expect(AdvancedLanguageModel.createOptions.at(-1)).toMatchObject({
      expectedInputs: [{ type: 'image' }, { type: 'text' }],
      expectedOutputs: [{ type: 'text' }],
      samplingMode: 'balanced',
      signal: expect.any(AbortSignal)
    });
    expect(api.state.getSnapshot().session).toBe(instance);
    expect(api.state.getSnapshot().isReady).toBe(true);
    expect(api.state.getSnapshot().downloadProgress).toBe(100);
    expect(api.state.getSnapshot().temperature).toBe(0.8);
    expect(api.state.getSnapshot().topK).toBe(4);
    expect(api.state.getSnapshot().contextWindow).toBe(100);
    expect(api.state.getSnapshot().contextUsage).toBe(12);
    expect(api.state.getSnapshot().contextWindowAvailable).toBe(88);
    instance.contextUsage = 30;
    instance.dispatchEvent(new Event('contextoverflow'));
    expect(api.state.getSnapshot().contextUsage).toBe(30);
    expect(overflow).toHaveBeenCalledTimes(1);
    api.destroy();
    expect(instance.destroyed).toBe(true);
    expect(api.state.getSnapshot().contextWindow).toBeNull();
    api.dispose();
    expect(api.state.getSnapshot().availability).toBeNull();
  });

  it('checks first-create unavailability and protects newer operation ownership', async () => {
    AdvancedLanguageModel.availabilityStatus = 'unavailable';
    await expect(createPromptWorkflow().create()).rejects.toThrow('unavailable with the provided options');
    AdvancedLanguageModel.availabilityStatus = 'available';

    const api = createPromptWorkflow();
    const instance = (await api.create()) as unknown as AdvancedLanguageModel;
    instance.prompt.mockImplementationOnce(
      (_input, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
        )
    );
    const first = api.prompt('first');
    await vi.waitFor(() => expect(api.state.getSnapshot().isProcessing).toBe(true));
    const second = api.prompt('second');
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).resolves.toBe('response');
    expect(api.state.getSnapshot().processing).toBe('');
  });

  it('prompts, parses JSON, clones, appends, measures, and clears failure state', async () => {
    const api = createPromptWorkflow();
    await expect(api.prompt('missing')).rejects.toThrow('not initialized');
    await expect(api.clone()).rejects.toThrow('not initialized');
    await expect(api.append('missing')).rejects.toThrow('not initialized');
    await expect(api.measureContextUsage('missing')).rejects.toThrow('not initialized');
    await api.create();
    await expect(api.prompt('hello', { omitResponseConstraintInput: true })).resolves.toBe('response');
    await expect(api.promptJson<{ ok: boolean }>('json', { responseConstraint: { type: 'object' } })).resolves.toEqual({
      ok: true
    });
    const clone = await api.clone();
    expect(clone).toBeInstanceOf(AdvancedLanguageModel);
    await expect(api.append('context')).resolves.toBeUndefined();
    await expect(api.measureContextUsage('12345')).resolves.toBe(5);
    expect(api.state.getSnapshot().isProcessing).toBe(false);

    AdvancedLanguageModel.promptError = new Error('prompt failed');
    await expect(api.prompt('bad')).rejects.toThrow('prompt failed');
    AdvancedLanguageModel.promptError = undefined;
    AdvancedLanguageModel.appendError = new Error('append failed');
    await expect(api.append('bad')).rejects.toThrow('append failed');
    AdvancedLanguageModel.measureError = new Error('measure failed');
    await expect(api.measureContextUsage('bad')).rejects.toThrow('measure failed');
    expect(api.state.getSnapshot().processing).toBe('');
  });

  it('forwards successful streams, errors, and cancellation', async () => {
    const api = createPromptWorkflow();
    expect(() => api.promptStreaming('missing')).toThrow('not initialized');
    await api.create();
    const chunks: string[] = [];
    for await (const chunk of api.promptStreaming('stream')) chunks.push(chunk);
    expect(chunks).toEqual(['one', 'two']);
    expect(api.state.getSnapshot().processing).toBe('');

    AdvancedLanguageModel.streamError = new Error('stream failed');
    const failed = api.promptStreaming('failed');
    await expect(failed.getReader().read()).rejects.toThrow('stream failed');
    AdvancedLanguageModel.streamError = undefined;
    AdvancedLanguageModel.pendingStream = true;
    const pending = api.promptStreaming('pending');
    await pending.cancel('stop');
    expect(AdvancedLanguageModel.streamCancelled).toHaveBeenCalledWith('stop');
    expect(api.state.getSnapshot().isProcessing).toBe(false);
  });

  it('uses and always destroys temporary sessions, including timeout and failures', async () => {
    const api = createPromptWorkflow();
    vi.stubGlobal('LanguageModel', undefined);
    await expect(api.promptWithTemporarySession('input')).rejects.toThrow('not available');
    vi.stubGlobal('LanguageModel', AdvancedLanguageModel);
    await expect(
      api.promptWithTemporarySession('input', {
        modelOptions: { expectedInputs: [{ type: 'text' }] },
        promptOptions: { omitResponseConstraintInput: true }
      })
    ).resolves.toBe('response');
    expect(AdvancedLanguageModel.instances.at(-1)?.destroyed).toBe(true);

    AdvancedLanguageModel.promptError = new Error('temporary failed');
    await expect(api.promptWithTemporarySession('input')).rejects.toThrow('temporary failed');
    expect(AdvancedLanguageModel.instances.at(-1)?.destroyed).toBe(true);

    vi.useFakeTimers();
    AdvancedLanguageModel.promptError = undefined;
    AdvancedLanguageModel.pendingPrompt = true;
    const pending = api.promptWithTemporarySession('input', { timeoutMs: 5 });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1_000);
    await rejected;
    expect(AdvancedLanguageModel.instances.at(-1)?.destroyed).toBe(true);
  });

  it('restores an empty session and reports lifecycle callbacks', async () => {
    const api = createPromptWorkflow();
    const onStateChange = vi.fn();
    const callbacks = {
      onInitStart: vi.fn(),
      onInitComplete: vi.fn(),
      onCreateStart: vi.fn(),
      onCreateComplete: vi.fn()
    };
    const result = await api.restoreSession([], { autoCreate: true, onStateChange, ...callbacks });
    expect(result).toEqual({
      ready: true,
      selectedMessages: [],
      selectedConversationCount: 0,
      totalConversationCount: 0,
      summarizedMessages: 0,
      partiallyLoaded: false
    });
    expect(callbacks.onInitStart).toHaveBeenCalledOnce();
    expect(callbacks.onInitComplete).toHaveBeenCalledOnce();
    expect(callbacks.onCreateStart).toHaveBeenCalledOnce();
    expect(callbacks.onCreateComplete).toHaveBeenCalledOnce();
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }), 'complete');
  });

  it('stops restoration for policy, availability, and continuation gates', async () => {
    const api = createPromptWorkflow();
    const messages = history(2);
    await expect(api.restoreSession(messages)).resolves.toMatchObject({ ready: false, totalConversationCount: 2 });

    AdvancedLanguageModel.availabilityStatus = 'downloadable';
    await expect(api.restoreSession(messages, { autoCreate: true })).resolves.toMatchObject({ ready: false });
    AdvancedLanguageModel.availabilityStatus = 'available';

    let checks = 0;
    await expect(
      api.restoreSession(messages, { autoCreate: true, shouldContinue: () => ++checks < 1 })
    ).resolves.toMatchObject({ ready: false, selectedMessages: [] });

    checks = 0;
    await expect(
      api.restoreSession(messages, { autoCreate: true, shouldContinue: () => ++checks < 2 })
    ).resolves.toMatchObject({ ready: false, selectedMessages: [] });
  });

  it('restores all history when no budget exists or the full transcript fits', async () => {
    AdvancedLanguageModel.contextWindowValue = undefined;
    const api = createPromptWorkflow();
    const system = { role: 'system' as const, content: 'System' };
    const messages = history(3, 2);
    const noBudget = await api.restoreSession([system, ...messages], { autoCreate: true, budgetRatio: Number.NaN });
    expect(noBudget).toMatchObject({ ready: true, selectedConversationCount: 3, partiallyLoaded: false });
    expect(AdvancedLanguageModel.createOptions.at(-1)?.initialPrompts).toEqual([system, ...messages]);

    AdvancedLanguageModel.contextWindowValue = 1_000;
    const fits = await api.restoreSession(messages, { autoCreate: true, budgetRatio: 2 });
    expect(fits.selectedConversationCount).toBe(3);

    AdvancedLanguageModel.contextWindowValue = undefined;
    const withoutSystem = await api.restoreSession(messages, { autoCreate: true });
    expect(withoutSystem.selectedMessages).toEqual(messages);
  });

  it('keeps the newest messages when history exceeds the context budget', async () => {
    AdvancedLanguageModel.measure = (input) => (Array.isArray(input) ? input.length * 30 : promptText(input).length);
    const api = createPromptWorkflow();
    const messages = history(5, 2);
    const result = await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'recent',
      budgetRatio: 0.5
    });
    expect(result).toMatchObject({ ready: true, selectedConversationCount: 1, totalConversationCount: 5 });
    expect(result.partiallyLoaded).toBe(true);
    expect(result.selectedMessages).toEqual(messages.slice(-1));
    expect(api.state.getSnapshot().contextRestoreState).toMatchObject({ phase: 'ready', includedMessages: 1 });
  });

  it('handles failed context measurement and the post-fit continuation gate', async () => {
    const api = createPromptWorkflow();
    AdvancedLanguageModel.measureError = new Error('measurement unavailable');
    const measured = await api.restoreSession(history(3, 2), {
      autoCreate: true,
      strategy: 'recent',
      budgetRatio: 0.5
    });
    expect(measured.ready).toBe(true);
    expect(measured.selectedConversationCount).toBe(0);

    AdvancedLanguageModel.measureError = undefined;
    AdvancedLanguageModel.measure = (input) => (Array.isArray(input) ? input.length * 30 : promptText(input).length);
    let checks = 0;
    const stopped = await api.restoreSession(history(3, 2), {
      autoCreate: true,
      strategy: 'recent',
      budgetRatio: 0.5,
      shouldContinue: () => ++checks < 3
    });
    expect(stopped).toMatchObject({ ready: false, selectedConversationCount: 1, totalConversationCount: 3 });
  });

  it('summarizes omitted history eagerly and persists reusable cache records', async () => {
    AdvancedLanguageModel.measure = (input) => {
      if (!Array.isArray(input)) return promptText(input).length;
      if (promptText(input).includes('Summary of earlier conversation')) return 40;
      return input.length * 30;
    };
    const api = createPromptWorkflow();
    const messages = history(5, 2);
    const metadata = messages.map((_message, index) => ({ id: `m${index}`, timestamp: index + 1 }));
    let cache: LLMContextSummaryRecord[] = [];
    const update = vi.fn((records: LLMContextSummaryRecord[]) => {
      cache = records;
    });
    const first = await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'summarize',
      summaryMode: 'eager',
      budgetRatio: 0.5,
      messageMetadata: metadata,
      onSummaryCacheUpdate: update
    });
    expect(first.ready).toBe(true);
    expect(first.summarizedMessages).toBeGreaterThan(0);
    expect(first.selectedMessages[0]?.role).toBe('system');
    expect(cache.length).toBeGreaterThan(0);
    expect(update).toHaveBeenCalled();

    const summaryPromptsBefore = AdvancedLanguageModel.instances.reduce(
      (total, instance) =>
        total + instance.prompt.mock.calls.filter(([input]) => promptText(input).includes('Summarize')).length,
      0
    );
    const second = await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'summarize',
      summaryMode: 'eager',
      budgetRatio: 0.5,
      messageMetadata: metadata,
      summaryCache: cache
    });
    const summaryPromptsAfter = AdvancedLanguageModel.instances.reduce(
      (total, instance) =>
        total + instance.prompt.mock.calls.filter(([input]) => promptText(input).includes('Summarize')).length,
      0
    );
    expect(second.summarizedMessages).toBe(first.summarizedMessages);
    expect(summaryPromptsAfter).toBe(summaryPromptsBefore);
    expect(api.state.getSnapshot().contextRestoreState.cachedSummaries).toBeGreaterThan(0);
  });

  it('normalizes cache input, summarizes array content, truncates transcripts, and uses a one-message window', async () => {
    AdvancedLanguageModel.measure = (input) => {
      const text = promptText(input);
      if (text.includes('Summarize the earlier chat history') || text.includes('Summary of earlier conversation'))
        return 10;
      return 100;
    };
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(123);
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const api = createPromptWorkflow();
    let persisted: LLMContextSummaryRecord[] = [];
    const messages: LanguageModelMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', value: 'textual detail' },
          { type: 'image', value: new Blob(['image']) }
        ]
      }
    ];
    const invalid = [
      cacheRecord({ id: '' }),
      cacheRecord({ summary: '' }),
      cacheRecord({ startIndex: -1 }),
      cacheRecord({ endIndex: 20 }),
      cacheRecord({ hash: undefined as unknown as string }),
      cacheRecord({
        id: 'valid-a',
        level: 2,
        startIndex: 3,
        endIndex: 5,
        messageIds: undefined as unknown as string[]
      }),
      cacheRecord({ id: 'valid-b', level: 1, startIndex: 4, endIndex: 6, tokenUsage: undefined as unknown as number }),
      cacheRecord({ id: 'valid-c', level: 1, startIndex: 3, endIndex: 6 }),
      cacheRecord({ id: 'valid-d', level: 1, startIndex: 3, endIndex: 7, hash: 'other' }),
      cacheRecord({ id: 'normalized-level', level: 1.5, startIndex: 8, endIndex: 9 }),
      cacheRecord({ id: 'duplicate', level: 1, startIndex: 3, endIndex: 6 })
    ];
    const result = await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'summarize',
      summaryMode: 'eager',
      budgetRatio: 0.5,
      summaryMaxCharacters: 5,
      messageMetadata: [{ id: 'array-message' }],
      summaryCache: invalid,
      onSummaryCacheUpdate: (records) => {
        persisted = records;
      }
    });
    expect(result.summarizedMessages).toBe(1);
    expect(persisted.some((record) => record.id === '123-0.25')).toBe(true);
    expect(
      promptText(
        AdvancedLanguageModel.instances.find((instance) => instance.prompt.mock.calls.length)?.prompt.mock.calls[0]?.[0]
      )
    ).toContain('etail');
  });

  it('creates eager rollups and then consumes cached base and rollup records', async () => {
    AdvancedLanguageModel.measure = (input) => {
      const text = promptText(input);
      if (text.includes('Summarize the earlier chat history')) return 10;
      if (text.includes('System instructions:')) return 100;
      return Array.isArray(input) ? input.length * 30 : text.length;
    };
    const api = createPromptWorkflow();
    const system = { role: 'system' as const, content: 'Keep the original system policy.' };
    const messages = history(5, 2);
    const metadata = messages.map((_message, index) => ({ id: `rollup-${index}` }));
    let cache: LLMContextSummaryRecord[] = [];
    const eager = await api.restoreSession([system, ...messages], {
      autoCreate: true,
      strategy: 'summarize',
      summaryMode: 'eager',
      budgetRatio: 0.5,
      summaryChunkBudgetRatio: 0.95,
      messageMetadata: metadata,
      onSummaryCacheUpdate: (records) => {
        cache = records;
      }
    });
    expect(eager.summarizedMessages).toBeGreaterThan(0);
    expect(cache.some((record) => record.level === 4)).toBe(true);

    const promptCalls = AdvancedLanguageModel.instances.reduce(
      (count, instance) => count + instance.prompt.mock.calls.length,
      0
    );
    const cached = await api.restoreSession([system, ...messages], {
      autoCreate: true,
      strategy: 'summarize',
      summaryMode: 'cache-first',
      budgetRatio: 0.5,
      summaryChunkBudgetRatio: 0.95,
      messageMetadata: metadata,
      summaryCache: cache
    });
    expect(cached.summarizedMessages).toBe(eager.summarizedMessages);
    expect(api.state.getSnapshot().contextRestoreState.cachedSummaries).toBeGreaterThan(1);
    const nextPromptCalls = AdvancedLanguageModel.instances.reduce(
      (count, instance) => count + instance.prompt.mock.calls.length,
      0
    );
    expect(nextPromptCalls).toBe(promptCalls);

    const cachedEager = await api.restoreSession([system, ...messages], {
      autoCreate: true,
      strategy: 'summarize',
      summaryMode: 'eager',
      budgetRatio: 0.5,
      summaryChunkBudgetRatio: 0.95,
      messageMetadata: metadata,
      summaryCache: cache
    });
    expect(cachedEager.summarizedMessages).toBe(eager.summarizedMessages);
  });

  it('warms missing cache-first summaries in the background', async () => {
    vi.useFakeTimers();
    AdvancedLanguageModel.measure = (input) => {
      const text = promptText(input);
      if (text.includes('Summarize the earlier chat history')) return 10;
      if (text.includes('Summary of earlier conversation')) return 40;
      return Array.isArray(input) ? input.length * 30 : text.length;
    };
    const api = createPromptWorkflow();
    const messages = history(5, 2);
    let cache: LLMContextSummaryRecord[] = [];
    const first = await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'summarize',
      budgetRatio: 0.5,
      summaryBackgroundTimeoutMs: 2_000,
      onSummaryCacheUpdate: (records) => {
        cache = records;
      }
    });
    expect(first.summarizedMessages).toBe(0);
    expect(cache).toEqual([]);
    await vi.runAllTimersAsync();
    expect(cache.length).toBeGreaterThan(0);

    const second = await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'summarize',
      budgetRatio: 0.5,
      summaryCache: cache
    });
    expect(second.summarizedMessages).toBeGreaterThan(0);

    AdvancedLanguageModel.measure = (input) => {
      const text = promptText(input);
      if (text.includes('Summarize the earlier chat history')) return 10;
      if (text.includes('System instructions:')) return 100;
      return Array.isArray(input) ? input.length * 30 : text.length;
    };
    vi.stubGlobal('window', undefined);
    const noBackgroundRollup = await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'summarize',
      budgetRatio: 0.5,
      summaryCache: cache
    });
    expect(noBackgroundRollup.summarizedMessages).toBe(0);
    const noBackgroundBase = await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'summarize',
      budgetRatio: 0.5,
      summaryCache: []
    });
    expect(noBackgroundBase.summarizedMessages).toBe(0);
  });

  it.each(['prompt', 'promptStreaming', 'append', 'measureContextUsage', 'clone'] as const)(
    'preserves scheduled cache warming when restoration is immediately followed by %s',
    async (method) => {
      vi.useFakeTimers();
      AdvancedLanguageModel.measure = (input) => {
        const text = promptText(input);
        if (text.includes('Summary of earlier conversation')) return 40;
        return Array.isArray(input) ? input.length * 30 : text.length;
      };
      const api = createPromptWorkflow();
      let cache: LLMContextSummaryRecord[] = [];
      await api.restoreSession(history(5, 2), {
        autoCreate: true,
        summaryMode: 'cache-first',
        budgetRatio: 0.5,
        onSummaryCacheUpdate: (records) => {
          cache = records;
        }
      });
      expect(cache).toEqual([]);
      if (method === 'promptStreaming') {
        for await (const chunk of api.promptStreaming('Continue')) expect(chunk).toBeTruthy();
      } else if (method === 'clone') {
        (await api.clone()).destroy();
      } else {
        await api[method]('Continue');
      }
      await vi.runAllTimersAsync();
      expect(cache.length).toBeGreaterThan(0);
      const next = await api.restoreSession(history(5, 2), {
        autoCreate: true,
        summaryMode: 'cache-first',
        budgetRatio: 0.5,
        summaryCache: cache
      });
      expect(next.summarizedMessages).toBeGreaterThan(0);
      api.dispose();
    }
  );

  it('preserves a running background summary while a foreground prompt is superseded', async () => {
    vi.useFakeTimers();
    AdvancedLanguageModel.measure = (input) => (Array.isArray(input) ? input.length * 30 : promptText(input).length);
    const api = createPromptWorkflow();
    const onSummaryCacheUpdate = vi.fn();
    await api.restoreSession(history(5, 2), {
      autoCreate: true,
      summaryMode: 'cache-first',
      budgetRatio: 0.5,
      onSummaryCacheUpdate
    });
    const primary = AdvancedLanguageModel.instances.at(-1)!;
    expect(api.state.getSnapshot().session).toBe(primary);
    const summary = deferred<string>();
    const originalCreate = AdvancedLanguageModel.create;
    vi.spyOn(AdvancedLanguageModel, 'create').mockImplementationOnce(async (options) => {
      const session = await originalCreate(options);
      session.prompt.mockReturnValueOnce(summary.promise);
      return session;
    });
    await vi.advanceTimersByTimeAsync(0);
    const temporary = AdvancedLanguageModel.instances.at(-1)!;
    expect(temporary.prompt).toHaveBeenCalledOnce();
    const summarySignal = temporary.prompt.mock.calls[0]?.[1]?.signal;
    const pending = deferred<string>();
    primary.prompt.mockReturnValueOnce(pending.promise);
    const foreground = api.prompt('Continue');
    const rejected = expect(foreground).rejects.toMatchObject({ name: 'AbortError' });
    await api.measureContextUsage('New measurement');
    await rejected;
    expect(summarySignal?.aborted).toBe(false);
    expect(temporary.destroyed).toBe(false);
    summary.resolve('Background facts');
    pending.resolve('Obsolete foreground response');
    await vi.runAllTimersAsync();
    expect(onSummaryCacheUpdate).toHaveBeenCalled();
    expect(temporary.destroyed).toBe(true);
    expect(api.state.getSnapshot()).toMatchObject({ session: primary, processing: '' });
    api.dispose();
  });

  it.each(['interrupt', 'init', 'create', 'restoreSession', 'destroy', 'dispose'] as const)(
    'cancels scheduled summaries when %s invalidates their conversation',
    async (method) => {
      vi.useFakeTimers();
      AdvancedLanguageModel.measure = (input) => (Array.isArray(input) ? input.length * 30 : promptText(input).length);
      const api = createPromptWorkflow();
      const onSummaryCacheUpdate = vi.fn();
      await api.restoreSession(history(5, 2), {
        autoCreate: true,
        summaryMode: 'cache-first',
        budgetRatio: 0.5,
        onSummaryCacheUpdate
      });
      if (method === 'restoreSession') await api.restoreSession([], { autoCreate: true });
      else await api[method]();
      const instances = AdvancedLanguageModel.instances.length;
      await vi.runAllTimersAsync();
      expect(AdvancedLanguageModel.instances).toHaveLength(instances);
      expect(onSummaryCacheUpdate).not.toHaveBeenCalled();
      api.dispose();
    }
  );

  it('reports background base-summary and rollup failures', async () => {
    vi.useFakeTimers();
    AdvancedLanguageModel.measure = (input) => {
      const text = promptText(input);
      if (text.includes('Summarize the earlier chat history')) return 10;
      if (text.includes('System instructions:')) return 100;
      return Array.isArray(input) ? input.length * 30 : text.length;
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onError = vi.fn();
    const api = createPromptWorkflow();
    const messages = history(5, 2);

    AdvancedLanguageModel.summaryError = new Error('background base failed');
    await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'summarize',
      budgetRatio: 0.5,
      onSummaryCacheError: onError
    });
    await vi.runAllTimersAsync();
    expect(onError).toHaveBeenCalledWith(AdvancedLanguageModel.summaryError);

    AdvancedLanguageModel.summaryError = undefined;
    let baseCache: LLMContextSummaryRecord[] = [];
    await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'summarize',
      budgetRatio: 0.5,
      onSummaryCacheUpdate: (records) => {
        baseCache = records;
      }
    });
    await vi.runAllTimersAsync();
    expect(baseCache.length).toBeGreaterThan(0);

    AdvancedLanguageModel.summaryError = new Error('background rollup failed');
    await api.restoreSession(messages, {
      autoCreate: true,
      strategy: 'summarize',
      budgetRatio: 0.5,
      summaryCache: baseCache,
      onSummaryCacheError: onError
    });
    await vi.runAllTimersAsync();
    expect(onError).toHaveBeenCalledWith(AdvancedLanguageModel.summaryError);
    expect(warn).toHaveBeenCalled();
  });

  it('falls back to recent history when eager summarization fails', async () => {
    AdvancedLanguageModel.measure = (input) => (Array.isArray(input) ? input.length * 30 : promptText(input).length);
    AdvancedLanguageModel.summaryError = new Error('summary failed');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = createPromptWorkflow();
    const result = await api.restoreSession(history(5, 2), {
      autoCreate: true,
      strategy: 'summarize',
      summaryMode: 'eager',
      budgetRatio: 0.5
    });
    expect(result.ready).toBe(true);
    expect(result.summarizedMessages).toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it('marks restoration errors and leaves a cloned state snapshot', async () => {
    AdvancedLanguageModel.createError = new Error('create failed');
    const state = vi.fn();
    const api = createPromptWorkflow();
    await expect(api.restoreSession([], { autoCreate: true, onStateChange: state })).rejects.toThrow('create failed');
    expect(api.state.getSnapshot().contextRestoreState.phase).toBe('error');
    const reported = state.mock.calls.at(-1)?.[0];
    expect(reported).not.toBe(api.state.getSnapshot().contextRestoreState);
  });
});
