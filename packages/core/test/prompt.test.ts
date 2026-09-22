import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPromptApi, withPromptHistory } from '../src';
import { deferred, failingTextStream, flushPromises, pendingTextStream, textStream } from './helpers';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const languageModelInstance = (output = 'answer') => {
  const target = new EventTarget() as EventTarget & Record<string, unknown>;
  Object.assign(target, {
    contextUsage: 9,
    contextWindow: 128,
    prompt: vi.fn().mockResolvedValue(output),
    promptStreaming: vi.fn().mockReturnValue(textStream('ans', 'wer')),
    append: vi.fn().mockResolvedValue(undefined),
    measureContextUsage: vi.fn().mockResolvedValue(7),
    clone: vi.fn().mockResolvedValue({ cloned: true }),
    destroy: vi.fn()
  });
  return target as unknown as LanguageModel & {
    prompt: ReturnType<typeof vi.fn>;
    promptStreaming: ReturnType<typeof vi.fn>;
    append: ReturnType<typeof vi.fn>;
    measureContextUsage: ReturnType<typeof vi.fn>;
    clone: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    contextUsage: number;
    contextWindow: number;
  };
};

const installLanguageModel = (
  instances: Array<ReturnType<typeof languageModelInstance>>,
  availability = vi.fn().mockResolvedValue('available')
) => {
  const create = vi.fn();
  instances.forEach((native) => create.mockResolvedValueOnce(native));
  vi.stubGlobal('LanguageModel', { availability, create });
  return { availability, create };
};

describe('Prompt API controller', () => {
  it('adds prior conversation messages after caller-provided initial prompts', () => {
    const options = { initialPrompts: [{ role: 'system', content: 'Be concise.' }] } satisfies Omit<
      LanguageModelCreateOptions,
      'monitor' | 'signal'
    >;
    expect(withPromptHistory(options, [])).toBe(options);
    expect(
      withPromptHistory(options, [
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' }
      ]).initialPrompts
    ).toEqual([
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Question' },
      { role: 'assistant', content: 'Answer' }
    ]);
    expect(withPromptHistory({}, [{ role: 'user', content: 'Only history' }]).initialPrompts).toEqual([
      { role: 'user', content: 'Only history' }
    ]);
  });

  it('maps sampling options, creates once, and tracks context', async () => {
    const native = languageModelInstance();
    const constructor = installLanguageModel([native]);
    const tool = { name: 'weather', description: 'Weather', inputSchema: {}, execute: vi.fn() };
    const controller = createPromptApi({
      samplingMode: 'balanced',
      topK: 4,
      temperature: 0.4,
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      initialPrompts: [{ role: 'system', content: 'Be concise.' }],
      tools: [tool]
    });

    await expect(controller.prompt('Question', { omitResponseConstraintInput: true })).resolves.toBe('answer');
    expect(constructor.availability.mock.calls[0]?.[0]).toEqual({
      samplingMode: 'balanced',
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      tools: [tool]
    });
    expect(constructor.create.mock.calls[0]?.[0]).toMatchObject({
      samplingMode: 'balanced',
      initialPrompts: [{ role: 'system', content: 'Be concise.' }],
      signal: expect.any(AbortSignal),
      monitor: expect.any(Function)
    });
    expect(constructor.create.mock.calls[0]?.[0]).not.toHaveProperty('topK');
    expect(native.prompt).toHaveBeenCalledWith(
      'Question',
      expect.objectContaining({ omitResponseConstraintInput: true, signal: expect.any(AbortSignal) })
    );
    expect(controller.state.getSnapshot()).toMatchObject({
      output: 'answer',
      contextUsage: 9,
      contextWindow: 128,
      processing: ''
    });
    await controller.ensure();
    expect(constructor.create).toHaveBeenCalledOnce();
  });

  it('maps explicit top-k and temperature when no sampling mode is selected', async () => {
    const native = languageModelInstance();
    const constructor = installLanguageModel([native]);
    const controller = createPromptApi({ topK: 8, temperature: 0.6 });
    await controller.create();
    expect(constructor.availability).toHaveBeenCalledWith(expect.objectContaining({ topK: 8, temperature: 0.6 }));
    expect(constructor.create.mock.calls[0]?.[0]).toMatchObject({ topK: 8, temperature: 0.6 });
  });

  it('normalizes absent native context metrics to null', async () => {
    const native = languageModelInstance();
    Object.assign(native, { contextUsage: undefined, contextWindow: undefined });
    installLanguageModel([native]);
    const controller = createPromptApi();
    await controller.create();
    expect(controller.state.getSnapshot()).toMatchObject({ contextUsage: null, contextWindow: null });
  });

  it('prompts for structured JSON and forwards response constraints', async () => {
    const native = languageModelInstance('{"status":"ok"}');
    installLanguageModel([native]);
    const controller = createPromptApi();
    const constraint = {
      type: 'object',
      properties: { status: { type: 'string' } },
      required: ['status']
    };
    await expect(controller.promptJson<{ status: string }>('Return status', constraint)).resolves.toEqual({
      status: 'ok'
    });
    expect(native.prompt).toHaveBeenCalledWith(
      'Return status',
      expect.objectContaining({ responseConstraint: constraint, signal: expect.any(AbortSignal) })
    );
    native.prompt.mockResolvedValueOnce('not json');
    await expect(controller.promptJson('bad', constraint)).rejects.toBeInstanceOf(SyntaxError);
  });

  it('appends, measures, clones, and forwards abort signals', async () => {
    const native = languageModelInstance();
    installLanguageModel([native]);
    const controller = createPromptApi();
    await controller.append([{ role: 'user', content: 'Remember this.' }]);
    await expect(controller.measureContextUsage('Question', { omitResponseConstraintInput: true })).resolves.toBe(7);
    await expect(controller.clone()).resolves.toEqual({ cloned: true });
    expect(native.append).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Remember this.' }],
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(native.measureContextUsage).toHaveBeenCalledWith(
      'Question',
      expect.objectContaining({ omitResponseConstraintInput: true, signal: expect.any(AbortSignal) })
    );
    expect(native.clone).toHaveBeenCalledWith(expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('collects streaming text and updates context when complete', async () => {
    const native = languageModelInstance();
    installLanguageModel([native]);
    const controller = createPromptApi();
    const onChunk = vi.fn();
    await expect(controller.promptStreamingToText('Question', {}, onChunk)).resolves.toBe('answer');
    expect(onChunk).toHaveBeenNthCalledWith(1, 'ans', 'ans');
    expect(onChunk).toHaveBeenNthCalledWith(2, 'wer', 'answer');
    expect(controller.state.getSnapshot()).toMatchObject({ output: 'answer', contextUsage: 9, processing: '' });
  });

  it('handles synchronous, read, and cancellation streaming paths', async () => {
    const native = languageModelInstance();
    native.promptStreaming.mockImplementationOnce(() => {
      throw new Error('sync stream failure');
    });
    installLanguageModel([native]);
    const controller = createPromptApi();
    await expect(controller.promptStreaming('Question')).rejects.toThrow('sync stream failure');
    expect(controller.state.getSnapshot().error).toEqual(new Error('sync stream failure'));

    native.promptStreaming.mockReturnValueOnce(failingTextStream(new Error('read failure')));
    await expect(controller.promptStreamingToText('Question')).rejects.toThrow('read failure');
    expect(controller.state.getSnapshot().error).toEqual(new Error('read failure'));

    const pending = pendingTextStream();
    native.promptStreaming.mockReturnValueOnce(pending.stream);
    const stream = await controller.promptStreaming('Question');
    const reader = stream.getReader();
    const read = reader.read();
    await reader.cancel('cancel stream');
    await expect(read).resolves.toEqual({ done: true, value: undefined });
    expect(pending.cancelled).toHaveBeenCalledWith('cancel stream');
    expect(controller.state.getSnapshot().processing).toBe('');
  });

  it.each(['interrupt', 'supersede'] as const)(
    'cancels and releases the native stream on %s without clearing newer work',
    async (action) => {
      const native = languageModelInstance();
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
      native.promptStreaming.mockReturnValueOnce(nativeStream);
      native.prompt.mockReturnValueOnce(latest.promise);
      installLanguageModel([native]);
      const controller = createPromptApi();
      const reader = (await controller.promptStreaming('stale')).getReader();
      const abortedRead = expect(reader.read()).rejects.toMatchObject({ name: 'AbortError' });
      expect(nativeStream.locked).toBe(true);

      if (action === 'interrupt') {
        controller.interrupt();
        expect(controller.state.getSnapshot()).toMatchObject({ error: null, processing: '' });
      }
      const current = controller.prompt('latest');
      await abortedRead;
      reader.releaseLock();
      await flushPromises();

      expect(cancel).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'AbortError' }));
      expect(() => source.enqueue('stale chunk')).toThrow(TypeError);
      source.error(new Error('stale native failure'));
      expect(controller.state.getSnapshot()).toMatchObject({
        output: '',
        error: null,
        processing: 'prompt',
        contextUsage: 9
      });

      native.contextUsage = 77;
      cleanup.resolve();
      await flushPromises();
      expect(nativeStream.locked).toBe(false);
      expect(controller.state.getSnapshot()).toMatchObject({
        output: '',
        error: null,
        processing: 'prompt',
        contextUsage: 9
      });

      latest.resolve('latest output');
      await expect(current).resolves.toBe('latest output');
      expect(controller.state.getSnapshot()).toMatchObject({
        output: 'latest output',
        error: null,
        processing: '',
        contextUsage: 77
      });
    }
  );

  it('does not publish a synchronous stream error after interruption', async () => {
    const native = languageModelInstance();
    installLanguageModel([native]);
    const controller = createPromptApi();
    native.promptStreaming.mockImplementationOnce(() => {
      controller.interrupt();
      throw new Error('interrupted synchronous failure');
    });

    await expect(controller.promptStreaming('input')).rejects.toThrow('interrupted synchronous failure');
    expect(controller.state.getSnapshot()).toMatchObject({ error: null, processing: '' });
  });

  it('builds multimodal prompts and recreates sessions only for new modalities', async () => {
    const textOnly = languageModelInstance('text answer');
    const multimodal = languageModelInstance('image answer');
    const constructor = installLanguageModel([textOnly, multimodal]);
    const controller = createPromptApi();
    await controller.prompt('First');
    const image = new Blob(['pixels'], { type: 'image/png' });
    await expect(
      controller.promptWithAttachments('Inspect', [{ name: 'notes.txt', value: 'facts' }, { value: image }])
    ).resolves.toBe('image answer');

    expect(textOnly.destroy).toHaveBeenCalledOnce();
    expect(constructor.create).toHaveBeenCalledTimes(2);
    expect(constructor.create.mock.calls[1]?.[0].expectedInputs).toEqual([{ type: 'text' }, { type: 'image' }]);
    expect(multimodal.prompt.mock.calls[0]?.[0]).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', value: 'Inspect' },
          { type: 'text', value: 'File: notes.txt\n\nfacts' },
          { type: 'image', value: image }
        ]
      }
    ]);

    await controller.promptWithAttachments('Again', [{ value: image }]);
    expect(constructor.create).toHaveBeenCalledTimes(2);
  });

  it('streams multimodal attachments through the same session policy', async () => {
    const native = languageModelInstance();
    installLanguageModel([native]);
    const controller = createPromptApi({ expectedInputs: [{ type: 'text' }, { type: 'audio' }] });
    const onChunk = vi.fn();
    await expect(
      controller.promptStreamingWithAttachments(
        'Transcribe',
        [{ kind: 'audio', value: new Uint8Array([1, 2]) }],
        {},
        onChunk
      )
    ).resolves.toBe('answer');
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(native.promptStreaming.mock.calls[0]?.[0]).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', value: 'Transcribe' },
          { type: 'audio', value: new Uint8Array([1, 2]) }
        ]
      }
    ]);

    const fresh = languageModelInstance();
    const freshConstructor = installLanguageModel([fresh]);
    const freshController = createPromptApi();
    await freshController.promptStreamingWithAttachments('Inspect', [
      { kind: 'image', value: new Blob(['pixels'], { type: 'image/png' }) }
    ]);
    expect(freshConstructor.create.mock.calls[0]?.[0].expectedInputs).toEqual([{ type: 'text' }, { type: 'image' }]);
  });

  it('records context-overflow events only for the observed session', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T10:00:00Z'));
    const first = languageModelInstance();
    const second = languageModelInstance();
    installLanguageModel([first, second]);
    const controller = createPromptApi();
    await controller.create();
    first.contextUsage = 64;
    first.dispatchEvent(new Event('contextoverflow'));
    expect(controller.state.getSnapshot()).toMatchObject({
      contextUsage: 64,
      contextOverflowCount: 1,
      lastContextOverflowAt: Date.parse('2026-08-25T10:00:00Z')
    });

    await controller.create();
    first.dispatchEvent(new Event('contextoverflow'));
    expect(controller.state.getSnapshot().contextOverflowCount).toBe(1);
    second.dispatchEvent(new Event('contextoverflow'));
    expect(controller.state.getSnapshot().contextOverflowCount).toBe(2);
  });

  it('captures operation errors and prevents stale output', async () => {
    const native = languageModelInstance();
    const old = deferred<string>();
    native.prompt.mockReturnValueOnce(old.promise).mockResolvedValueOnce('latest');
    installLanguageModel([native]);
    const controller = createPromptApi();
    await controller.create();
    const stale = controller.prompt('old');
    await flushPromises();
    await controller.prompt('new');
    old.resolve('stale');
    await stale;
    expect(controller.state.getSnapshot().output).toBe('latest');

    for (const [method, run] of [
      ['prompt', () => controller.prompt('bad')],
      ['append', () => controller.append('bad')],
      ['measureContextUsage', () => controller.measureContextUsage('bad')],
      ['clone', () => controller.clone()]
    ] as const) {
      native[method].mockRejectedValueOnce(new Error(`${method} failed`));
      await expect(run()).rejects.toThrow(`${method} failed`);
      expect(controller.state.getSnapshot().error).toEqual(new Error(`${method} failed`));
    }
  });

  it('does not let a superseded append restore stale context state', async () => {
    const native = languageModelInstance();
    const staleAppend = deferred<void>();
    native.append.mockReturnValueOnce(staleAppend.promise);
    installLanguageModel([native]);
    const controller = createPromptApi();
    await controller.create();

    const append = controller.append('stale memory');
    await flushPromises();
    await controller.prompt('latest');
    staleAppend.resolve();
    await append;

    expect(controller.state.getSnapshot()).toMatchObject({ output: 'answer', processing: '', error: null });
  });

  it('ignores errors and cleanup from a superseded prompt', async () => {
    const native = languageModelInstance();
    const stale = deferred<string>();
    native.prompt.mockReturnValueOnce(stale.promise).mockResolvedValueOnce('latest');
    installLanguageModel([native]);
    const controller = createPromptApi();
    await controller.create();
    const oldPrompt = controller.prompt('old');
    await flushPromises();
    await controller.prompt('new');
    stale.reject(new Error('stale failure'));
    await expect(oldPrompt).rejects.toThrow('stale failure');
    expect(controller.state.getSnapshot()).toMatchObject({ output: 'latest', error: null, processing: '' });
  });

  it('interrupts, destroys, and disposes session listeners and state', async () => {
    const native = languageModelInstance();
    const late = deferred<string>();
    native.prompt.mockReturnValueOnce(late.promise);
    installLanguageModel([native]);
    const controller = createPromptApi();
    await controller.create();
    const run = controller.prompt('late');
    await flushPromises();
    controller.interrupt('stop');
    expect(controller.state.getSnapshot().processing).toBe('');
    late.resolve('ignored');
    await run;
    expect(controller.state.getSnapshot().output).toBe('');

    controller.destroy();
    expect(native.destroy).toHaveBeenCalledOnce();
    native.dispatchEvent(new Event('contextoverflow'));
    expect(controller.state.getSnapshot().contextOverflowCount).toBe(0);
    controller.dispose();
    expect(controller.state.getSnapshot()).toMatchObject({
      instance: null,
      availability: null,
      output: '',
      contextUsage: null,
      contextWindow: null,
      contextOverflowCount: 0,
      lastContextOverflowAt: null,
      processing: ''
    });
  });
});
