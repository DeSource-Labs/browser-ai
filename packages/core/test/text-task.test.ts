import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRewriter, createSummarizer, createTranslator, createWriter } from '../src';
import { deferred, failingTextStream, flushPromises, pendingTextStream, textStream } from './helpers';

afterEach(() => vi.unstubAllGlobals());

const taskInstance = () => ({
  inputQuota: 2048,
  measureInputUsage: vi.fn().mockResolvedValue(12),
  summarize: vi.fn().mockResolvedValue('summary'),
  summarizeStreaming: vi.fn().mockReturnValue(textStream('sum', 'mary')),
  write: vi.fn().mockResolvedValue('written'),
  writeStreaming: vi.fn().mockReturnValue(textStream('writ', 'ten')),
  rewrite: vi.fn().mockResolvedValue('rewritten'),
  rewriteStreaming: vi.fn().mockReturnValue(textStream('re', 'written')),
  translate: vi.fn().mockResolvedValue('traduit'),
  translateStreaming: vi.fn().mockReturnValue(textStream('tra', 'duit')),
  destroy: vi.fn()
});

const install = (
  name: string,
  native: ReturnType<typeof taskInstance>,
  availability = vi.fn().mockResolvedValue('available')
) => {
  const create = vi.fn().mockResolvedValue(native);
  vi.stubGlobal(name, { availability, create });
  return { availability, create };
};

describe('text task factories', () => {
  it('adapts Summarizer options and aliases', async () => {
    const native = taskInstance();
    const constructor = install('Summarizer', native);
    const controller = createSummarizer({ sharedContext: 'product notes', type: 'key-points' });

    await expect(controller.init({ type: 'headline' })).resolves.toBe('available');
    await expect(controller.summarize('Long input', { context: 'Background' })).resolves.toBe('summary');
    expect(constructor.availability).toHaveBeenLastCalledWith({ type: 'key-points' });
    expect(constructor.create.mock.calls[0]?.[0]).toMatchObject({ sharedContext: 'product notes', type: 'key-points' });
    expect(native.summarize).toHaveBeenCalledWith(
      'Long input',
      expect.objectContaining({ context: 'Background', signal: expect.any(AbortSignal) })
    );
    expect(controller.state.getSnapshot()).toMatchObject({ output: 'summary', inputQuota: 2048, processing: '' });
  });

  it('adapts Writer, Rewriter, and Translator without duplicating lifecycle logic', async () => {
    const writerNative = taskInstance();
    const writerConstructor = install('Writer', writerNative);
    const writer = createWriter({ sharedContext: 'brand', tone: 'casual' });
    await expect(writer.write('Draft', { context: 'launch' })).resolves.toBe('written');
    await expect(writer.writeStreamingToText('Draft')).resolves.toBe('written');
    expect(writerConstructor.availability).toHaveBeenCalledWith({ tone: 'casual' });
    expect(writerNative.write).toHaveBeenCalledWith(
      'Draft',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    const rewriterNative = taskInstance();
    const rewriterConstructor = install('Rewriter', rewriterNative);
    const rewriter = createRewriter({ sharedContext: 'brand', tone: 'more-formal' });
    await expect(rewriter.rewrite('Draft')).resolves.toBe('rewritten');
    await expect(rewriter.rewriteStreamingToText('Draft')).resolves.toBe('rewritten');
    expect(rewriterConstructor.availability).toHaveBeenCalledWith({ tone: 'more-formal' });

    const translatorNative = taskInstance();
    const translatorConstructor = install('Translator', translatorNative);
    const translator = createTranslator({ sourceLanguage: 'en', targetLanguage: 'fr' });
    await expect(translator.translate('Hello')).resolves.toBe('traduit');
    await expect(translator.translateStreamingToText('Hello')).resolves.toBe('traduit');
    expect(translatorConstructor.availability).toHaveBeenCalledWith({ sourceLanguage: 'en', targetLanguage: 'fr' });
    expect(translatorNative.translate).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

describe('text task lifecycle', () => {
  it('measures usage and reuses its native instance', async () => {
    const native = taskInstance();
    const constructor = install('Summarizer', native);
    const controller = createSummarizer();
    await expect(controller.measureInputUsage('input', { context: 'context' })).resolves.toBe(12);
    await controller.ensure();
    expect(constructor.create).toHaveBeenCalledOnce();
    expect(native.measureInputUsage).toHaveBeenCalledWith(
      'input',
      expect.objectContaining({ context: 'context', signal: expect.any(AbortSignal) })
    );
    expect(controller.state.getSnapshot()).toMatchObject({ inputUsage: 12, inputQuota: 2048, processing: '' });
  });

  it('collects streaming output while exposing every accumulated chunk', async () => {
    const native = taskInstance();
    install('Summarizer', native);
    const controller = createSummarizer();
    const onChunk = vi.fn();
    await expect(controller.summarizeStreamingToText('input', { context: 'ctx' }, onChunk)).resolves.toBe('summary');
    expect(onChunk).toHaveBeenNthCalledWith(1, 'sum', 'sum');
    expect(onChunk).toHaveBeenNthCalledWith(2, 'mary', 'summary');
    expect(controller.state.getSnapshot()).toMatchObject({ output: 'summary', inputQuota: 2048, processing: '' });
  });

  it('propagates synchronous and asynchronous streaming failures', async () => {
    const native = taskInstance();
    native.summarizeStreaming.mockImplementationOnce(() => {
      throw new Error('sync stream failure');
    });
    install('Summarizer', native);
    const controller = createSummarizer();
    await expect(controller.summarizeStreaming('input')).rejects.toThrow('sync stream failure');
    expect(controller.state.getSnapshot()).toMatchObject({ processing: '' });
    expect(controller.state.getSnapshot().error).toEqual(new Error('sync stream failure'));

    native.summarizeStreaming.mockReturnValueOnce(failingTextStream(new Error('read failure')));
    await expect(controller.summarizeStreamingToText('input')).rejects.toThrow('read failure');
    expect(controller.state.getSnapshot().error).toEqual(new Error('read failure'));
  });

  it('cancels the native stream and clears processing', async () => {
    const native = taskInstance();
    const pending = pendingTextStream();
    native.summarizeStreaming.mockReturnValueOnce(pending.stream);
    install('Summarizer', native);
    const controller = createSummarizer();
    const stream = await controller.summarizeStreaming('input');
    const reader = stream.getReader();
    const read = reader.read();
    await reader.cancel('not needed');
    await expect(read).resolves.toEqual({ done: true, value: undefined });
    expect(pending.cancelled).toHaveBeenCalledWith('not needed');
    expect(controller.state.getSnapshot().processing).toBe('');
  });

  it('records run and measurement failures', async () => {
    const native = taskInstance();
    native.summarize.mockRejectedValueOnce(new Error('run failed'));
    native.measureInputUsage.mockRejectedValueOnce(new Error('measure failed'));
    install('Summarizer', native);
    const controller = createSummarizer();

    await expect(controller.summarize('input')).rejects.toThrow('run failed');
    expect(controller.state.getSnapshot().error).toEqual(new Error('run failed'));
    await expect(controller.measureInputUsage('input')).rejects.toThrow('measure failed');
    expect(controller.state.getSnapshot()).toMatchObject({ processing: '' });
    expect(controller.state.getSnapshot().error).toEqual(new Error('measure failed'));
  });

  it('ignores stale measurement results, errors, and cleanup', async () => {
    const native = taskInstance();
    const staleSuccess = deferred<number>();
    const staleFailure = deferred<number>();
    native.measureInputUsage
      .mockReturnValueOnce(staleSuccess.promise)
      .mockResolvedValueOnce(3)
      .mockReturnValueOnce(staleFailure.promise)
      .mockResolvedValueOnce(4);
    install('Summarizer', native);
    const controller = createSummarizer();
    await controller.create();

    const first = controller.measureInputUsage('stale success');
    await flushPromises();
    await controller.measureInputUsage('latest success');
    staleSuccess.resolve(99);
    await first;
    expect(controller.state.getSnapshot().inputUsage).toBe(3);

    const failing = controller.measureInputUsage('stale failure');
    await flushPromises();
    await controller.measureInputUsage('latest again');
    staleFailure.reject(new Error('stale measure failure'));
    await expect(failing).rejects.toThrow('stale measure failure');
    expect(controller.state.getSnapshot()).toMatchObject({ inputUsage: 4, error: null, processing: '' });
  });

  it('prevents stale runs from overwriting the latest result', async () => {
    const native = taskInstance();
    const old = deferred<string>();
    native.summarize.mockReturnValueOnce(old.promise).mockResolvedValueOnce('new');
    install('Summarizer', native);
    const controller = createSummarizer();
    await controller.create();

    const oldRun = controller.summarize('old');
    await flushPromises();
    await expect(controller.summarize('new')).resolves.toBe('new');
    old.resolve('old');
    await expect(oldRun).resolves.toBe('old');
    expect(controller.state.getSnapshot()).toMatchObject({ output: 'new', processing: '' });
    expect((native.summarize.mock.calls[0]?.[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
  });

  it('ignores a stale run failure after a newer result completes', async () => {
    const native = taskInstance();
    const staleFailure = deferred<string>();
    native.summarize.mockReturnValueOnce(staleFailure.promise).mockResolvedValueOnce('latest');
    install('Summarizer', native);
    const controller = createSummarizer();
    await controller.create();

    const failing = controller.summarize('stale');
    await flushPromises();
    await expect(controller.summarize('latest')).resolves.toBe('latest');
    staleFailure.reject(new Error('stale run failure'));
    await expect(failing).rejects.toThrow('stale run failure');
    expect(controller.state.getSnapshot()).toMatchObject({ output: 'latest', error: null, processing: '' });
  });

  it.each(['interrupt', 'supersede'] as const)(
    'cancels and releases the native stream on %s without clearing newer work',
    async (action) => {
      const native = taskInstance();
      const cleanup = deferred<void>();
      const latest = deferred<string>();
      const cancel = vi.fn().mockReturnValue(cleanup.promise);
      let source!: ReadableStreamDefaultController<string>;
      const nativeStream = new ReadableStream<string>({
        start(controller) {
          source = controller;
        },
        cancel
      });
      native.summarizeStreaming.mockReturnValueOnce(nativeStream);
      native.summarize.mockReturnValueOnce(latest.promise);
      install('Summarizer', native);
      const controller = createSummarizer();
      const reader = (await controller.summarizeStreaming('stale')).getReader();
      const abortedRead = expect(reader.read()).rejects.toMatchObject({ name: 'AbortError' });
      expect(nativeStream.locked).toBe(true);

      if (action === 'interrupt') {
        controller.interrupt();
        expect(controller.state.getSnapshot()).toMatchObject({ error: null, processing: '' });
      }
      const current = controller.summarize('latest');
      await abortedRead;
      reader.releaseLock();
      await flushPromises();

      expect(cancel).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'AbortError' }));
      expect(() => source.enqueue('stale chunk')).toThrow(TypeError);
      source.error(new Error('stale native failure'));
      expect(controller.state.getSnapshot()).toMatchObject({
        output: '',
        error: null,
        processing: 'summarize',
        inputQuota: 2048
      });

      native.inputQuota = 4096;
      cleanup.resolve();
      await flushPromises();
      expect(nativeStream.locked).toBe(false);
      expect(controller.state.getSnapshot()).toMatchObject({
        output: '',
        error: null,
        processing: 'summarize',
        inputQuota: 2048
      });

      latest.resolve('latest output');
      await expect(current).resolves.toBe('latest output');
      expect(controller.state.getSnapshot()).toMatchObject({
        output: 'latest output',
        error: null,
        processing: '',
        inputQuota: 4096
      });
    }
  );

  it('does not publish a synchronous stream error after interruption', async () => {
    const native = taskInstance();
    install('Summarizer', native);
    const controller = createSummarizer();
    native.summarizeStreaming.mockImplementationOnce(() => {
      controller.interrupt();
      throw new Error('interrupted synchronous failure');
    });

    await expect(controller.summarizeStreaming('input')).rejects.toThrow('interrupted synchronous failure');
    expect(controller.state.getSnapshot()).toMatchObject({ error: null, processing: '' });
  });

  it('interrupts, destroys, and disposes without letting late work restore state', async () => {
    const native = taskInstance();
    const late = deferred<string>();
    native.summarize.mockReturnValueOnce(late.promise);
    install('Summarizer', native);
    const controller = createSummarizer();
    await controller.create();
    const run = controller.summarize('late');
    await flushPromises();
    controller.destroy();
    expect(native.destroy).toHaveBeenCalledOnce();
    expect(controller.state.getSnapshot()).toMatchObject({
      instance: null,
      processing: '',
      inputUsage: null,
      inputQuota: null
    });
    late.resolve('ignored');
    await run;
    expect(controller.state.getSnapshot().output).toBe('');

    controller.interrupt();
    controller.dispose();
    expect(controller.state.getSnapshot()).toMatchObject({
      instance: null,
      availability: null,
      output: '',
      inputUsage: null,
      inputQuota: null,
      processing: ''
    });
  });
});
