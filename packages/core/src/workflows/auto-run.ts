import { equalOptions, snapshotOptions } from '../model.js';
import type { TextToolConfiguration } from './tool-settings.js';

interface RunInput {
  input: string;
  configuration: TextToolConfiguration;
}

export interface AutoRunUpdate extends RunInput {
  enabled: boolean;
  available: string | null | undefined;
  busy: boolean;
  disabled: boolean;
  delayMs: number;
}

const sameInput = (left: RunInput | undefined, right: RunInput) =>
  left?.input === right.input && equalOptions(left.configuration, right.configuration);

/** Debounce ready-model work without downloading models or owning the running operation. */
export const createAutoRun = (
  run: (input: string, configuration: TextToolConfiguration) => void | Promise<void>,
  onError: (error: unknown) => void
) => {
  let current: AutoRunUpdate | undefined;
  let attempted: RunInput | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  let disposed = false;

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const runNow = async (input: string, configuration: TextToolConfiguration): Promise<void> => {
    if (disposed) return;
    clearTimer();
    revision++;
    attempted = { input, configuration: snapshotOptions(configuration) };
    await run(input, snapshotOptions(configuration));
  };

  const update = (next: AutoRunUpdate) => {
    if (disposed) return;
    const changed = current !== undefined && !sameInput(current, next);
    const delayMs = Number.isFinite(next.delayMs) ? Math.max(0, next.delayMs) : 0;
    if (changed || current?.delayMs !== delayMs) clearTimer();
    if (changed) {
      if (!sameInput(attempted, next)) attempted = undefined;
      revision++;
    }
    current = { ...next, delayMs, configuration: snapshotOptions(next.configuration) };
    if (
      !next.enabled ||
      next.available !== 'available' ||
      !next.input.trim() ||
      next.disabled ||
      next.busy ||
      sameInput(attempted, next)
    ) {
      clearTimer();
      return;
    }
    if (timer !== undefined) return;
    const pending = current;
    timer = setTimeout(() => {
      timer = undefined;
      const request = revision + 1;
      void runNow(pending.input, pending.configuration).catch((error: unknown) => {
        if (!disposed && revision === request) onError(error);
      });
    }, delayMs);
  };

  const stop = () => {
    clearTimer();
    revision++;
    if (current) attempted = { input: current.input, configuration: snapshotOptions(current.configuration) };
  };

  const dispose = () => {
    stop();
    disposed = true;
    current = undefined;
    attempted = undefined;
  };

  return { update, runNow, stop, dispose };
};
