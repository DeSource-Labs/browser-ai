export interface BrowserAiConstructor<CoreOptions, CreateOptions, Instance> {
  availability?: (options?: CoreOptions) => Promise<Availability>;
  create?: (options?: CreateOptions) => Promise<Instance>;
}

export type DownloadProgressCallback = (progress: number, event: ProgressEvent) => void;

export const createDownloadMonitor = (onProgress: DownloadProgressCallback): CreateMonitorCallback => {
  return (monitor) => {
    monitor.addEventListener('downloadprogress', (event) => {
      const ratio = event.total > 0 ? event.loaded / event.total : event.loaded;
      onProgress(Math.round(Math.min(Math.max(ratio, 0), 1) * 100), event);
    });
  };
};

export const safeCheckAvailability = async <CoreOptions>(
  constructor: Pick<BrowserAiConstructor<CoreOptions, unknown, unknown>, 'availability'> | undefined,
  options?: CoreOptions
): Promise<Availability> => {
  if (typeof constructor?.availability !== 'function') return 'unavailable';

  try {
    return await constructor.availability(options);
  } catch {
    return 'unavailable';
  }
};

export const collectTextStream = async (
  stream: ReadableStream<string>,
  onChunk?: (chunk: string, accumulated: string) => void
) => {
  const reader = stream.getReader();
  let accumulated = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += value;
      onChunk?.(value, accumulated);
    }

    return accumulated;
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch {
      // Preserve the original stream or consumer error if cancellation fails.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
};

export const isAbortError = (error: unknown): boolean => {
  return error !== null && typeof error === 'object' && 'name' in error && error.name === 'AbortError';
};

export interface AbortManager {
  readonly signal: AbortSignal | null;
  begin(): AbortSignal;
  end(signal: AbortSignal): boolean;
  isCurrent(signal: AbortSignal): boolean;
  interrupt(reason?: unknown): void;
}

export const createAbortManager = (): AbortManager => {
  let controller: AbortController | null = null;

  return {
    get signal() {
      return controller?.signal ?? null;
    },
    begin() {
      controller?.abort();
      controller = new AbortController();
      return controller.signal;
    },
    end(signal) {
      if (controller?.signal !== signal) return false;
      controller = null;
      return true;
    },
    isCurrent(signal) {
      return controller?.signal === signal;
    },
    interrupt(reason) {
      controller?.abort(reason);
      controller = null;
    }
  };
};

export const getBrowserGlobal = <Value>(name: string): Value | undefined => {
  return (globalThis as Record<string, unknown>)[name] as Value | undefined;
};

/** Forward a native stream while owning its reader and operation cleanup. */
export const observeTextStream = (
  stream: ReadableStream<string>,
  signal: AbortSignal,
  callbacks: {
    onChunk(output: string): void;
    onComplete(): void;
    onError(error: unknown): void;
    onFinally(): void;
  }
): ReadableStream<string> => {
  const reader = stream.getReader();
  let output = '';
  let finished = false;
  let released = false;
  let target: ReadableStreamDefaultController<string>;
  const release = () => {
    if (released) return;
    released = true;
    reader.releaseLock();
  };
  const finish = () => {
    if (finished) return false;
    finished = true;
    signal.removeEventListener('abort', abort);
    return true;
  };
  const notifyFinally = () => {
    try {
      callbacks.onFinally();
    } catch {
      // Observer failures must not retain a native reader.
    }
  };
  const cancel = (reason: unknown) => reader.cancel(reason).finally(release);
  const fail = (error: unknown) => {
    if (!finish()) return;
    target.error(error);
    try {
      callbacks.onError(error);
    } catch {
      // Preserve the original stream failure.
    }
    notifyFinally();
    void cancel(error).catch(() => undefined);
  };
  const abort = () => fail(signal.reason);
  return new ReadableStream<string>({
    start(controller) {
      target = controller;
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (finished) return;
        if (done) {
          callbacks.onComplete();
          if (!finish()) return;
          controller.close();
          notifyFinally();
          release();
          return;
        }
        output += value;
        callbacks.onChunk(output);
        if (!finished) controller.enqueue(value);
      } catch (error) {
        fail(error);
      }
    },
    cancel(reason) {
      if (!finish()) return;
      notifyFinally();
      return cancel(reason);
    }
  });
};

/** A local identifier; the fallback also works outside secure browser contexts. */
export const createBrowserAiId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
