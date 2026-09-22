import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRewriterWorkflow } from '../../src/workflows';
import { createWriterWorkflow } from '../../src/workflows';
import { emitDownloadProgress, failingTextStream, pendingTextStream, textStream } from '../workflow-helpers';
import { deferred, flushPromises } from '../helpers';

type NativeOptions = { context?: string; signal?: AbortSignal };

class FakeWritingModel {
  static availabilityStatus: Availability = 'available';
  static availability = vi.fn(async () => FakeWritingModel.availabilityStatus);
  static create = vi.fn(async (options: { monitor?: CreateMonitorCallback; signal?: AbortSignal }) => {
    emitDownloadProgress(options);
    return new FakeWritingModel();
  });
  static rejectInput = '';
  static streamError: unknown;
  static pendingStream = false;
  static instances: FakeWritingModel[] = [];

  readonly inputQuota = 1_000;
  destroyed = false;
  measureInputUsage = vi.fn(
    async (input: string, options?: NativeOptions) => input.length + (options?.context?.length ?? 0)
  );
  write = vi.fn(async (input: string, options?: NativeOptions) => {
    if (input === FakeWritingModel.rejectInput) throw new Error('write failed');
    return `${input}|${options?.context ?? ''}`;
  });
  rewrite = vi.fn(async (input: string, options?: NativeOptions) => {
    if (input === FakeWritingModel.rejectInput) throw new Error('rewrite failed');
    return `rewritten:${input}|${options?.context ?? ''}`;
  });
  writeStreaming = vi.fn(() => {
    if (FakeWritingModel.streamError) return failingTextStream(FakeWritingModel.streamError);
    if (FakeWritingModel.pendingStream) return pendingTextStream().stream;
    return textStream('local', ' draft');
  });
  rewriteStreaming = vi.fn(() => textStream('local', ' rewrite'));

  constructor() {
    FakeWritingModel.instances.push(this);
  }

  destroy() {
    this.destroyed = true;
  }
}

describe('writing assistant workflows', () => {
  beforeEach(() => {
    FakeWritingModel.availabilityStatus = 'available';
    FakeWritingModel.availability.mockClear();
    FakeWritingModel.create.mockClear();
    FakeWritingModel.rejectInput = '';
    FakeWritingModel.streamError = undefined;
    FakeWritingModel.pendingStream = false;
    FakeWritingModel.instances = [];
    vi.stubGlobal('Writer', FakeWritingModel);
    vi.stubGlobal('Rewriter', FakeWritingModel);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('checks, downloads, creates, measures, destroys, and disposes a model', async () => {
    const writer = createWriterWorkflow();
    await expect(writer.requestAvailability({ tone: 'formal' })).resolves.toBe('available');
    await expect(writer.init({ tone: 'casual' })).resolves.toBe('available');
    const instance = (await writer.create({ sharedContext: 'shared', tone: 'formal' })) as unknown as FakeWritingModel;

    expect(writer.state.getSnapshot().downloadProgress).toBe(100);
    expect(writer.state.getSnapshot().inputQuota).toBe(1_000);
    expect(writer.state.getSnapshot().isReady).toBe(true);
    expect(FakeWritingModel.availability).toHaveBeenLastCalledWith({ tone: 'formal' });
    expect(FakeWritingModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ sharedContext: 'shared', tone: 'formal', signal: expect.any(AbortSignal) })
    );

    await expect(writer.measureInputUsage('  hello   world  ', { autoCreate: false })).resolves.toBe(13);
    expect(writer.state.getSnapshot().inputQuotaAvailable).toBe(987);
    writer.destroy();
    expect(instance.destroyed).toBe(true);
    expect(writer.state.getSnapshot().inputQuotaAvailable).toBeNull();
    writer.dispose();
    expect(writer.state.getSnapshot().availability).toBeNull();
    expect(writer.state.getSnapshot().progressState.phase).toBe('idle');
  });

  it('reports unsupported and unavailable models without leaving busy state', async () => {
    vi.stubGlobal('Writer', undefined);
    const unsupported = createWriterWorkflow();
    await expect(unsupported.checkAvailability()).resolves.toBe('unavailable');
    await expect(unsupported.init()).rejects.toThrow('unavailable');
    await expect(unsupported.create()).rejects.toThrow('not available in this browser context');
    expect(unsupported.state.getSnapshot().isProcessing).toBe(false);

    vi.stubGlobal('Writer', FakeWritingModel);
    FakeWritingModel.availabilityStatus = 'unavailable';
    const unavailable = createWriterWorkflow();
    await expect(unavailable.create()).rejects.toThrow('unavailable with the provided options');
  });

  it('normalizes input, strips HTML, returns details, and reuses a created model', async () => {
    const writer = createWriterWorkflow();
    const progress = vi.fn();
    const result = await writer.writeWithDetails(' <b>Hello</b>   world ', {
      context: ' <i>Useful</i>   facts ',
      stripHtml: true,
      onProgress: progress
    });

    expect(result).toMatchObject({
      text: 'Hello   world|Useful   facts',
      input: 'Hello   world',
      context: 'Useful   facts',
      originalContext: 'Useful   facts',
      fitted: false
    });
    expect(writer.state.getSnapshot().output).toBe(result.text);
    expect(writer.state.getSnapshot().lastResult).toEqual(result);
    expect(writer.state.getSnapshot().writer).toBeInstanceOf(FakeWritingModel);
    expect(writer.state.getSnapshot().processing).toBe('');
    expect(writer.state.getSnapshot().inputUsage).toBeGreaterThan(0);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
    await expect(writer.write('again', { autoCreate: false })).resolves.toBe('again|');
    expect(FakeWritingModel.create).toHaveBeenCalledTimes(1);
    await expect(writer.write('configured', { createOptions: { tone: 'casual' } })).resolves.toBe('configured|');
  });

  it('rejects oversized work and fits context at a natural boundary when requested', async () => {
    const writer = createWriterWorkflow();
    const context = `${'context '.repeat(80)}. ${'tail '.repeat(120)}`;

    await expect(
      writer.writeWithDetails('task', { context, inputBudgetRatio: 0.2, fitStrategy: 'error' })
    ).rejects.toThrow('exceeds the configured budget');
    expect(writer.state.getSnapshot().error).toBeInstanceOf(Error);

    const fitted = await writer.writeWithDetails('task', {
      context,
      inputBudgetRatio: 0.88,
      fitStrategy: 'truncate-context'
    });
    expect(fitted.fitted).toBe(true);
    expect(fitted.context!.length).toBeLessThan(context.length);
    expect(fitted.context!.endsWith('.')).toBe(true);

    await expect(
      writer.writeWithDetails('x'.repeat(400), {
        context: 'context',
        inputBudgetRatio: 0.2,
        fitStrategy: 'truncate-context'
      })
    ).rejects.toThrow('exceeds the configured budget');
  });

  it('clamps invalid budget ratios and lets oversized context-free input reach the native API', async () => {
    const writer = createWriterWorkflow();
    await expect(writer.write('x'.repeat(990), { inputBudgetRatio: Number.NaN })).resolves.toContain('x');
    await expect(writer.write('x'.repeat(205), { inputBudgetRatio: 0 })).resolves.toContain('x');
    await expect(writer.write('x'.repeat(990), { inputBudgetRatio: 2 })).resolves.toContain('x');
  });

  it('streams, accumulates output, reports chunks, and records the result', async () => {
    const writer = createWriterWorkflow();
    const onChunk = vi.fn();
    await expect(writer.writeStreamingToText('prompt', {}, onChunk)).resolves.toBe('local draft');
    expect(onChunk).toHaveBeenNthCalledWith(1, 'local', 'local');
    expect(writer.state.getSnapshot().lastResult?.text).toBe('local draft');
    expect(writer.state.getSnapshot().progressState.phase).toBe('ready');

    const rewriter = createRewriterWorkflow();
    const chunks: string[] = [];
    for await (const chunk of await rewriter.rewriteStreaming('input')) chunks.push(chunk);
    expect(chunks).toEqual(['local', ' rewrite']);
  });

  it('propagates stream setup and read failures and supports cancellation', async () => {
    const writer = createWriterWorkflow();
    FakeWritingModel.streamError = new Error('stream failed');
    await expect(writer.writeStreamingToText('prompt')).rejects.toThrow('stream failed');
    expect(writer.state.getSnapshot().error).toBeInstanceOf(Error);
    expect(writer.state.getSnapshot().progressState.phase).toBe('error');

    FakeWritingModel.streamError = undefined;
    FakeWritingModel.pendingStream = true;
    const stream = await writer.writeStreaming('pending');
    await stream.cancel('stop');
    expect(writer.state.getSnapshot().isProcessing).toBe(false);

    await expect(
      writer.writeStreaming('x'.repeat(400), {
        context: 'context',
        inputBudgetRatio: 0.2,
        fitStrategy: 'error'
      })
    ).rejects.toThrow('exceeds the configured budget');
  });

  it('runs batches with success, continuation, and fail-fast behavior', async () => {
    const rewriter = createRewriterWorkflow();
    FakeWritingModel.rejectInput = 'fail';
    const result = await rewriter.rewriteMany(
      [{ input: 'one', context: 'ctx' }, { input: 'fail', stripHtml: true }, { input: 'three' }],
      { continueOnError: true }
    );
    expect(result.results.map((item) => item?.text ?? null)).toEqual(['rewritten:one|ctx', null, 'rewritten:three|']);
    expect(result.failures).toHaveLength(1);

    await expect(rewriter.rewriteMany([{ input: 'fail' }])).rejects.toThrow('rewrite failed');
    await expect(rewriter.rewrite('x'.repeat(300), { context: 'context', inputBudgetRatio: 0.2 })).rejects.toThrow(
      'Rewriter input uses'
    );
  });

  it('requires explicit creation when autoCreate is disabled and can interrupt work', async () => {
    const writer = createWriterWorkflow();
    await expect(writer.write('prompt', { autoCreate: false })).rejects.toThrow('not initialized');

    const instance = (await writer.create()) as unknown as FakeWritingModel;
    instance.measureInputUsage.mockImplementationOnce(
      (_input, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
        )
    );
    const pending = writer.measureInputUsage('pending');
    await vi.waitFor(() => expect(writer.state.getSnapshot().isProcessing).toBe(true));
    writer.interrupt();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(writer.state.getSnapshot().isProcessing).toBe(false);
  });

  it.each(['interrupt', 'dispose'] as const)('does not create after %s during availability', async (stop) => {
    const availability = deferred<Availability>();
    FakeWritingModel.availability.mockReturnValueOnce(availability.promise);
    const writer = createWriterWorkflow();
    const creation = writer.create();
    writer[stop]();
    availability.resolve('available');
    await expect(creation).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeWritingModel.create).not.toHaveBeenCalled();
    expect(writer.state.getSnapshot()).toMatchObject({ writer: null, availability: null, processing: '', error: null });
  });

  it('discards late availability state without clearing a newer operation', async () => {
    const availability = deferred<Availability>();
    FakeWritingModel.availability.mockReturnValueOnce(availability.promise);
    const writer = createWriterWorkflow();
    const stale = writer.requestAvailability();
    writer.dispose();
    const creation = deferred<FakeWritingModel>();
    FakeWritingModel.create.mockReturnValueOnce(creation.promise);
    const latest = writer.create();
    await vi.waitFor(() => expect(FakeWritingModel.create).toHaveBeenCalledOnce());
    availability.resolve('unavailable');
    await stale;
    expect(writer.state.getSnapshot()).toMatchObject({ processing: 'create', availability: 'available' });
    creation.resolve(new FakeWritingModel());
    await latest;
  });

  it('destroys a late native creation and ignores its progress after disposal', async () => {
    const native = deferred<FakeWritingModel>();
    FakeWritingModel.create.mockReturnValueOnce(native.promise);
    const writer = createWriterWorkflow();
    const creation = writer.create();
    await vi.waitFor(() => expect(FakeWritingModel.create).toHaveBeenCalledOnce());
    const options = FakeWritingModel.create.mock.calls[0]![0];
    writer.dispose();
    expect(options.signal?.aborted).toBe(true);
    emitDownloadProgress(options);
    const late = new FakeWritingModel();
    native.resolve(late);
    await expect(creation).rejects.toMatchObject({ name: 'AbortError' });
    expect(late.destroyed).toBe(true);
    expect(writer.state.getSnapshot()).toMatchObject({
      writer: null,
      downloadProgress: 0,
      error: null,
      processing: ''
    });
  });

  it('cancels a ready-model operation before its first asynchronous continuation', async () => {
    const writer = createWriterWorkflow();
    const instance = (await writer.create()) as unknown as FakeWritingModel;
    const run = writer.write('pending');
    writer.destroy();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(instance.measureInputUsage).not.toHaveBeenCalled();
    expect(instance.write).not.toHaveBeenCalled();
    expect(writer.state.getSnapshot()).toMatchObject({ writer: null, output: '', error: null, processing: '' });
  });

  it('stops planning when native measurement ignores cancellation', async () => {
    const writer = createWriterWorkflow();
    const instance = (await writer.create()) as unknown as FakeWritingModel;
    const measurement = deferred<number>();
    instance.measureInputUsage.mockReturnValueOnce(measurement.promise);
    const run = writer.write('pending', { context: 'large context', fitStrategy: 'truncate-context' });
    await vi.waitFor(() => expect(instance.measureInputUsage).toHaveBeenCalledOnce());
    writer.dispose();
    measurement.resolve(2000);
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(instance.write).not.toHaveBeenCalled();
    expect(writer.state.getSnapshot()).toMatchObject({ inputUsage: null, output: '', error: null, lastResult: null });
  });

  it.each(['resolve', 'reject'] as const)('keeps newer execution state after an old native %s', async (settlement) => {
    const writer = createWriterWorkflow();
    const instance = (await writer.create()) as unknown as FakeWritingModel;
    const old = deferred<string>();
    const latest = deferred<string>();
    instance.write.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const stale = writer.write('old');
    await vi.waitFor(() => expect(instance.write).toHaveBeenCalledOnce());
    const current = writer.write('latest');
    await vi.waitFor(() => expect(instance.write).toHaveBeenCalledTimes(2));
    if (settlement === 'resolve') old.resolve('obsolete result');
    else old.reject(new Error('obsolete failure'));
    await expect(stale).rejects.toBeDefined();
    expect(writer.state.getSnapshot()).toMatchObject({ processing: 'write', output: '', error: null });
    latest.resolve('latest result');
    await expect(current).resolves.toBe('latest result');
    expect(writer.state.getSnapshot()).toMatchObject({ processing: '', output: 'latest result', error: null });
  });

  it('reuses equal creation options and replaces changed options', async () => {
    const writer = createWriterWorkflow();
    const initial = (await writer.create({
      tone: 'formal',
      expectedInputLanguages: ['en']
    })) as unknown as FakeWritingModel;
    await writer.write('first', { createOptions: { expectedInputLanguages: ['en'], tone: 'formal' } });
    await writer.writeStreamingToText('second', { createOptions: { tone: 'formal', expectedInputLanguages: ['en'] } });
    expect(FakeWritingModel.create).toHaveBeenCalledOnce();
    expect(initial.destroyed).toBe(false);
    await writer.write('changed', { createOptions: { tone: 'casual', expectedInputLanguages: ['en'] } });
    expect(FakeWritingModel.create).toHaveBeenCalledTimes(2);
    expect(initial.destroyed).toBe(true);
  });

  it('keeps a lazily created session alive when its first generation is interrupted', async () => {
    const instance = new FakeWritingModel();
    const generation = deferred<string>();
    instance.write.mockReturnValueOnce(generation.promise);
    FakeWritingModel.create.mockImplementationOnce(async ({ signal }) => {
      signal?.addEventListener('abort', () => instance.destroy(), { once: true });
      return instance;
    });
    const writer = createWriterWorkflow();
    const run = writer.write('first');
    await vi.waitFor(() => expect(instance.write).toHaveBeenCalledOnce());
    writer.interrupt();
    generation.resolve('ignored');
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(instance.destroyed).toBe(false);
    await expect(writer.write('next')).resolves.toBe('next|');
    expect(FakeWritingModel.create).toHaveBeenCalledOnce();
  });

  it('stops remaining batch items on interruption even with continueOnError', async () => {
    const writer = createWriterWorkflow();
    const instance = (await writer.create()) as unknown as FakeWritingModel;
    const native = deferred<string>();
    instance.write.mockReturnValueOnce(native.promise);
    const batch = writer.writeMany([{ input: 'first' }, { input: 'second' }], { continueOnError: true });
    await vi.waitFor(() => expect(instance.write).toHaveBeenCalledOnce());
    writer.interrupt();
    native.resolve('ignored');
    await expect(batch).rejects.toMatchObject({ name: 'AbortError' });
    expect(instance.write).toHaveBeenCalledOnce();
    expect(writer.state.getSnapshot()).toMatchObject({ output: '', error: null, processing: '' });
  });

  it('reports synchronous stream creation errors and releases readers after completion and failure', async () => {
    const writer = createWriterWorkflow();
    const instance = (await writer.create()) as unknown as FakeWritingModel;
    const error = new Error('stream setup failed');
    instance.writeStreaming.mockImplementationOnce(() => {
      throw error;
    });
    await expect(writer.writeStreaming('input')).rejects.toBe(error);
    expect(writer.state.getSnapshot()).toMatchObject({ error, processing: '' });

    const complete = textStream('complete');
    instance.writeStreaming.mockReturnValueOnce(complete);
    await expect(writer.writeStreamingToText('input')).resolves.toBe('complete');
    expect(complete.locked).toBe(false);
    const failed = failingTextStream(error);
    instance.writeStreaming.mockReturnValueOnce(failed);
    await expect(writer.writeStreamingToText('input')).rejects.toBe(error);
    await flushPromises();
    expect(failed.locked).toBe(false);
    expect(writer.state.getSnapshot()).toMatchObject({ error, processing: '' });
  });

  it('cancels a native stream that ignores AbortSignal and keeps disposed state empty', async () => {
    const writer = createWriterWorkflow();
    const instance = (await writer.create()) as unknown as FakeWritingModel;
    const native = pendingTextStream();
    instance.writeStreaming.mockReturnValueOnce(native.stream);
    const stream = await writer.writeStreaming('input');
    const read = stream.getReader().read();
    writer.dispose();
    await expect(read).rejects.toMatchObject({ name: 'AbortError' });
    await flushPromises();
    expect(native.cancel).toHaveBeenCalledOnce();
    expect(native.stream.locked).toBe(false);
    expect(writer.state.getSnapshot()).toMatchObject({
      writer: null,
      output: '',
      error: null,
      processing: '',
      lastResult: null
    });
  });

  it('releases readers when cancellation fails and does not replace a callback error', async () => {
    const writer = createWriterWorkflow();
    const instance = (await writer.create()) as unknown as FakeWritingModel;
    const cancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const native = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('chunk');
      },
      cancel
    });
    instance.writeStreaming.mockReturnValueOnce(native);
    const error = new Error('consumer failed');
    await expect(
      writer.writeStreamingToText('input', {}, () => {
        throw error;
      })
    ).rejects.toBe(error);
    expect(native.locked).toBe(false);
    expect(cancel).toHaveBeenCalledOnce();
    expect(writer.state.getSnapshot().processing).toBe('');
  });

  it('preserves progress callback errors when both error reporting and native cancellation fail', async () => {
    const writer = createWriterWorkflow();
    const instance = (await writer.create()) as unknown as FakeWritingModel;
    const cancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const native = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('chunk');
      },
      cancel
    });
    instance.writeStreaming.mockReturnValueOnce(native);
    const error = new Error('progress consumer failed');
    await expect(
      writer.writeStreamingToText('input', {
        onProgress(progress) {
          if (progress.outputLength > 0) throw error;
        }
      })
    ).rejects.toBe(error);
    await flushPromises();
    expect(native.locked).toBe(false);
    expect(cancel).toHaveBeenCalledOnce();
    expect(writer.state.getSnapshot()).toMatchObject({ error, processing: '' });
  });

  it('can fit context to an empty string without changing the prompt', async () => {
    const writer = createWriterWorkflow();
    const result = await writer.writeWithDetails('x'.repeat(200), {
      context: 'extra context',
      inputBudgetRatio: 0.2,
      fitStrategy: 'truncate-context'
    });
    expect(result).toMatchObject({ input: 'x'.repeat(200), context: undefined, fitted: true, inputUsage: 200 });
  });

  it('does not clear processing when availability is checked during an active run', async () => {
    const writer = createWriterWorkflow();
    const instance = (await writer.create()) as unknown as FakeWritingModel;
    const native = deferred<string>();
    instance.write.mockReturnValueOnce(native.promise);
    const run = writer.write('input');
    await vi.waitFor(() => expect(instance.write).toHaveBeenCalledOnce());
    await writer.requestAvailability();
    expect(writer.state.getSnapshot().processing).toBe('write');
    native.resolve('done');
    await run;
  });

  it('does not overwrite newer output when a streaming consumer starts another run', async () => {
    const writer = createWriterWorkflow();
    let next: Promise<string> | undefined;
    const stale = writer.writeStreamingToText('old', {}, () => {
      next ??= writer.write('latest');
    });
    await expect(stale).rejects.toMatchObject({ name: 'AbortError' });
    await expect(next).resolves.toBe('latest|');
    expect(writer.state.getSnapshot()).toMatchObject({ output: 'latest|', error: null, processing: '' });
  });
});
