import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSummarizerWorkflow,
  createLanguageDetectorWorkflow,
  createProofreaderWorkflow
} from '../../src/workflows';
import { deferred, flushPromises, pendingTextStream, textStream } from '../helpers';

const adapters = [
  {
    name: 'Summarizer',
    create() {
      const api = createSummarizerWorkflow();
      return { ...api, run: api.summarize, snapshot: api.state.getSnapshot };
    },
    result: 'summary',
    method: 'summarize'
  },
  {
    name: 'LanguageDetector',
    create() {
      const api = createLanguageDetectorWorkflow();
      return { ...api, run: api.detect, snapshot: api.state.getSnapshot };
    },
    result: [{ detectedLanguage: 'en', confidence: 1 }],
    method: 'detect'
  },
  {
    name: 'Proofreader',
    create() {
      const api = createProofreaderWorkflow();
      return { ...api, run: api.proofread, snapshot: api.state.getSnapshot };
    },
    result: { correctedInput: 'corrected', corrections: [] },
    method: 'proofread'
  }
] as const;

afterEach(() => vi.unstubAllGlobals());

for (const adapter of adapters) {
  describe(`${adapter.name} workflow cancellation`, () => {
    const setup = () => {
      const generate = vi.fn(async () => adapter.result);
      const model = {
        inputQuota: 100,
        expectedInputLanguages: ['en'],
        measureInputUsage: vi.fn(async () => 4),
        summarize: generate,
        detect: generate,
        proofread: generate,
        destroy: vi.fn()
      };
      const native = {
        availability: vi.fn(async (): Promise<Availability> => 'available'),
        create: vi.fn(async (_options: { signal?: AbortSignal }) => model)
      };
      vi.stubGlobal(adapter.name, native);
      return { api: adapter.create(), model, native };
    };

    it('does not create a model after disposal during availability', async () => {
      const { api, native } = setup();
      const availability = deferred<Availability>();
      native.availability.mockReturnValueOnce(availability.promise);
      const result = api.run('text');
      api.dispose();
      availability.resolve('available');
      await expect(result).rejects.toMatchObject({ name: 'AbortError' });
      expect(native.create).not.toHaveBeenCalled();
      expect(api.snapshot()).toMatchObject({ availability: null, processing: '' });
    });

    it('destroys a late-created session without resurrecting disposed state', async () => {
      const { api, native, model } = setup();
      const creation = deferred<typeof model>();
      native.create.mockReturnValueOnce(creation.promise);
      const result = api.run('text');
      await flushPromises();
      api.dispose();
      creation.resolve(model);
      await expect(result).rejects.toMatchObject({ name: 'AbortError' });
      expect(model.destroy).toHaveBeenCalledOnce();
      expect(api.snapshot()).toMatchObject({ availability: null, downloadProgress: 0 });
    });

    it('ignores old results and finalizers while a newer request is busy', async () => {
      const { api, model } = setup();
      await api.create();
      const old = deferred<typeof adapter.result>();
      const fresh = deferred<typeof adapter.result>();
      model[adapter.method].mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
      const first = api.run('old');
      await flushPromises();
      const second = api.run('new');
      await flushPromises();
      const snapshot = api.snapshot();
      old.resolve(adapter.result);
      await expect(first).rejects.toMatchObject({ name: 'AbortError' });
      expect(api.snapshot()).toEqual(snapshot);
      fresh.resolve(adapter.result);
      await second;
      expect(api.snapshot().processing).toBe('');
    });

    it('stops after late measurement without invoking the native generator', async () => {
      const { api, model } = setup();
      await api.create();
      const measurement = deferred<number>();
      model.measureInputUsage.mockReturnValueOnce(measurement.promise);
      const result = api.run('text');
      await flushPromises();
      api.interrupt();
      measurement.resolve(4);
      await expect(result).rejects.toMatchObject({ name: 'AbortError' });
      expect(model[adapter.method]).not.toHaveBeenCalled();
      expect(api.snapshot().inputUsage).toBeNull();
    });

    it('does not let availability overwrite native operation progress or disposed state', async () => {
      const { api, model, native } = setup();
      await api.create();
      const generation = deferred<typeof adapter.result>();
      model[adapter.method].mockReturnValueOnce(generation.promise);
      const run = api.run('text');
      await flushPromises();
      const processing = api.snapshot().processing;
      await api.requestAvailability();
      expect(api.snapshot().processing).toBe(processing);
      const availability = deferred<Availability>();
      native.availability.mockReturnValueOnce(availability.promise);
      const check = api.requestAvailability();
      api.dispose();
      availability.resolve('available');
      generation.resolve(adapter.result);
      await check;
      await expect(run).rejects.toMatchObject({ name: 'AbortError' });
      expect(api.snapshot().availability).toBeNull();
    });

    it('reuses equivalent options and preserves the session when first generation is interrupted', async () => {
      const { api, native, model } = setup();
      native.create.mockImplementationOnce(async ({ signal }) => {
        signal?.addEventListener('abort', model.destroy);
        return model;
      });
      const generation = deferred<typeof adapter.result>();
      model[adapter.method].mockReturnValueOnce(generation.promise);
      const first = api.run('text', { createOptions: { expectedInputLanguages: ['en'] } });
      await flushPromises();
      api.interrupt();
      generation.resolve(adapter.result);
      await expect(first).rejects.toMatchObject({ name: 'AbortError' });
      expect(model.destroy).not.toHaveBeenCalled();
      await api.run('again', { createOptions: { expectedInputLanguages: ['en'] } });
      expect(native.create).toHaveBeenCalledOnce();
    });

    it('does not return a session synchronously disposed by a state subscriber', async () => {
      const { api, model } = setup();
      let disposed = false;
      const unsubscribe = api.state.subscribe(() => {
        if (!disposed && api.snapshot().isReady) {
          disposed = true;
          api.dispose();
        }
      });
      await expect(api.run('text')).rejects.toMatchObject({ name: 'AbortError' });
      expect(model.destroy).toHaveBeenCalledOnce();
      expect(model[adapter.method]).not.toHaveBeenCalled();
      expect(api.snapshot()).toMatchObject({ inputQuota: null, availability: null });
      unsubscribe();
    });

    it('destroys sessions cancelled during the helper handoff microtask', async () => {
      const { api, native, model } = setup();
      native.create.mockImplementationOnce(async () => {
        queueMicrotask(() => queueMicrotask(() => api.dispose()));
        return model;
      });
      await expect(api.run('text')).rejects.toMatchObject({ name: 'AbortError' });
      expect(model.destroy).toHaveBeenCalledOnce();
      expect(api.snapshot()).toMatchObject({ availability: null, inputQuota: null });
    });

    it.each(['result', 'progress', 'error'] as const)(
      'stops publication when a subscriber disposes during %s',
      async (phase) => {
        const { api, model } = setup();
        await api.create();
        if (phase === 'error') model[adapter.method].mockRejectedValueOnce(new Error('failure'));
        let disposed = false;
        const unsubscribe = api.state.subscribe(() => {
          const snapshot = api.snapshot();
          const publishedResult = 'output' in snapshot ? Boolean(snapshot.output) : snapshot.results.length > 0;
          if (
            !disposed &&
            (phase === 'result'
              ? publishedResult
              : phase === 'progress'
                ? snapshot.progressState.phase === 'ready'
                : Boolean(snapshot.error))
          ) {
            disposed = true;
            api.dispose();
          }
        });
        await expect(api.run('text')).rejects.toMatchObject({ name: 'AbortError' });
        expect(disposed).toBe(true);
        expect(api.snapshot()).toMatchObject({
          availability: null,
          lastResult: null,
          progressState: { phase: 'idle' }
        });
        unsubscribe();
      }
    );

    it('keeps a retained session ready when replacement options are unavailable', async () => {
      const { api, native } = setup();
      await api.create();
      native.availability.mockResolvedValueOnce('unavailable');
      await expect(api.create({ expectedInputLanguages: ['es'] })).rejects.toThrow('unavailable');
      expect(api.snapshot().isReady).toBe(true);
      await api.run('still works');
      expect(native.create).toHaveBeenCalledOnce();
      expect(api.snapshot().isReady).toBe(true);
    });

    it('preserves a working model when replacement fails', async () => {
      const { api, native, model } = setup();
      await api.create();
      native.create.mockRejectedValueOnce(new Error('creation failed'));
      await expect(api.create({ expectedInputLanguages: ['es'] })).rejects.toThrow('creation failed');
      expect(model.destroy).not.toHaveBeenCalled();
      expect(api.snapshot().processing).toBe('');
      await api.run('still works');
      expect(native.create).toHaveBeenCalledTimes(2);
    });
  });
}

for (const [name, create, method] of [
  ['LanguageDetector', createLanguageDetectorWorkflow, 'detect'],
  ['Proofreader', createProofreaderWorkflow, 'proofread']
] as const) {
  it(`${name} never continues an interrupted batch, even with continueOnError`, async () => {
    const generation = deferred<never>();
    const run = vi.fn(() => generation.promise);
    vi.stubGlobal(name, {
      availability: async () => 'available',
      create: async () => ({ inputQuota: 100, measureInputUsage: async () => 4, [method]: run, destroy() {} })
    });
    const api = create();
    const batch = 'detectMany' in api ? api.detectMany : api.proofreadMany;
    const pending = batch([{ input: 'one' }, { input: 'two' }], { continueOnError: true });
    await flushPromises();
    api.interrupt();
    generation.reject(new DOMException('Stopped', 'AbortError'));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(run).toHaveBeenCalledOnce();
  });
}

it('summarizer releases native readers after completion and interruption', async () => {
  const completed = textStream('one', 'two');
  const pending = pendingTextStream();
  const model = {
    inputQuota: 100,
    destroy: vi.fn(),
    summarizeStreaming: vi.fn().mockReturnValueOnce(completed).mockReturnValueOnce(pending.stream)
  };
  vi.stubGlobal('Summarizer', { availability: async () => 'available', create: async () => model });
  const api = createSummarizerWorkflow();
  await api.create();
  await expect(api.summarizeStreamingToText('input')).resolves.toBe('onetwo');
  expect(completed.locked).toBe(false);
  const output = api.summarizeStreamingToText('pending');
  await flushPromises();
  api.interrupt();
  await expect(output).rejects.toMatchObject({ name: 'AbortError' });
  expect(pending.cancelled).toHaveBeenCalledOnce();
  expect(pending.stream.locked).toBe(false);
  expect(api.state.getSnapshot().processing).toBe('');
});
