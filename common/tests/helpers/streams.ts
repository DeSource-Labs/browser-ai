import { vi, type Mock } from 'vitest';

export const deferred = <Value>() => {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

export const textStream = (...chunks: string[]) =>
  new ReadableStream<string>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    }
  });

export const failingTextStream = (error: unknown) =>
  new ReadableStream<string>({
    pull(controller) {
      controller.error(error);
    }
  });

export const pendingTextStream = (): { stream: ReadableStream<string>; cancelled: Mock; cancel: Mock } => {
  const cancelled = vi.fn();
  const stream = new ReadableStream<string>({
    pull() {
      return new Promise(() => undefined);
    },
    cancel: cancelled
  });
  return { stream, cancelled, cancel: cancelled };
};

export const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const destroyable = (): { destroy: Mock } => ({ destroy: vi.fn() });

export const emitDownloadProgress = (options: { monitor?: CreateMonitorCallback }, loaded = 1, total = 2) => {
  const monitor = new EventTarget();
  options.monitor?.(monitor as CreateMonitor);
  monitor.dispatchEvent(new ProgressEvent('downloadprogress', { loaded, total }));
};
