import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLanguageDetector,
  createPromptApi,
  createProofreader,
  createRewriter,
  createSummarizer,
  createTranslator,
  createWriter
} from '../src';
import { deferred } from './helpers';

const clients = [
  {
    name: 'LanguageModel',
    build() {
      const client = createPromptApi();
      return { client, run: client.prompt, result: () => client.state.getSnapshot().output };
    }
  },
  {
    name: 'Summarizer',
    build() {
      const client = createSummarizer();
      return { client, run: client.summarize, result: () => client.state.getSnapshot().output };
    }
  },
  {
    name: 'Writer',
    build() {
      const client = createWriter();
      return { client, run: client.write, result: () => client.state.getSnapshot().output };
    }
  },
  {
    name: 'Rewriter',
    build() {
      const client = createRewriter();
      return { client, run: client.rewrite, result: () => client.state.getSnapshot().output };
    }
  },
  {
    name: 'Translator',
    build() {
      const client = createTranslator({ sourceLanguage: 'en', targetLanguage: 'fr' });
      return { client, run: client.translate, result: () => client.state.getSnapshot().output };
    }
  },
  {
    name: 'LanguageDetector',
    build() {
      const client = createLanguageDetector();
      return { client, run: client.detect, result: () => client.state.getSnapshot().results };
    }
  },
  {
    name: 'Proofreader',
    build() {
      const client = createProofreader();
      return { client, run: client.proofread, result: () => client.state.getSnapshot().result };
    }
  }
];

const resultFor = (name: string, label: string): unknown =>
  name === 'LanguageDetector'
    ? [{ detectedLanguage: label, confidence: 1 }]
    : name === 'Proofreader'
      ? { correctedInput: label, corrections: [] }
      : label;

const nativeModel = (name: string) => {
  const call = vi.fn(async (_input: unknown, _options?: { signal?: AbortSignal }): Promise<unknown> =>
    resultFor(name, 'answer')
  );
  const instance = Object.assign(new EventTarget(), {
    destroy: vi.fn(),
    contextUsage: 4,
    contextWindow: 128,
    inputQuota: 1000,
    prompt: call,
    summarize: call,
    write: call,
    rewrite: call,
    translate: call,
    detect: call,
    proofread: call,
    measureInputUsage: vi.fn(async () => 4)
  });
  return { instance, call };
};

const install = (name: string) => {
  const native = nativeModel(name);
  const constructor = {
    availability: vi.fn(async (_options?: object): Promise<Availability> => 'available'),
    create: vi.fn(async (_options?: { signal?: AbortSignal; monitor?: CreateMonitorCallback }) => native.instance)
  };
  vi.stubGlobal(name, constructor);
  return { ...native, constructor };
};

afterEach(() => vi.unstubAllGlobals());

describe.each(clients)('$name native lifecycle', ({ name, build }) => {
  it('does not invoke a cached model after same-turn disposal', async () => {
    const native = install(name);
    const { client, run, result } = build();
    const empty = result();
    await client.create();
    const pending = run('input');
    client.dispose();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(native.call).not.toHaveBeenCalled();
    expect(result()).toEqual(empty);
    expect(client.state.getSnapshot()).toMatchObject({
      instance: null,
      availability: null,
      processing: '',
      error: null
    });
  });

  it('rejects a cached ensure result when disposed before it resumes', async () => {
    install(name);
    const { client } = build();
    await client.create();
    const pending = client.ensure();
    client.dispose();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(client.state.getSnapshot()).toMatchObject({ instance: null, processing: '' });
  });

  it('stops lazy creation while availability is pending', async () => {
    const native = install(name);
    const availability = deferred<Availability>();
    native.constructor.availability.mockReturnValueOnce(availability.promise);
    const { client, run } = build();
    const pending = run('input');
    client.dispose();
    availability.resolve('available');
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(native.constructor.create).not.toHaveBeenCalled();
    expect(native.call).not.toHaveBeenCalled();
    expect(client.state.getSnapshot()).toMatchObject({
      instance: null,
      availability: null,
      processing: '',
      error: null
    });
  });

  it('destroys a late-created native session that ignored cancellation', async () => {
    const native = install(name);
    const creation = deferred<typeof native.instance>();
    native.constructor.create.mockReturnValueOnce(creation.promise);
    const { client, run } = build();
    const pending = run('input');
    await vi.waitFor(() => expect(native.constructor.create).toHaveBeenCalledOnce());
    client.dispose();
    expect(native.constructor.create.mock.calls[0]?.[0]?.signal?.aborted).toBe(true);
    creation.resolve(native.instance);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(native.instance.destroy).toHaveBeenCalledOnce();
    expect(native.call).not.toHaveBeenCalled();
    expect(client.state.getSnapshot()).toMatchObject({ instance: null, processing: '', error: null });
  });

  it('does not republish metadata when a subscriber disposes during model adoption', async () => {
    install(name);
    const { client } = build();
    let disposed = false;
    const unsubscribe = client.state.subscribe(() => {
      if (!disposed && client.state.getSnapshot().instance) {
        disposed = true;
        client.dispose();
      }
    });
    await expect(client.create()).rejects.toMatchObject({ name: 'AbortError' });
    unsubscribe();
    expect(client.state.getSnapshot()).toMatchObject({
      instance: null,
      availability: null,
      processing: '',
      error: null
    });
  });

  it.each(['resolve', 'reject'] as const)('keeps late native %s and cleanup out of newer state', async (settlement) => {
    const native = install(name);
    const { client, run, result } = build();
    const empty = result();
    await client.create();
    const first = deferred<unknown>();
    const latest = deferred<unknown>();
    native.call.mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
    const old = run('old');
    await vi.waitFor(() => expect(native.call).toHaveBeenCalledOnce());
    const pending = run('latest');
    await vi.waitFor(() => expect(native.call).toHaveBeenCalledTimes(2));
    if (settlement === 'resolve') {
      first.resolve(resultFor(name, 'obsolete'));
      await old;
    } else {
      first.reject(new Error('obsolete error'));
      await expect(old).rejects.toThrow('obsolete error');
    }
    expect(client.state.getSnapshot().processing).not.toBe('');
    expect(client.state.getSnapshot().error).toBeNull();
    expect(result()).toEqual(empty);
    latest.resolve(resultFor(name, 'latest'));
    await pending;
    expect(result()).toEqual(resultFor(name, 'latest'));
    expect(client.state.getSnapshot().processing).toBe('');
  });

  it('forwards interruption to native calls while preserving the reusable model', async () => {
    const native = install(name);
    const { client, run } = build();
    native.call.mockImplementationOnce(
      (_input, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
        })
    );
    const pending = run('input');
    await vi.waitFor(() => expect(native.call).toHaveBeenCalledOnce());
    client.interrupt('stop');
    await expect(pending).rejects.toBe('stop');
    expect(native.instance.destroy).not.toHaveBeenCalled();
    expect(await client.ensure()).toBe(native.instance);
    expect(client.state.getSnapshot()).toMatchObject({ processing: '', error: null });
  });

  it('ignores native results that arrive after disposal', async () => {
    const native = install(name);
    const { client, run, result } = build();
    const empty = result();
    const execution = deferred<unknown>();
    native.call.mockReturnValueOnce(execution.promise);
    const pending = run('input');
    await vi.waitFor(() => expect(native.call).toHaveBeenCalledOnce());
    client.dispose();
    expect(native.call.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    execution.resolve(resultFor(name, 'obsolete'));
    await pending;
    expect(result()).toEqual(empty);
    expect(client.state.getSnapshot()).toMatchObject({
      instance: null,
      availability: null,
      error: null,
      processing: ''
    });
  });

  it('keeps execution busy while refreshing availability', async () => {
    const native = install(name);
    const { client, run } = build();
    const execution = deferred<unknown>();
    native.call.mockReturnValueOnce(execution.promise);
    const pending = run('input');
    await vi.waitFor(() => expect(native.call).toHaveBeenCalledOnce());
    await client.requestAvailability();
    expect(client.state.getSnapshot().processing).not.toBe('');
    execution.resolve(resultFor(name, 'done'));
    await pending;
  });

  it('invalidates a pending native result when explicitly replacing its model', async () => {
    const native = install(name);
    const { client, run, result } = build();
    const empty = result();
    await client.create();
    const generation = deferred<unknown>();
    native.call.mockReturnValueOnce(generation.promise);
    const pending = run('old model');
    await vi.waitFor(() => expect(native.call).toHaveBeenCalledOnce());
    const replacement = nativeModel(name);
    native.constructor.create.mockResolvedValueOnce(replacement.instance);
    await client.create();
    expect(native.call.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    generation.resolve(resultFor(name, 'obsolete'));
    await pending;
    expect(result()).toEqual(empty);
    expect(client.state.getSnapshot()).toMatchObject({ instance: replacement.instance, error: null, processing: '' });
  });
});

describe('native creation options', () => {
  it('uses the configured Translator language pair for availability and recreates only changed options', async () => {
    const native = install('Translator');
    const englishToFrench = { sourceLanguage: 'en', targetLanguage: 'fr' };
    const client = createTranslator(englishToFrench);
    await expect(client.init()).resolves.toBe('available');
    expect(native.constructor.availability).toHaveBeenLastCalledWith(englishToFrench);
    await client.translate('one');
    await client.translate('two', {}, { targetLanguage: 'fr', sourceLanguage: 'en' });
    expect(native.constructor.create).toHaveBeenCalledOnce();
    const replacement = nativeModel('Translator');
    native.constructor.create.mockResolvedValueOnce(replacement.instance);
    await client.translate('three', {}, { sourceLanguage: 'en', targetLanguage: 'de' });
    expect(native.constructor.create).toHaveBeenCalledTimes(2);
    expect(native.instance.destroy).toHaveBeenCalledOnce();
    expect(native.constructor.availability).toHaveBeenLastCalledWith({ sourceLanguage: 'en', targetLanguage: 'de' });
    expect(replacement.call).toHaveBeenCalledOnce();
  });
});
