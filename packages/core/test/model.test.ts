import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createModelController,
  createPromptApi,
  equalOptions,
  snapshotOptions,
  type BrowserAiConstructor
} from '../src';
import { deferred, flushPromises } from './helpers';

interface CoreOptions {
  mode?: string;
}

interface CreateOptions extends CoreOptions {
  label?: string;
}

interface NativeCreateOptions extends CreateOptions {
  signal: AbortSignal;
  monitor: CreateMonitorCallback;
}

interface FakeInstance extends DestroyableModel {
  id: string;
}

const instance = (id: string): FakeInstance => ({ id, destroy: vi.fn() });

const controllerFor = (
  constructor: BrowserAiConstructor<CoreOptions, NativeCreateOptions, FakeInstance> | undefined,
  getSessionOptions?: (options: CreateOptions) => unknown
) =>
  createModelController<CoreOptions, CreateOptions, NativeCreateOptions, FakeInstance>({
    getConstructor: () => constructor,
    getCoreOptions: ({ mode }) => ({ mode }),
    getNativeCreateOptions: (options, signal, monitor) => ({ ...options, signal, monitor }),
    defaultCreateOptions: { mode: 'default', label: 'default' },
    getSessionOptions,
    unsupportedMessage: 'Unsupported here.',
    unavailableMessage: 'Unavailable for options.'
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('model controller', () => {
  it('checks and requests availability with observable state', async () => {
    const availability = vi.fn().mockResolvedValue('downloadable');
    const controller = controllerFor({ availability });
    const listener = vi.fn();
    controller.state.subscribe(listener);

    await expect(controller.checkAvailability({ mode: 'fast' })).resolves.toBe('downloadable');
    await expect(controller.requestAvailability({ mode: 'quality' })).resolves.toBe('downloadable');
    await expect(controller.init()).resolves.toBe('downloadable');

    expect(availability).toHaveBeenNthCalledWith(1, { mode: 'fast' });
    expect(controller.state.getSnapshot()).toMatchObject({ availability: 'downloadable', processing: '', error: null });
    expect(listener).toHaveBeenCalled();
  });

  it('reports an unsupported constructor', async () => {
    const controller = controllerFor(undefined);
    await expect(controller.create()).rejects.toThrow('Unsupported here.');
    expect(controller.state.getSnapshot()).toMatchObject({ availability: 'unavailable', processing: '' });
    expect(controller.state.getSnapshot().error).toBeInstanceOf(Error);
  });

  it('stops before native creation when options are unavailable', async () => {
    const create = vi.fn();
    const controller = controllerFor({ availability: vi.fn().mockResolvedValue('unavailable'), create });
    await expect(controller.create({ mode: 'blocked' })).rejects.toThrow('Unavailable for options.');
    expect(create).not.toHaveBeenCalled();
    expect(controller.state.getSnapshot()).toMatchObject({ availability: 'unavailable', processing: '' });
  });

  it('creates, monitors, reuses, and replaces instances', async () => {
    const first = instance('first');
    const second = instance('second');
    const create = vi.fn().mockImplementation(async (options: NativeCreateOptions) => {
      let progress: EventListener | undefined;
      options.monitor({
        addEventListener(_name: string, listener: EventListenerOrEventListenerObject) {
          progress = listener as EventListener;
        }
      } as CreateMonitor);
      progress?.({ loaded: 1, total: 2 } as ProgressEvent);
      return create.mock.calls.length === 1 ? first : second;
    });
    const controller = controllerFor({ availability: vi.fn().mockResolvedValue('available'), create });

    await expect(controller.create({ mode: 'fast', label: 'one' })).resolves.toBe(first);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ mode: 'fast', label: 'one' });
    expect(create.mock.calls[0]?.[0].signal).toBeInstanceOf(AbortSignal);
    expect(controller.state.getSnapshot()).toMatchObject({
      instance: first,
      availability: 'available',
      downloadProgress: 100,
      processing: ''
    });
    await expect(controller.ensure({ mode: 'fast', label: 'one' })).resolves.toBe(first);
    expect(create).toHaveBeenCalledTimes(1);

    await expect(controller.ensure({ label: 'two' })).resolves.toBe(second);
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(controller.state.getSnapshot().instance).toBe(second);
  });

  it('creates through ensure when no instance exists', async () => {
    const ready = instance('ready');
    const create = vi.fn().mockResolvedValue(ready);
    const controller = controllerFor({ availability: vi.fn().mockResolvedValue('available'), create });

    await expect(controller.ensure({ label: 'created by ensure' })).resolves.toBe(ready);
    expect(create).toHaveBeenCalledOnce();
  });

  it('applies configured options on demand and recreates only when session options change', async () => {
    const stable = instance('stable');
    const replacement = instance('replacement');
    const create = vi.fn().mockResolvedValueOnce(stable).mockResolvedValueOnce(replacement);
    const controller = controllerFor({ availability: vi.fn().mockResolvedValue('available'), create }, ({ mode }) => ({
      mode
    }));
    await controller.create();

    controller.configure({ mode: 'default', label: 'new label' });
    await expect(controller.ensure()).resolves.toBe(stable);
    expect(create).toHaveBeenCalledOnce();

    controller.configure({ mode: 'quality', label: 'new label' });
    expect(stable.destroy).not.toHaveBeenCalled();
    await expect(controller.ensure()).resolves.toBe(replacement);
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'quality', label: 'new label' }));
    expect(stable.destroy).toHaveBeenCalledOnce();
  });

  it('compares nested option values without treating distinct browser inputs as interchangeable', () => {
    const image = new Blob(['image bytes'], { type: 'image/png' });
    const options = { expectedInputs: [{ type: 'image', languages: ['en'] }], image };
    expect(
      equalOptions(options, { image, expectedInputs: [{ type: 'image', languages: ['en'] }], extra: undefined })
    ).toBe(true);
    expect(equalOptions(options, { ...options, expectedInputs: [{ type: 'image', languages: ['fr'] }] })).toBe(false);
    expect(equalOptions(options, { ...options, expectedInputs: [] })).toBe(false);
    expect(equalOptions(options, { ...options, expectedInputs: {} })).toBe(false);
    expect(equalOptions(options, { ...options, image: new Blob(['image bytes'], { type: 'image/png' }) })).toBe(false);
    expect(equalOptions({ image: {} }, { image })).toBe(false);
    expect(equalOptions(options, null)).toBe(false);
  });

  it('snapshots mutable records while preserving browser values and callback identity', () => {
    const image = new Blob(['Image'], { type: 'image/png' });
    const signal = new AbortController().signal;
    const bytes = new Uint8Array([1, 2]);
    const callback = vi.fn();
    const options = {
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      initialPrompts: [{ role: 'user', content: [{ type: 'image', value: image }] }],
      signal,
      bytes,
      callback,
      empty: null,
      unset: undefined
    };
    const snapshot = snapshotOptions(options);
    options.expectedInputs[0]!.languages.push('fr');
    options.initialPrompts[0]!.content[0]!.type = 'text';
    expect(snapshot.expectedInputs).toEqual([{ type: 'text', languages: ['en'] }]);
    expect(snapshot.initialPrompts[0]!.content[0]).toEqual({ type: 'image', value: image });
    expect(snapshot.initialPrompts[0]!.content[0]!.value).toBe(image);
    expect(snapshot.signal).toBe(signal);
    expect(snapshot.bytes).toBe(bytes);
    expect(snapshot.callback).toBe(callback);
    expect(snapshot.empty).toBeNull();
    expect(snapshot.unset).toBeUndefined();
  });

  it('recreates a native Prompt API session after nested caller options mutate and reuses semantic matches', async () => {
    const first = Object.assign(new EventTarget(), { destroy: vi.fn(), contextWindow: 4096, contextUsage: 0 });
    const second = Object.assign(new EventTarget(), { destroy: vi.fn(), contextWindow: 4096, contextUsage: 0 });
    const create = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available'), create });
    const options = { expectedInputs: [{ type: 'text' as const, languages: ['en'] }] };
    const api = createPromptApi();
    try {
      expect(await api.ensure(options)).toBe(first);
      options.expectedInputs[0]!.languages[0] = 'fr';
      expect(create.mock.calls[0]![0].expectedInputs).toEqual([{ type: 'text', languages: ['en'] }]);
      expect(await api.ensure(options)).toBe(second);
      expect(create).toHaveBeenCalledTimes(2);
      expect(create).toHaveBeenLastCalledWith(
        expect.objectContaining({ expectedInputs: [{ type: 'text', languages: ['fr'] }] })
      );
      expect(first.destroy).toHaveBeenCalledOnce();
      expect(
        await api.ensure({ expectedInputs: [{ languages: ['fr'], type: 'text' }], expectedOutputs: undefined })
      ).toBe(second);
      expect(create).toHaveBeenCalledTimes(2);
    } finally {
      api.dispose();
    }
  });

  it('isolates pending availability and creation from later mutations of caller options', async () => {
    const availability = deferred<Availability>();
    const creation = deferred<LanguageModel>();
    const first = Object.assign(new EventTarget(), { destroy: vi.fn() }) as unknown as LanguageModel;
    const second = Object.assign(new EventTarget(), { destroy: vi.fn() }) as unknown as LanguageModel;
    const create = vi.fn().mockReturnValueOnce(creation.promise).mockResolvedValueOnce(second);
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn().mockReturnValueOnce(availability.promise).mockResolvedValue('available'),
      create
    });
    const options = { expectedInputs: [{ type: 'text' as const, languages: ['en'] }] };
    const api = createPromptApi();
    try {
      const pending = api.create(options);
      options.expectedInputs[0]!.languages[0] = 'fr';
      availability.resolve('available');
      await flushPromises();
      expect(create.mock.calls[0]![0].expectedInputs).toEqual([{ type: 'text', languages: ['en'] }]);
      options.expectedInputs[0]!.languages.push('de');
      creation.resolve(first);
      expect(await pending).toBe(first);
      expect(await api.ensure(options)).toBe(second);
      expect(create).toHaveBeenCalledTimes(2);
      expect(create.mock.calls[1]![0].expectedInputs).toEqual([{ type: 'text', languages: ['fr', 'de'] }]);
    } finally {
      api.dispose();
    }
  });

  it('snapshots default and configured options until callers explicitly configure them again', async () => {
    const options = { expectedInputs: [{ type: 'text' as const, languages: ['en'] }] };
    const create = vi.fn().mockImplementation(async () => Object.assign(new EventTarget(), { destroy: vi.fn() }));
    vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available'), create });
    const api = createPromptApi(options);
    try {
      options.expectedInputs[0]!.languages[0] = 'fr';
      await api.ensure();
      expect(create.mock.lastCall![0].expectedInputs).toEqual([{ type: 'text', languages: ['en'] }]);
      api.configure(options);
      options.expectedInputs[0]!.languages[0] = 'de';
      await api.ensure();
      expect(create.mock.lastCall![0].expectedInputs).toEqual([{ type: 'text', languages: ['fr'] }]);
      api.configure(options);
      await api.ensure();
      expect(create).toHaveBeenCalledTimes(3);
      expect(create.mock.lastCall![0].expectedInputs).toEqual([{ type: 'text', languages: ['de'] }]);
    } finally {
      api.dispose();
    }
  });

  it('keeps a working instance when its replacement fails', async () => {
    const stable = instance('stable');
    const create = vi.fn().mockResolvedValueOnce(stable).mockRejectedValueOnce(new Error('create failed'));
    const availability = vi.fn().mockResolvedValueOnce('available').mockResolvedValueOnce('downloadable');
    const controller = controllerFor({ availability, create });
    await controller.create();
    await expect(controller.create({ label: 'replacement' })).rejects.toThrow('create failed');
    expect(stable.destroy).not.toHaveBeenCalled();
    expect(controller.state.getSnapshot()).toMatchObject({ instance: stable, availability: 'available' });
    expect(controller.state.getSnapshot().error).toEqual(new Error('create failed'));
    await expect(controller.ensure()).resolves.toBe(stable);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('keeps the current model ready when replacement options are unavailable', async () => {
    const stable = instance('stable');
    const create = vi.fn().mockResolvedValue(stable);
    const availability = vi.fn().mockResolvedValueOnce('available').mockResolvedValue('unavailable');
    const controller = controllerFor({ availability, create });
    await controller.create();

    await expect(controller.create({ mode: 'unsupported-language' })).rejects.toThrow('Unavailable for options.');
    expect(controller.state.getSnapshot()).toMatchObject({
      instance: stable,
      availability: 'available',
      processing: ''
    });
    await expect(controller.ensure()).resolves.toBe(stable);
    expect(create).toHaveBeenCalledOnce();
    expect(stable.destroy).not.toHaveBeenCalled();
  });

  it('retains a usable model if the native constructor becomes unavailable', async () => {
    const stable = instance('stable');
    const create = vi.fn().mockResolvedValue(stable);
    const constructor: BrowserAiConstructor<CoreOptions, NativeCreateOptions, FakeInstance> = {
      availability: vi.fn().mockResolvedValue('available'),
      create
    };
    const controller = controllerFor(constructor);
    await controller.create();
    delete constructor.create;

    await expect(controller.create({ mode: 'replacement' })).rejects.toThrow('Unsupported here.');
    expect(controller.state.getSnapshot()).toMatchObject({ instance: stable, availability: 'available' });
    await expect(controller.ensure()).resolves.toBe(stable);
    expect(create).toHaveBeenCalledOnce();
    expect(stable.destroy).not.toHaveBeenCalled();
  });

  it('does not start native creation when an availability subscriber disposes the controller', async () => {
    const create = vi.fn();
    const controller = controllerFor({ availability: vi.fn().mockResolvedValue('available'), create });
    let disposed = false;
    const unsubscribe = controller.state.subscribe(() => {
      if (!disposed && controller.state.getSnapshot().availability === 'available') {
        disposed = true;
        controller.dispose();
      }
    });

    await expect(controller.create()).rejects.toMatchObject({ name: 'AbortError' });
    unsubscribe();
    expect(disposed).toBe(true);
    expect(create).not.toHaveBeenCalled();
    expect(controller.state.getSnapshot()).toMatchObject({
      instance: null,
      availability: null,
      processing: '',
      downloadProgress: 0,
      error: null
    });
  });

  it('lets the latest availability request win', async () => {
    const first = deferred<Availability>();
    const availability = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce('available');
    const controller = controllerFor({ availability });
    const stale = controller.requestAvailability({ mode: 'old' });
    await controller.requestAvailability({ mode: 'new' });
    first.resolve('unavailable');
    await expect(stale).resolves.toBe('unavailable');
    expect(controller.state.getSnapshot()).toMatchObject({ availability: 'available', processing: '' });
  });

  it('records constructor lookup failures during an availability request', async () => {
    const error = new Error('constructor lookup failed');
    const controller = createModelController<CoreOptions, CreateOptions, NativeCreateOptions, FakeInstance>({
      getConstructor: () => {
        throw error;
      },
      getCoreOptions: ({ mode }) => ({ mode }),
      getNativeCreateOptions: (options, signal, monitor) => ({ ...options, signal, monitor }),
      defaultCreateOptions: {},
      unsupportedMessage: 'unsupported',
      unavailableMessage: 'unavailable'
    });
    await expect(controller.requestAvailability()).rejects.toBe(error);
    expect(controller.state.getSnapshot()).toMatchObject({ error, processing: '' });
  });

  it('aborts an older creation and destroys its late native result', async () => {
    const late = deferred<FakeInstance>();
    const lateInstance = instance('late');
    const latestInstance = instance('latest');
    const create = vi.fn().mockReturnValueOnce(late.promise).mockResolvedValueOnce(latestInstance);
    const controller = controllerFor({ availability: vi.fn().mockResolvedValue('available'), create });

    const oldCreation = controller.create({ label: 'old' });
    await flushPromises();
    await expect(controller.create({ label: 'new' })).resolves.toBe(latestInstance);
    late.resolve(lateInstance);
    await expect(oldCreation).rejects.toMatchObject({ name: 'AbortError' });
    expect(lateInstance.destroy).toHaveBeenCalledOnce();
    expect(controller.state.getSnapshot()).toMatchObject({ instance: latestInstance, processing: '' });
  });

  it('stops while availability is pending without calling native create', async () => {
    const availability = deferred<Availability>();
    const create = vi.fn();
    const controller = controllerFor({ availability: vi.fn().mockReturnValue(availability.promise), create });

    const creation = controller.create();
    await flushPromises();
    controller.interrupt('availability cancelled');
    availability.resolve('available');

    await expect(creation).rejects.toBe('availability cancelled');
    expect(create).not.toHaveBeenCalled();
    expect(controller.state.getSnapshot().processing).toBe('');
  });

  it('ignores late progress from an aborted creation', async () => {
    const firstNative = deferred<FakeInstance>();
    const firstInstance = instance('first');
    const latestInstance = instance('latest');
    let lateProgress: EventListener | undefined;
    const create = vi
      .fn()
      .mockImplementationOnce((options: NativeCreateOptions) => {
        options.monitor({
          addEventListener(_name: string, listener: EventListenerOrEventListenerObject) {
            lateProgress = listener as EventListener;
          }
        } as CreateMonitor);
        return firstNative.promise;
      })
      .mockResolvedValueOnce(latestInstance);
    const controller = controllerFor({ availability: vi.fn().mockResolvedValue('available'), create });
    const first = controller.create({ label: 'first' });
    await flushPromises();
    await controller.create({ label: 'latest' });
    lateProgress?.({ loaded: 1, total: 4 } as ProgressEvent);
    expect(controller.state.getSnapshot().downloadProgress).toBe(100);
    firstNative.resolve(firstInstance);
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not let a stale availability request clear active creation state', async () => {
    const staleAvailability = deferred<Availability>();
    const nativeCreation = deferred<FakeInstance>();
    const availability = vi.fn().mockReturnValueOnce(staleAvailability.promise).mockResolvedValueOnce('available');
    const controller = controllerFor({ availability, create: vi.fn().mockReturnValue(nativeCreation.promise) });

    const request = controller.requestAvailability();
    const creation = controller.create();
    await flushPromises();
    staleAvailability.resolve('unavailable');
    await request;
    expect(controller.state.getSnapshot().processing).toBe('create');
    nativeCreation.resolve(instance('ready'));
    await creation;
    expect(controller.state.getSnapshot()).toMatchObject({ availability: 'available', processing: '' });
  });

  it('interrupts work and fully resets on destroy and dispose', async () => {
    const nativeCreation = deferred<FakeInstance>();
    const controller = controllerFor({
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockReturnValue(nativeCreation.promise)
    });
    const creation = controller.create();
    await flushPromises();
    controller.interrupt('manual stop');
    expect(controller.state.getSnapshot().processing).toBe('');
    const late = instance('late');
    nativeCreation.resolve(late);
    await expect(creation).rejects.toBe('manual stop');
    expect(late.destroy).toHaveBeenCalledOnce();

    const ready = instance('ready');
    const next = controllerFor({
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue(ready)
    });
    await next.create();
    next.destroy();
    expect(ready.destroy).toHaveBeenCalledOnce();
    expect(next.state.getSnapshot().instance).toBeNull();
    next.dispose();
    expect(next.state.getSnapshot()).toMatchObject({
      instance: null,
      availability: null,
      processing: '',
      downloadProgress: 0,
      error: null
    });
  });
});
