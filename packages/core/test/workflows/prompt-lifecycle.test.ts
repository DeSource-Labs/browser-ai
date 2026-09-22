import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPromptWorkflow } from '../../src/workflows/prompt';
import { deferred, flushPromises, pendingTextStream, textStream } from '../helpers';

class Session extends EventTarget {
  contextWindow = 100;
  contextUsage = 2;
  destroy = vi.fn();
  prompt = vi.fn(async (_input: LanguageModelPrompt, _options?: LanguageModelPromptOptions) => 'answer');
  append = vi.fn(async (_input: LanguageModelPrompt, _options?: LanguageModelAppendOptions) => undefined);
  measureContextUsage = vi.fn(async (input: LanguageModelPrompt, _options?: LanguageModelPromptOptions) =>
    Array.isArray(input) ? input.length * 30 : 30
  );
  promptStreaming = vi.fn((_input: LanguageModelPrompt, _options?: LanguageModelPromptOptions) => textStream('answer'));
  clone = vi.fn(async (_options?: LanguageModelCloneOptions) => new Session());
}
const messages: LanguageModelMessage[] = [
  { role: 'user', content: 'First question' },
  { role: 'assistant', content: 'First answer' },
  { role: 'user', content: 'Second question' },
  { role: 'assistant', content: 'Second answer' }
];

const availability = vi.fn(async (): Promise<Availability> => 'available');
const create = vi.fn(async (_options?: LanguageModelCreateOptions): Promise<Session> => new Session());
const params = vi.fn(async (): Promise<LanguageModelParams | null> => null);

beforeEach(() => {
  availability.mockReset().mockResolvedValue('available');
  create.mockReset().mockImplementation(async () => new Session());
  params.mockReset().mockResolvedValue(null);
  vi.stubGlobal('LanguageModel', { availability, create, params });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Prompt workflow cancellation', () => {
  it.each(['create', 'init', 'restoreSession'] as const)('cancels %s while availability is pending', async (method) => {
    const pending = deferred<Availability>();
    availability.mockReturnValueOnce(pending.promise);
    const api = createPromptWorkflow();
    const operation = method === 'restoreSession' ? api.restoreSession(messages, { autoCreate: true }) : api[method]();
    const rejection = expect(operation).rejects.toMatchObject({ name: 'AbortError' });
    api.dispose();
    await rejection;
    pending.resolve('available');
    await flushPromises();
    expect(create).not.toHaveBeenCalled();
    expect(api.state.getSnapshot()).toMatchObject({
      session: null,
      availability: null,
      processing: '',
      contextRestoreState: { phase: 'idle' }
    });
  });

  it('destroys a late native session without replacing the newer session or clearing its operation', async () => {
    const pending = deferred<Session>();
    create.mockReturnValueOnce(pending.promise);
    const api = createPromptWorkflow();
    const oldCreate = api.create();
    const rejection = expect(oldCreate).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
    const creationOptions = create.mock.calls[0]?.[0];
    const replacement = await api.create();
    await rejection;
    expect(creationOptions?.signal?.aborted).toBe(true);
    const promptResult = deferred<string>();
    const active = create.mock.results[1];
    const newSession = (await active?.value) as Session;
    newSession.prompt.mockReturnValueOnce(promptResult.promise);
    const prompt = api.prompt('new request');
    const lateSession = new Session();
    pending.resolve(lateSession);
    await flushPromises();
    expect(lateSession.destroy).toHaveBeenCalledOnce();
    expect(api.state.getSnapshot()).toMatchObject({ session: replacement, processing: 'prompt' });
    promptResult.resolve('new answer');
    await expect(prompt).resolves.toBe('new answer');
    api.dispose();
  });

  it('keeps the created session reusable after an interrupted restoration measurement', async () => {
    const session = new Session();
    const pending = deferred<number>();
    session.measureContextUsage.mockReturnValueOnce(pending.promise);
    create.mockImplementationOnce(async (options) => {
      options?.signal?.addEventListener('abort', session.destroy);
      return session;
    });
    const api = createPromptWorkflow();
    const restoration = api.restoreSession(messages, { autoCreate: true, strategy: 'recent' });
    const rejected = expect(restoration).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(session.measureContextUsage).toHaveBeenCalledOnce());
    api.interrupt();
    await rejected;
    expect(session.measureContextUsage.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(session.destroy).not.toHaveBeenCalled();
    await expect(api.prompt('Use the surviving session')).resolves.toBe('answer');
    pending.resolve(1);
    await flushPromises();
    expect(create).toHaveBeenCalledOnce();
    api.dispose();
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it.each(['prompt', 'append', 'measureContextUsage'] as const)(
    'ignores obsolete %s results from a native implementation that ignores abort',
    async (method) => {
      const session = new Session();
      const pending = deferred<never>();
      session[method].mockImplementationOnce(() => pending.promise);
      create.mockResolvedValueOnce(session);
      const api = createPromptWorkflow();
      await api.create();
      const operation = api[method]('obsolete');
      const rejected = expect(operation).rejects.toMatchObject({ name: 'AbortError' });
      const next = deferred<string>();
      session.prompt.mockReturnValueOnce(next.promise);
      const replacement = api.prompt('current');
      await rejected;
      expect(api.state.getSnapshot().processing).toBe('prompt');
      session.contextUsage = 99;
      pending.reject(new Error('obsolete native failure'));
      await flushPromises();
      expect(api.state.getSnapshot().contextUsage).toBe(2);
      expect(api.state.getSnapshot().processing).toBe('prompt');
      next.resolve('current answer');
      await replacement;
      expect(api.state.getSnapshot().contextUsage).toBe(99);
      api.dispose();
    }
  );

  it('cancels late cloning without leaking the clone', async () => {
    const session = new Session();
    const pending = deferred<Session>();
    session.clone.mockReturnValueOnce(pending.promise);
    create.mockResolvedValueOnce(session);
    const api = createPromptWorkflow();
    await api.create();
    const cloned = api.clone();
    const rejected = expect(cloned).rejects.toMatchObject({ name: 'AbortError' });
    api.destroy();
    await rejected;
    const lateClone = new Session();
    pending.resolve(lateClone);
    await flushPromises();
    expect(lateClone.destroy).toHaveBeenCalledOnce();
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it('discards stale availability and parameter responses after disposal', async () => {
    const status = deferred<Availability>();
    const defaults = deferred<LanguageModelParams>();
    availability.mockReturnValueOnce(status.promise);
    params.mockReturnValueOnce(defaults.promise);
    const api = createPromptWorkflow();
    const checks = [api.requestAvailability(), api.requestDefaultParams()];
    api.dispose();
    status.resolve('available');
    defaults.resolve({ defaultTopK: 1 } as LanguageModelParams);
    await Promise.all(checks);
    expect(api.state.getSnapshot()).toMatchObject({ availability: null, defaultParams: null, processing: '' });
  });

  it('does not let an availability refresh clear a running prompt', async () => {
    const session = new Session();
    const pending = deferred<string>();
    session.prompt.mockReturnValueOnce(pending.promise);
    create.mockResolvedValueOnce(session);
    const api = createPromptWorkflow();
    await api.create();
    const prompt = api.prompt('Wait');
    await api.requestAvailability();
    expect(api.state.getSnapshot().processing).toBe('prompt');
    pending.resolve('done');
    await prompt;
    api.dispose();
  });

  it('aborts and destroys a temporary session even before create resolves', async () => {
    const pending = deferred<Session>();
    create.mockReturnValueOnce(pending.promise);
    const api = createPromptWorkflow();
    const temporary = api.promptWithTemporarySession('temporary');
    const rejected = expect(temporary).rejects.toMatchObject({ name: 'AbortError' });
    api.dispose();
    await rejected;
    expect(create.mock.calls[0]?.[0]?.signal?.aborted).toBe(true);
    const late = new Session();
    pending.resolve(late);
    await flushPromises();
    expect(late.destroy).toHaveBeenCalledOnce();
    expect(late.prompt).not.toHaveBeenCalled();
  });

  it('aborts temporary creation on timeout without waiting for native cooperation', async () => {
    vi.useFakeTimers();
    const pending = deferred<Session>();
    create.mockReturnValueOnce(pending.promise);
    const api = createPromptWorkflow();
    const temporary = api.promptWithTemporarySession('temporary', { timeoutMs: 1000 });
    const rejected = expect(temporary).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    const late = new Session();
    pending.resolve(late);
    await vi.advanceTimersByTimeAsync(0);
    expect(late.destroy).toHaveBeenCalledOnce();
    api.dispose();
  });

  it('cancels eager summaries and prevents stale cache writes or restoration', async () => {
    const temporary = new Session();
    const summary = deferred<string>();
    temporary.prompt.mockReturnValueOnce(summary.promise);
    create.mockResolvedValueOnce(new Session()).mockResolvedValueOnce(temporary);
    const onSummaryCacheUpdate = vi.fn();
    const onStateChange = vi.fn();
    const api = createPromptWorkflow();
    const restoration = api.restoreSession(messages, {
      autoCreate: true,
      summaryMode: 'eager',
      onSummaryCacheUpdate,
      onStateChange
    });
    const rejected = expect(restoration).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(temporary.prompt).toHaveBeenCalledOnce());
    api.dispose();
    const eventCount = onStateChange.mock.calls.length;
    await rejected;
    summary.resolve('old summary');
    await flushPromises();
    expect(temporary.destroy).toHaveBeenCalledOnce();
    expect(onSummaryCacheUpdate).not.toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledTimes(eventCount);
    expect(create).toHaveBeenCalledTimes(2);
    expect(api.state.getSnapshot().contextRestoreState.phase).toBe('idle');
  });

  it('removes scheduled background summaries when disposed', async () => {
    vi.useFakeTimers();
    const api = createPromptWorkflow();
    const onSummaryCacheUpdate = vi.fn();
    await api.restoreSession(messages, { autoCreate: true, summaryMode: 'cache-first', onSummaryCacheUpdate });
    expect(create).toHaveBeenCalledTimes(2);
    api.dispose();
    await vi.runAllTimersAsync();
    expect(create).toHaveBeenCalledTimes(2);
    expect(onSummaryCacheUpdate).not.toHaveBeenCalled();
  });

  it('cancels running background summaries without reporting disposal as a cache error', async () => {
    const summary = deferred<string>();
    const temporary = new Session();
    temporary.prompt.mockReturnValueOnce(summary.promise);
    create.mockResolvedValueOnce(new Session()).mockResolvedValueOnce(new Session()).mockResolvedValueOnce(temporary);
    const onSummaryCacheError = vi.fn();
    const onSummaryCacheUpdate = vi.fn();
    const api = createPromptWorkflow();
    await api.restoreSession(messages, {
      autoCreate: true,
      summaryMode: 'cache-first',
      onSummaryCacheError,
      onSummaryCacheUpdate
    });
    await vi.waitFor(() => expect(temporary.prompt).toHaveBeenCalledOnce());
    api.dispose();
    summary.resolve('stale summary');
    await flushPromises();
    expect(temporary.destroy).toHaveBeenCalledOnce();
    expect(onSummaryCacheError).not.toHaveBeenCalled();
    expect(onSummaryCacheUpdate).not.toHaveBeenCalled();
  });

  it('always ends restoration if a lifecycle callback throws or interrupts it', async () => {
    const api = createPromptWorkflow();
    await expect(
      api.restoreSession([], {
        autoCreate: true,
        onStateChange: () => {
          throw new Error('callback failure');
        }
      })
    ).rejects.toThrow('callback failure');
    expect(api.state.getSnapshot().processing).toBe('');
    await expect(
      api.restoreSession([], { autoCreate: true, onCreateComplete: () => api.dispose() })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.state.getSnapshot().contextRestoreState.phase).toBe('idle');
  });
});

describe('Prompt workflow stream ownership', () => {
  it('releases the native reader after completion', async () => {
    const stream = textStream('one', 'two');
    const session = new Session();
    session.promptStreaming.mockReturnValueOnce(stream);
    create.mockResolvedValueOnce(session);
    const api = createPromptWorkflow();
    await api.create();
    const response = api.promptStreaming('input');
    const chunks: string[] = [];
    for await (const chunk of response) chunks.push(chunk);
    expect(chunks).toEqual(['one', 'two']);
    expect(stream.locked).toBe(false);
    api.dispose();
  });

  it('cancels and releases a blocked reader when interrupted', async () => {
    const pending = pendingTextStream();
    const session = new Session();
    session.promptStreaming.mockReturnValueOnce(pending.stream);
    create.mockResolvedValueOnce(session);
    const api = createPromptWorkflow();
    await api.create();
    const response = api.promptStreaming('input');
    const reader = response.getReader();
    const read = reader.read();
    const rejected = expect(read).rejects.toMatchObject({ name: 'AbortError' });
    api.interrupt();
    await rejected;
    expect(pending.cancelled).toHaveBeenCalledOnce();
    expect(pending.stream.locked).toBe(false);
    reader.releaseLock();
    api.dispose();
  });

  it('clears processing after synchronous native stream setup failure', async () => {
    const session = new Session();
    session.promptStreaming.mockImplementationOnce(() => {
      throw new Error('stream setup');
    });
    create.mockResolvedValueOnce(session);
    const api = createPromptWorkflow();
    await api.create();
    expect(() => api.promptStreaming('input')).toThrow('stream setup');
    expect(api.state.getSnapshot().isProcessing).toBe(false);
    api.dispose();
  });
});
