import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutoRun, type AutoRunUpdate } from '../../src/workflows/auto-run';
import type { TextToolConfiguration } from '../../src/workflows/tool-settings';

const configuration = (): TextToolConfiguration => ({
  createOptions: { sourceLanguage: 'en', targetLanguage: 'fr' },
  runOptions: { context: 'Keep names' }
});
const update = (overrides: Partial<AutoRunUpdate> = {}): AutoRunUpdate => ({
  input: 'Hello',
  configuration: configuration(),
  enabled: true,
  available: 'available',
  busy: false,
  disabled: false,
  delayMs: 650,
  ...overrides
});
const deferred = () => {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createAutoRun', () => {
  it('debounces edits and retains the deadline for structurally identical updates', async () => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    auto.update(update());
    await vi.advanceTimersByTimeAsync(400);
    auto.update(update({ input: 'Hello again' }));
    await vi.advanceTimersByTimeAsync(300);
    auto.update(
      update({
        input: 'Hello again',
        configuration: {
          runOptions: { context: 'Keep names' },
          createOptions: { targetLanguage: 'fr', sourceLanguage: 'en', unused: undefined }
        }
      })
    );
    await vi.advanceTimersByTimeAsync(349);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledExactlyOnceWith('Hello again', configuration());
    auto.dispose();
  });

  it('debounces configuration edits and snapshots caller-owned records', async () => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    const options = configuration();
    auto.update(update({ configuration: options }));
    options.createOptions.targetLanguage = 'de';
    await vi.advanceTimersByTimeAsync(300);
    auto.update(update({ configuration: options }));
    options.runOptions.context = 'Changed after update';
    await vi.advanceTimersByTimeAsync(650);
    expect(run).toHaveBeenCalledExactlyOnceWith('Hello', {
      createOptions: { sourceLanguage: 'en', targetLanguage: 'de' },
      runOptions: { context: 'Keep names' }
    });
    auto.dispose();
  });

  it.each([
    { enabled: false },
    { available: 'downloadable' },
    { available: 'downloading' },
    { available: 'unavailable' },
    { available: null },
    { available: undefined },
    { input: ' \n\t' },
    { disabled: true },
    { busy: true }
  ])('cancels queued work while ineligible: %j', async (ineligible) => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    auto.update(update());
    await vi.advanceTimersByTimeAsync(300);
    auto.update(update(ineligible));
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).not.toHaveBeenCalled();
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    expect(run).toHaveBeenCalledOnce();
    auto.dispose();
  });

  it('runs only the latest edit after the current operation becomes idle', async () => {
    const pending = deferred();
    const run = vi.fn().mockImplementationOnce(() => pending.promise);
    const auto = createAutoRun(run, vi.fn());
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    auto.update(update({ busy: true }));
    auto.update(update({ input: 'Second edit', busy: true }));
    auto.update(update({ input: 'Latest edit', busy: true }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);
    pending.resolve();
    auto.update(update({ input: 'Latest edit' }));
    await vi.advanceTimersByTimeAsync(649);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenLastCalledWith('Latest edit', configuration());
    expect(run).toHaveBeenCalledTimes(2);
    auto.dispose();
  });

  it('does not repeat an attempted input after busy or availability transitions', async () => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    auto.update(update({ busy: true }));
    auto.update(update({ available: 'downloadable' }));
    auto.update(update());
    await vi.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledOnce();
    auto.dispose();
  });

  it('allows a new attempt when text or settings change, including returning to earlier text', async () => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    auto.update(update({ input: 'Another input' }));
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    auto.update(update({ configuration: { ...configuration(), runOptions: { context: 'New context' } } }));
    await vi.advanceTimersByTimeAsync(650);
    expect(run).toHaveBeenCalledTimes(3);
    auto.dispose();
  });

  it('restarts a pending deadline when the delay changes', async () => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    auto.update(update());
    await vi.advanceTimersByTimeAsync(500);
    auto.update(update({ delayMs: 100 }));
    await vi.advanceTimersByTimeAsync(99);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledOnce();
    auto.dispose();
  });

  it.each([-10, 0, NaN, Infinity])('normalizes delay %s to a queued immediate run', async (delayMs) => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    auto.update(update({ delayMs }));
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledOnce();
    auto.dispose();
  });

  it('starts manual work synchronously, clears the timer and records its configuration', async () => {
    const pending = deferred();
    const run = vi.fn(() => pending.promise);
    const auto = createAutoRun(run, vi.fn());
    auto.update(update());
    const result = auto.runNow('Hello', configuration());
    expect(run).toHaveBeenCalledExactlyOnceWith('Hello', configuration());
    expect(vi.getTimerCount()).toBe(0);
    pending.resolve();
    await result;
    auto.update(update());
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledOnce();
    await auto.runNow('Hello', configuration());
    expect(run).toHaveBeenCalledTimes(2);
    auto.dispose();
  });

  it('records manual work before the first update without eligibility restrictions', async () => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    await auto.runNow('Hello', configuration());
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    expect(run).toHaveBeenCalledOnce();
    auto.dispose();
  });

  it('retains a manual attempt when framework updates arrive after submission', async () => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    auto.update(update());
    const options = { ...configuration(), runOptions: { context: 'New context' } };
    await auto.runNow('Submitted edit', options);
    auto.update(update({ input: 'Submitted edit', configuration: options }));
    await vi.advanceTimersByTimeAsync(650);
    expect(run).toHaveBeenCalledExactlyOnceWith('Submitted edit', options);
    auto.dispose();
  });

  it('keeps the attempted snapshot isolated from mutations inside the runner', async () => {
    const run = vi.fn((_input: string, options: TextToolConfiguration) => {
      options.createOptions.targetLanguage = 'Changed by runner';
    });
    const auto = createAutoRun(run, vi.fn());
    const state = update();
    auto.update(state);
    await vi.advanceTimersByTimeAsync(650);
    expect(state.configuration.createOptions.targetLanguage).toBe('fr');
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    expect(run).toHaveBeenCalledOnce();
    auto.dispose();
  });

  it('stops queued work until input or settings change, while allowing an explicit manual retry', async () => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    auto.stop();
    auto.update(update());
    auto.stop();
    auto.update(update({ busy: true }));
    auto.update(update());
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).not.toHaveBeenCalled();
    await auto.runNow('Hello', configuration());
    expect(run).toHaveBeenCalledOnce();
    auto.stop();
    auto.update(update({ input: 'Edited after Stop' }));
    await vi.advanceTimersByTimeAsync(650);
    expect(run).toHaveBeenCalledTimes(2);
    auto.dispose();
  });

  it('preserves manual failures for the caller', async () => {
    const error = new Error('Manual failed');
    const onError = vi.fn();
    const auto = createAutoRun(() => Promise.reject(error), onError);
    await expect(auto.runNow('Hello', configuration())).rejects.toBe(error);
    expect(onError).not.toHaveBeenCalled();
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    expect(onError).not.toHaveBeenCalled();
    auto.dispose();
  });

  it.each(['sync', 'async'])('reports automatic %s failures once without retrying', async (mode) => {
    const error = new Error('Automatic failed');
    const run = vi.fn(() => {
      if (mode === 'sync') throw error;
      return Promise.reject(error);
    });
    const onError = vi.fn();
    const auto = createAutoRun(run, onError);
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    expect(run).toHaveBeenCalledOnce();
    auto.dispose();
  });

  it.each(['stop', 'dispose', 'edit', 'manual'])('ignores obsolete automatic errors after %s', async (action) => {
    const pending = deferred();
    const run = vi.fn().mockImplementationOnce(() => pending.promise);
    const onError = vi.fn();
    const auto = createAutoRun(run, onError);
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    if (action === 'stop') auto.stop();
    if (action === 'dispose') auto.dispose();
    if (action === 'edit') auto.update(update({ input: 'New input' }));
    if (action === 'manual') await auto.runNow('New input', configuration());
    pending.reject(new Error('Obsolete'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).not.toHaveBeenCalled();
    auto.dispose();
  });

  it('ignores a synchronous failure when the runner replaces its own input', async () => {
    const onError = vi.fn();
    const auto = createAutoRun(() => {
      auto.update(update({ input: 'New input', busy: true }));
      throw new Error('Previous input failed');
    }, onError);
    auto.update(update());
    await vi.advanceTimersByTimeAsync(650);
    expect(onError).not.toHaveBeenCalled();
    auto.dispose();
  });

  it('disposes pending work permanently and releases all timers', async () => {
    const run = vi.fn();
    const auto = createAutoRun(run, vi.fn());
    auto.update(update());
    auto.dispose();
    auto.dispose();
    auto.update(update({ input: 'After disposal' }));
    await auto.runNow('After disposal', configuration());
    await vi.runAllTimersAsync();
    expect(run).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
