import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectTextStream,
  createAbortManager,
  createBrowserAiStore,
  createDownloadMonitor,
  getBrowserGlobal,
  isAbortError,
  observeTextStream,
  safeCheckAvailability
} from '../src';
import { failingTextStream, flushPromises, textStream } from './helpers';

afterEach(() => vi.unstubAllGlobals());

describe('browser store', () => {
  it('publishes partial and functional updates and supports unsubscription', () => {
    const store = createBrowserAiStore({ count: 0, label: 'ready' });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    expect(store.update({ count: 1 })).toEqual({ count: 1, label: 'ready' });
    expect(store.update((state) => ({ ...state, count: state.count + 1 }))).toEqual({ count: 2, label: 'ready' });
    expect(listener).toHaveBeenCalledTimes(2);

    const current = store.getSnapshot();
    expect(store.update(() => current)).toBe(current);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.update({ count: 3 });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('platform helpers', () => {
  it('normalizes download progress', () => {
    let callback: EventListener | undefined;
    const monitor = createDownloadMonitor((progress) => values.push(progress));
    const values: number[] = [];
    monitor({
      addEventListener(_name: string, listener: EventListenerOrEventListenerObject) {
        callback = listener as EventListener;
      }
    } as CreateMonitor);

    callback?.(new ProgressEvent('downloadprogress', { loaded: 5, total: 10 }));
    callback?.(new ProgressEvent('downloadprogress', { loaded: 1.5, total: 0 }));
    callback?.({ loaded: -1, total: 0 } as ProgressEvent);
    expect(values).toEqual([50, 100, 0]);
  });

  it('checks availability safely', async () => {
    expect(await safeCheckAvailability(undefined)).toBe('unavailable');
    expect(await safeCheckAvailability({ availability: vi.fn().mockResolvedValue('downloadable') }, { mode: 1 })).toBe(
      'downloadable'
    );
    expect(await safeCheckAvailability({ availability: vi.fn().mockRejectedValue(new Error('blocked')) })).toBe(
      'unavailable'
    );
  });

  it('collects text streams and reports accumulated chunks', async () => {
    const onChunk = vi.fn();
    const stream = textStream('one', ' two');
    await expect(collectTextStream(stream, onChunk)).resolves.toBe('one two');
    expect(onChunk).toHaveBeenNthCalledWith(1, 'one', 'one');
    expect(onChunk).toHaveBeenNthCalledWith(2, ' two', 'one two');
    expect(stream.locked).toBe(false);
  });

  it('releases the reader after a stream failure without replacing the error', async () => {
    const error = new Error('stream failed');
    const stream = failingTextStream(error);
    await expect(collectTextStream(stream)).rejects.toBe(error);
    expect(stream.locked).toBe(false);
  });

  it.each([false, true])(
    'cancels generation after a callback failure even if cancellation rejects: %s',
    async (reject) => {
      const error = new Error('callback failed');
      const cancel = vi.fn(() => (reject ? Promise.reject(new Error('cancel failed')) : Promise.resolve()));
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('first chunk');
        },
        cancel
      });

      await expect(
        collectTextStream(stream, () => {
          throw error;
        })
      ).rejects.toBe(error);
      expect(cancel).toHaveBeenCalledExactlyOnceWith(error);
      expect(stream.locked).toBe(false);
    }
  );

  it('tracks only the latest abortable operation', () => {
    const manager = createAbortManager();
    const first = manager.begin();
    const second = manager.begin();
    expect(first.aborted).toBe(true);
    expect(manager.signal).toBe(second);
    expect(manager.isCurrent(first)).toBe(false);
    expect(manager.end(first)).toBe(false);
    expect(manager.end(second)).toBe(true);
    expect(manager.signal).toBeNull();

    const third = manager.begin();
    manager.interrupt('stop');
    expect(third.aborted).toBe(true);
    expect(third.reason).toBe('stop');
    expect(manager.signal).toBeNull();
  });

  it('detects abort errors and reads browser globals', () => {
    vi.stubGlobal('TemporaryBrowserApi', { ready: true });
    expect(getBrowserGlobal<{ ready: boolean }>('TemporaryBrowserApi')).toEqual({ ready: true });
    expect(isAbortError(new DOMException('cancelled', 'AbortError'))).toBe(true);
    const error = new Error('cancelled');
    error.name = 'AbortError';
    expect(isAbortError(error)).toBe(true);
    expect(isAbortError(new Error('other'))).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
  });
});

it('releases native streams even when error and finalization observers fail', async () => {
  const failure = new Error('native read failed');
  const source = new ReadableStream<string>({
    pull(controller) {
      controller.error(failure);
    }
  });
  const observerError = () => {
    throw new Error('observer failed');
  };
  const observed = observeTextStream(source, new AbortController().signal, {
    onChunk: () => undefined,
    onComplete: () => undefined,
    onError: observerError,
    onFinally: observerError
  });
  await expect(observed.getReader().read()).rejects.toBe(failure);
  await flushPromises();
  expect(source.locked).toBe(false);
});

it('cancels before reading when the operation is already aborted', async () => {
  const cancellation = vi.fn();
  const source = new ReadableStream<string>({ cancel: cancellation });
  const controller = new AbortController();
  controller.abort();
  const callbacks = { onChunk: vi.fn(), onComplete: vi.fn(), onError: vi.fn(), onFinally: vi.fn() };
  const observed = observeTextStream(source, controller.signal, callbacks);
  await expect(observed.getReader().read()).rejects.toMatchObject({ name: 'AbortError' });
  expect(cancellation).toHaveBeenCalledOnce();
  expect(callbacks.onChunk).not.toHaveBeenCalled();
  expect(callbacks.onFinally).toHaveBeenCalledOnce();
  expect(source.locked).toBe(false);
});

it('preserves the original stream error when the error observer aborts the operation', async () => {
  const failure = new Error('native read failed');
  const source = failingTextStream(failure);
  const controller = new AbortController();
  const callbacks = {
    onChunk: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(() => controller.abort(new Error('observer cancellation'))),
    onFinally: vi.fn()
  };
  const observed = observeTextStream(source, controller.signal, callbacks);

  await expect(collectTextStream(observed)).rejects.toBe(failure);
  await flushPromises();
  expect(callbacks.onError).toHaveBeenCalledExactlyOnceWith(failure);
  expect(callbacks.onFinally).toHaveBeenCalledOnce();
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(source.locked).toBe(false);
});

it('forwards native chunks while reporting accumulated output and completion once', async () => {
  const source = textStream('one', ' two');
  const callbacks = { onChunk: vi.fn(), onComplete: vi.fn(), onError: vi.fn(), onFinally: vi.fn() };
  const observed = observeTextStream(source, new AbortController().signal, callbacks);
  const forwarded = vi.fn();

  await expect(collectTextStream(observed, forwarded)).resolves.toBe('one two');
  expect(forwarded.mock.calls.map(([chunk]) => chunk)).toEqual(['one', ' two']);
  expect(callbacks.onChunk.mock.calls).toEqual([['one'], ['one two']]);
  expect(callbacks.onComplete).toHaveBeenCalledOnce();
  expect(callbacks.onError).not.toHaveBeenCalled();
  expect(callbacks.onFinally).toHaveBeenCalledOnce();
  expect(source.locked).toBe(false);
});

it.each([
  ['onChunk', false],
  ['onChunk', true],
  ['onComplete', false]
] as const)('handles cancellation inside %s, including a later callback error: %s', async (callback, throws) => {
  const source = textStream('one');
  const controller = new AbortController();
  const reason = new Error('cancelled by observer');
  const callbacks = { onChunk: vi.fn(), onComplete: vi.fn(), onError: vi.fn(), onFinally: vi.fn() };
  callbacks[callback].mockImplementation(() => {
    controller.abort(reason);
    if (throws) throw new Error('callback failed after cancellation');
  });
  const observed = observeTextStream(source, controller.signal, callbacks);

  await expect(collectTextStream(observed)).rejects.toBe(reason);
  await flushPromises();
  expect(callbacks.onError).toHaveBeenCalledExactlyOnceWith(reason);
  expect(callbacks.onFinally).toHaveBeenCalledOnce();
  expect(callbacks[callback]).toHaveBeenCalledOnce();
  expect(source.locked).toBe(false);
});

it.each([false, true])(
  'releases a pending native reader after consumer cancellation; native rejects: %s',
  async (reject) => {
    const cancellationError = new Error('native cancellation failed');
    const cancellation = vi.fn(() => (reject ? Promise.reject(cancellationError) : Promise.resolve()));
    const source = new ReadableStream<string>({ cancel: cancellation });
    const callbacks = { onChunk: vi.fn(), onComplete: vi.fn(), onError: vi.fn(), onFinally: vi.fn() };
    const observed = observeTextStream(source, new AbortController().signal, callbacks);
    const reader = observed.getReader();
    const pending = reader.read();
    await flushPromises();

    const cancelled = reader.cancel('consumer stopped');
    if (reject) await expect(cancelled).rejects.toBe(cancellationError);
    else await expect(cancelled).resolves.toBeUndefined();
    await expect(pending).resolves.toEqual({ value: undefined, done: true });
    expect(cancellation).toHaveBeenCalledExactlyOnceWith('consumer stopped');
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onFinally).toHaveBeenCalledOnce();
    expect(source.locked).toBe(false);
    reader.releaseLock();
  }
);
