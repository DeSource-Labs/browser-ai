import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslatorLanguageName, createTranslatorWorkflow } from '../../src/workflows';
import { emitDownloadProgress, failingTextStream, pendingTextStream, textStream } from '../workflow-helpers';

class FakeTranslator {
  static availabilityStatus: Availability = 'available';
  static availabilityError: unknown;
  static availability = vi.fn(async () => {
    if (FakeTranslator.availabilityError) throw FakeTranslator.availabilityError;
    return FakeTranslator.availabilityStatus;
  });
  static create = vi.fn(async (options: TranslatorCreateOptions) => {
    emitDownloadProgress(options, 3, 4);
    return new FakeTranslator(options.sourceLanguage, options.targetLanguage);
  });
  static measureError: unknown;
  static translateErrorInput = '';
  static streamError: unknown;
  static pendingStream = false;
  static streamCancelled = vi.fn();

  readonly inputQuota = 100;
  destroyed = false;
  measureInputUsage = vi.fn(async (input: string, options?: TranslatorTranslateOptions) => {
    if (FakeTranslator.measureError) throw FakeTranslator.measureError;
    if (options?.signal?.aborted) throw options.signal.reason;
    return input.length;
  });
  translate = vi.fn(async (input: string) => {
    if (input === FakeTranslator.translateErrorInput) throw new Error('translation failed');
    return `es:${input}`;
  });
  translateStreaming = vi.fn((input: string) => {
    if (FakeTranslator.streamError) return failingTextStream(FakeTranslator.streamError);
    if (FakeTranslator.pendingStream) {
      const pending = pendingTextStream();
      FakeTranslator.streamCancelled = pending.cancel;
      return pending.stream;
    }
    return textStream('es:', input);
  });

  constructor(
    readonly sourceLanguage: string,
    readonly targetLanguage: string
  ) {}

  destroy() {
    this.destroyed = true;
  }
}

const deferred = <Value>() => {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('createTranslatorWorkflow', () => {
  beforeEach(() => {
    FakeTranslator.availabilityStatus = 'available';
    FakeTranslator.availabilityError = undefined;
    FakeTranslator.availability.mockClear();
    FakeTranslator.create.mockClear();
    FakeTranslator.measureError = undefined;
    FakeTranslator.translateErrorInput = '';
    FakeTranslator.streamError = undefined;
    FakeTranslator.pendingStream = false;
    FakeTranslator.streamCancelled = vi.fn();
    vi.stubGlobal('Translator', FakeTranslator);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('labels languages and bypasses matching normalized language pairs', async () => {
    expect(getTranslatorLanguageName('es')).toBe('Spanish');
    expect(getTranslatorLanguageName('xx')).toBe('xx');
    const api = createTranslatorWorkflow({ sourceLanguage: ' EN ', targetLanguage: 'en' });
    await expect(api.checkAvailability()).resolves.toBe('available');
    await expect(api.init()).resolves.toBe('available');
    await expect(api.measureInputUsage('same')).resolves.toBe(0);
    const progress = vi.fn();
    await expect(
      api.translateWithDetails(' <b>same</b> ', { stripHtml: true, onProgress: progress })
    ).resolves.toMatchObject({
      translation: 'same',
      bypassed: true,
      inputUsage: 0
    });
    await expect(api.translateStreamingToText('streamed')).resolves.toBe('streamed');
    expect(api.state.getSnapshot().progressState).toMatchObject({ phase: 'ready', bypassed: true });
    expect(progress).toHaveBeenCalled();
    await expect(api.create()).rejects.toThrow('not needed');
  });

  it('handles constructor support, availability failures, and unavailable pairs', async () => {
    vi.stubGlobal('Translator', undefined);
    const unsupported = createTranslatorWorkflow();
    await expect(unsupported.checkAvailability()).resolves.toBe('unavailable');
    await expect(unsupported.init()).rejects.toThrow('unavailable for the provided language pair');
    await expect(unsupported.create()).rejects.toThrow('not available in this browser context');

    vi.stubGlobal('Translator', FakeTranslator);
    FakeTranslator.availabilityError = new Error('blocked');
    await expect(createTranslatorWorkflow().checkAvailability()).resolves.toBe('unavailable');
    FakeTranslator.availabilityError = undefined;
    FakeTranslator.availabilityStatus = 'unavailable';
    await expect(createTranslatorWorkflow().create()).rejects.toThrow('unavailable for the provided language pair');
  });

  it('creates, measures, reuses matching pairs, replaces changed pairs, and disposes', async () => {
    const api = createTranslatorWorkflow();
    expect(api.state.getSnapshot().inputQuotaAvailable).toBeNull();
    expect(api.state.getSnapshot().isReady).toBe(false);
    expect(api.state.getSnapshot().processing).toBe('');
    expect(api.state.getSnapshot().availability).toBeNull();
    expect(api.state.getSnapshot().inputUsage).toBeNull();
    expect(api.state.getSnapshot().inputQuota).toBeNull();
    await expect(api.requestAvailability()).resolves.toBe('available');
    const first = (await api.create()) as unknown as FakeTranslator;
    expect(api.state.getSnapshot().translator).toBe(first);
    expect(api.state.getSnapshot().downloadProgress).toBe(100);
    await expect(api.measureInputUsage(' <b>Hello</b> ', { stripHtml: true, autoCreate: false })).resolves.toBe(5);
    expect(api.state.getSnapshot().inputQuotaAvailable).toBe(95);

    await api.translate('one', { createOptions: { sourceLanguage: 'en', targetLanguage: 'es' } });
    expect(FakeTranslator.create).toHaveBeenCalledTimes(1);
    await api.translate('deux', { createOptions: { sourceLanguage: 'fr', targetLanguage: 'en' } });
    expect(FakeTranslator.create).toHaveBeenCalledTimes(2);
    expect(first.destroyed).toBe(true);

    const current = api.state.getSnapshot().translator as unknown as FakeTranslator;
    api.destroy();
    expect(current.destroyed).toBe(true);
    api.dispose();
    expect(api.state.getSnapshot().createOptions).toEqual({ sourceLanguage: 'en', targetLanguage: 'es' });
  });

  it('translates directly with normalized options and progress details', async () => {
    const api = createTranslatorWorkflow();
    const progress = vi.fn();
    const result = await api.translateWithDetails(' <p>Hello</p> ', {
      stripHtml: true,
      chunking: 'never',
      chunkBudgetRatio: Number.NaN,
      onProgress: progress
    });
    expect(result).toMatchObject({ translation: 'es:Hello', input: 'Hello', chunked: false, bypassed: false });
    expect(api.state.getSnapshot().lastResult).toEqual(result);
    expect(api.state.getSnapshot().output).toBe('es:Hello');
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
    await expect(api.translate('again', { autoCreate: false, chunkBudgetRatio: 2 })).resolves.toBe('es:again');
  });

  it('chunks oversized translations and preserves separators in streamed state', async () => {
    const input = Array.from({ length: 12 }, (_, index) => `Paragraph ${index} ${'word '.repeat(8)}`).join('\n\n');
    const api = createTranslatorWorkflow();
    const result = await api.translateWithDetails(input, { chunkBudgetRatio: 0 });
    expect(result.chunked).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.translation).toContain('\n\n');
    expect(result.chunks.every((chunk) => chunk.usage !== null)).toBe(true);

    const streamed = await api.translateStreamingToText(input, { chunkBudgetRatio: 0.4 });
    expect(streamed).toContain('\n\n');
    expect(api.state.getSnapshot().lastResult).toMatchObject({ translation: streamed, chunked: true });
  });

  it('streams a direct translation and records stream failures', async () => {
    const api = createTranslatorWorkflow();
    const onChunk = vi.fn();
    await expect(api.translateStreamingToText('hello', { chunking: 'never' }, onChunk)).resolves.toBe('es:hello');
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(api.state.getSnapshot().lastResult).toMatchObject({ translation: 'es:hello', chunks: [] });

    FakeTranslator.streamError = new Error('stream failed');
    await expect(api.translateStreamingToText('failed')).rejects.toThrow('stream failed');
    expect(api.state.getSnapshot().error).toBeInstanceOf(Error);
    expect(api.state.getSnapshot().progressState.phase).toBe('error');

    FakeTranslator.streamError = undefined;
    FakeTranslator.pendingStream = true;
    const stream = await api.translateStreaming('pending');
    await vi.waitFor(() => expect(api.state.getSnapshot().isProcessing).toBe(true));
    await stream.cancel('stop');
    expect(FakeTranslator.streamCancelled).toHaveBeenCalledWith('stop');
    expect(api.state.getSnapshot().isProcessing).toBe(false);
  });

  it('tolerates missing measurements, propagates aborts, and records translation errors', async () => {
    const api = createTranslatorWorkflow();
    FakeTranslator.measureError = new Error('measurement failed');
    await expect(api.translateWithDetails('input')).resolves.toMatchObject({ inputUsage: null, chunked: false });

    FakeTranslator.measureError = new DOMException('stopped', 'AbortError');
    await expect(api.translateWithDetails('input')).rejects.toMatchObject({ name: 'AbortError' });
    await expect(api.translateStreaming('input')).rejects.toMatchObject({ name: 'AbortError' });

    FakeTranslator.measureError = undefined;
    FakeTranslator.translateErrorInput = 'bad';
    await expect(api.translateWithDetails('bad')).rejects.toThrow('translation failed');
    expect(api.state.getSnapshot().error).toBeInstanceOf(Error);
  });

  it('runs batches with overrides, continuation, and fail-fast behavior', async () => {
    const api = createTranslatorWorkflow();
    FakeTranslator.translateErrorInput = 'bad';
    const batch = await api.translateMany(
      [
        { input: '<b>one</b>', stripHtml: true },
        { input: 'same', sourceLanguage: 'en', targetLanguage: 'en' },
        { input: 'bad' }
      ],
      { continueOnError: true }
    );
    expect(batch.results[0]?.translation).toBe('es:one');
    expect(batch.results[1]).toMatchObject({ bypassed: true });
    expect(batch.results[2]).toBeNull();
    expect(batch.failures).toHaveLength(1);
    await expect(api.translateMany([{ input: 'bad' }])).rejects.toThrow('translation failed');
  });

  it('requires explicit creation and can interrupt measurement', async () => {
    const api = createTranslatorWorkflow();
    await expect(api.translate('input', { autoCreate: false })).rejects.toThrow('not initialized');
    const instance = (await api.create()) as unknown as FakeTranslator;
    instance.measureInputUsage.mockImplementationOnce(
      (_input, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
        )
    );
    const pending = api.measureInputUsage('pending');
    await vi.waitFor(() => expect(api.state.getSnapshot().isProcessing).toBe(true));
    api.interrupt();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it.each(['availability', 'init', 'create', 'measure', 'translate', 'stream'] as const)(
    'does not continue %s after disposal during availability',
    async (method) => {
      const availability = deferred<Availability>();
      FakeTranslator.availability.mockImplementationOnce(() => availability.promise);
      const api = createTranslatorWorkflow();
      const pending =
        method === 'availability'
          ? api.requestAvailability()
          : method === 'init'
            ? api.init()
            : method === 'create'
              ? api.create()
              : method === 'measure'
                ? api.measureInputUsage('pending')
                : method === 'stream'
                  ? api.translateStreaming('pending')
                  : api.translate('pending');
      const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      expect(api.state.getSnapshot().isProcessing).toBe(true);
      api.dispose();
      const disposed = api.state.getSnapshot();
      availability.resolve('available');
      await rejected;
      expect(FakeTranslator.create).not.toHaveBeenCalled();
      expect(api.state.getSnapshot()).toBe(disposed);
    }
  );

  it.each(['create', 'measure', 'translate', 'stream'] as const)(
    'destroys late native instances after cancelling %s',
    async (method) => {
      const created = deferred<FakeTranslator>();
      FakeTranslator.create.mockImplementationOnce(() => created.promise);
      const api = createTranslatorWorkflow();
      const pending =
        method === 'create'
          ? api.create()
          : method === 'measure'
            ? api.measureInputUsage('pending')
            : method === 'stream'
              ? api.translateStreaming('pending')
              : api.translate('pending');
      const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      await vi.waitFor(() => expect(FakeTranslator.create).toHaveBeenCalledOnce());
      const options = FakeTranslator.create.mock.calls[0][0];
      api.dispose();
      const disposed = api.state.getSnapshot();
      emitDownloadProgress(options, 1, 2);
      const instance = new FakeTranslator('en', 'es');
      created.resolve(instance);
      await rejected;
      expect(instance.destroyed).toBe(true);
      expect(instance.measureInputUsage).not.toHaveBeenCalled();
      expect(api.state.getSnapshot()).toBe(disposed);
    }
  );

  it('ignores stale native results without clearing the newer operation', async () => {
    const api = createTranslatorWorkflow();
    const instance = (await api.create()) as unknown as FakeTranslator;
    const older = deferred<string>();
    const newer = deferred<string>();
    instance.translate.mockImplementationOnce(() => older.promise).mockImplementationOnce(() => newer.promise);
    const first = api.translate('first');
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(instance.translate).toHaveBeenCalledTimes(1));
    const second = api.translate('second');
    await vi.waitFor(() => expect(instance.translate).toHaveBeenCalledTimes(2));
    older.resolve('old answer');
    await rejected;
    expect(api.state.getSnapshot()).toMatchObject({
      processing: 'translate',
      output: '',
      error: null,
      lastResult: null
    });
    newer.resolve('new answer');
    await expect(second).resolves.toBe('new answer');
    expect(api.state.getSnapshot()).toMatchObject({ processing: '', output: 'new answer' });
  });

  it.each(['measure', 'translate', 'stream'] as const)(
    'stops %s after measurement ignores cancellation',
    async (method) => {
      const api = createTranslatorWorkflow();
      const instance = (await api.create()) as unknown as FakeTranslator;
      const usage = deferred<number>();
      instance.measureInputUsage.mockImplementationOnce(() => usage.promise);
      const pending =
        method === 'measure'
          ? api.measureInputUsage('pending')
          : method === 'stream'
            ? api.translateStreaming('pending')
            : api.translate('pending');
      const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      await vi.waitFor(() => expect(instance.measureInputUsage).toHaveBeenCalledOnce());
      api.dispose();
      const disposed = api.state.getSnapshot();
      usage.resolve(3);
      await rejected;
      expect(instance.translate).not.toHaveBeenCalled();
      expect(instance.translateStreaming).not.toHaveBeenCalled();
      expect(api.state.getSnapshot()).toBe(disposed);
    }
  );

  it('stops chunk planning when a progress handler interrupts', async () => {
    const api = createTranslatorWorkflow();
    const instance = (await api.create()) as unknown as FakeTranslator;
    await expect(
      api.translate('long paragraph '.repeat(20), {
        onProgress(progress) {
          if (progress.phase === 'chunking') api.interrupt();
        }
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(instance.translate).not.toHaveBeenCalled();
    expect(api.state.getSnapshot().isProcessing).toBe(false);
  });

  it('cancels a complete batch even when continueOnError is enabled', async () => {
    const api = createTranslatorWorkflow();
    const instance = (await api.create()) as unknown as FakeTranslator;
    const response = deferred<string>();
    instance.translate.mockImplementationOnce(() => response.promise);
    const pending = api.translateMany([{ input: 'one' }, { input: 'two' }], { continueOnError: true });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(instance.translate).toHaveBeenCalledOnce());
    api.interrupt();
    response.resolve('late answer');
    await rejected;
    expect(instance.translate).toHaveBeenCalledOnce();
    expect(api.state.getSnapshot()).toMatchObject({ processing: '', output: '', lastResult: null });
  });

  it('bypass requests supersede pending translations', async () => {
    const api = createTranslatorWorkflow();
    const instance = (await api.create()) as unknown as FakeTranslator;
    const response = deferred<string>();
    instance.translate.mockImplementationOnce(() => response.promise);
    const first = api.translate('first');
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(instance.translate).toHaveBeenCalledOnce());
    await expect(
      api.translate('same', { createOptions: { sourceLanguage: 'EN', targetLanguage: 'en' } })
    ).resolves.toBe('same');
    response.resolve('stale');
    await rejected;
    expect(api.state.getSnapshot()).toMatchObject({ output: 'same', processing: '', lastResult: { bypassed: true } });
  });

  it('reuses one native model across batch items with equal copied options', async () => {
    const api = createTranslatorWorkflow();
    const options = { sourceLanguage: 'en', targetLanguage: 'fr' };
    await api.translateMany([{ input: 'one' }, { input: 'two' }], { createOptions: options });
    await api.translate('three', { createOptions: { ...options } });
    expect(FakeTranslator.create).toHaveBeenCalledOnce();
  });

  it('keeps the created session alive when its first translation is interrupted', async () => {
    const api = createTranslatorWorkflow();
    const instance = new FakeTranslator('en', 'es');
    const response = deferred<string>();
    instance.translate.mockImplementationOnce(() => response.promise);
    FakeTranslator.create.mockImplementationOnce(async (options) => {
      options.signal?.addEventListener('abort', () => instance.destroy(), { once: true });
      return instance;
    });
    const pending = api.translate('first');
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(instance.translate).toHaveBeenCalledOnce());
    api.interrupt();
    expect(FakeTranslator.create.mock.calls[0][0].signal?.aborted).toBe(false);
    expect(instance.destroyed).toBe(false);
    response.resolve('obsolete');
    await rejected;
    await expect(api.translate('second')).resolves.toBe('es:second');
    expect(FakeTranslator.create).toHaveBeenCalledOnce();
    api.dispose();
    expect(instance.destroyed).toBe(true);
  });

  it('releases native stream readers after successful consumption and setup failures', async () => {
    const api = createTranslatorWorkflow();
    const instance = (await api.create()) as unknown as FakeTranslator;
    const stream = textStream('first', 'second');
    instance.translateStreaming.mockReturnValueOnce(stream);
    await expect(api.translateStreamingToText('input')).resolves.toBe('firstsecond');
    expect(stream.locked).toBe(false);
    instance.translateStreaming.mockImplementationOnce(() => {
      throw new Error('native setup failed');
    });
    await expect(api.translateStreamingToText('input')).rejects.toThrow('native setup failed');
    expect(api.state.getSnapshot()).toMatchObject({ processing: '', progressState: { phase: 'error' } });
  });

  it('interrupts a native reader even when it ignores the abort signal', async () => {
    const api = createTranslatorWorkflow();
    const instance = (await api.create()) as unknown as FakeTranslator;
    const native = pendingTextStream();
    instance.translateStreaming.mockReturnValueOnce(native.stream);
    const stream = await api.translateStreaming('input');
    const reader = stream.getReader();
    const pending = reader.read();
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(native.stream.locked).toBe(true));
    api.dispose();
    const disposed = api.state.getSnapshot();
    await rejected;
    await vi.waitFor(() => expect(native.stream.locked).toBe(false));
    expect(native.cancel).toHaveBeenCalledOnce();
    expect(api.state.getSnapshot()).toBe(disposed);
    reader.releaseLock();
  });

  it('preserves a newer operation when an obsolete stream is cancelled', async () => {
    const api = createTranslatorWorkflow();
    const instance = (await api.create()) as unknown as FakeTranslator;
    const native = pendingTextStream();
    instance.translateStreaming.mockReturnValueOnce(native.stream);
    const old = await api.translateStreaming('old');
    const usage = deferred<number>();
    instance.measureInputUsage.mockImplementationOnce(() => usage.promise);
    const pending = api.measureInputUsage('new');
    await expect(old.cancel('obsolete')).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.state.getSnapshot().processing).toBe('measure');
    usage.resolve(3);
    await expect(pending).resolves.toBe(3);
  });

  it('cancels and unlocks a reader when the consumer callback throws', async () => {
    const api = createTranslatorWorkflow();
    const instance = (await api.create()) as unknown as FakeTranslator;
    const cancel = vi.fn();
    const native = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('piece');
      },
      cancel
    });
    instance.translateStreaming.mockReturnValueOnce(native);
    const failure = new Error('consumer failed');
    await expect(
      api.translateStreamingToText('input', {}, () => {
        throw failure;
      })
    ).rejects.toBe(failure);
    expect(cancel).toHaveBeenCalledWith(failure);
    expect(native.locked).toBe(false);
    expect(api.state.getSnapshot().isProcessing).toBe(false);
  });

  it('releases a failed reader even when the error progress callback throws', async () => {
    const api = createTranslatorWorkflow();
    const instance = (await api.create()) as unknown as FakeTranslator;
    const failure = new Error('native stream failed');
    const native = failingTextStream(failure);
    instance.translateStreaming.mockReturnValueOnce(native);
    await expect(
      api.translateStreamingToText('input', {
        onProgress(progress) {
          if (progress.phase === 'error') throw new Error('progress handler failed');
        }
      })
    ).rejects.toBe(failure);
    expect(native.locked).toBe(false);
    expect(api.state.getSnapshot().isProcessing).toBe(false);
  });
});
