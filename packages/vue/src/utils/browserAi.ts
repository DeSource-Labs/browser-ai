import { shallowRef } from 'vue';

export {
  collectTextStream,
  createDownloadMonitor,
  isAbortError,
  safeCheckAvailability,
  type BrowserAiConstructor,
  type DownloadProgressCallback
} from '@desource/browser-ai';

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
