import { shallowRef } from 'vue';

export type BrowserAiConstructor<TCoreOptions, TCreateOptions, TInstance> = {
  availability?: (options?: TCoreOptions) => Promise<Availability>;
  create?: (options?: TCreateOptions) => Promise<TInstance>;
};

export type DownloadProgressCallback = (progress: number, event: ProgressEvent) => void;

export const createDownloadMonitor = (
  onProgress: DownloadProgressCallback
): CreateMonitorCallback => {
  return (monitor) => {
    monitor.addEventListener('downloadprogress', (event) => {
      onProgress(Math.round(event.loaded * 100), event);
    });
  };
};

export const safeCheckAvailability = async <TCoreOptions>(
  ctor: Pick<BrowserAiConstructor<TCoreOptions, unknown, unknown>, 'availability'> | undefined,
  options?: TCoreOptions
) => {
  if (typeof ctor?.availability !== 'function') {
    return 'unavailable' as Availability;
  }

  try {
    return await ctor.availability(options);
  } catch {
    return 'unavailable' as Availability;
  }
};

export const collectTextStream = async (
  stream: ReadableStream<string>,
  onChunk?: (chunk: string, accumulated: string) => void
) => {
  const reader = stream.getReader();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulated += value;
    onChunk?.(value, accumulated);
  }

  return accumulated;
};

export const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  if (error instanceof Error) {
    return error.name === 'AbortError';
  }
  return false;
};

export const useAbortableOperation = () => {
  const abortController = shallowRef<AbortController | null>(null);

  const interrupt = () => {
    abortController.value?.abort();
    abortController.value = null;
  };

  const begin = () => {
    interrupt();
    abortController.value = new AbortController();
    return abortController.value.signal;
  };

  const end = (signal: AbortSignal) => {
    if (abortController.value?.signal === signal) {
      abortController.value = null;
    }
  };

  return {
    abortController,
    begin,
    end,
    interrupt
  };
};
