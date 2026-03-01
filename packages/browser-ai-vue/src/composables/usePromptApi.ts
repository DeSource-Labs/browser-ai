/// <reference types="@types/dom-chromium-ai" />
import { ref, shallowRef, computed, watch } from 'vue';

type LLMPromptOptions = Omit<LanguageModelPromptOptions, 'signal'>;

interface UsePromptApiOptions {
  onQuotaOverflow?: (event: Event) => void;
}

export function usePromptApi(options: UsePromptApiOptions = {}) {
  const { onQuotaOverflow } = options;

  const session = ref<LanguageModel | null>(null);
  const processing = ref<'availability' | 'create' | 'new-session' | 'measure' | 'prompt' | ''>('');
  const availability = ref<Availability | null>(null);
  const defaultParams = ref<LanguageModelParams | null>(null);
  const params = ref<LanguageModelCreateCoreOptions | null>(null);
  const downloadProgress = ref<number>(0); // Progress for model downloads in percentage (0-100)

  // session dependent properties
  const temperature = ref<number | null>(null);
  const topK = ref<number | null>(null);
  const inputQuota = ref<number | null>(null);
  const inputUsage = ref<number | null>(null);

  const abortController = shallowRef<AbortController | null>(null);

  const isReady = computed(() => {
    return session.value !== null && availability.value === 'available';
  });

  const isProcessing = computed(() => processing.value !== '');

  const updateSessionProps = (sessionInstance?: LanguageModel | null) => {
    console.log('Updating session properties from session instance:', sessionInstance);
    temperature.value = sessionInstance?.temperature ?? null;
    topK.value = sessionInstance?.topK ?? null;
    inputQuota.value = sessionInstance?.inputQuota ?? null;
    inputUsage.value = sessionInstance?.inputUsage ?? null;
  };

  const handleQuotaoverflow = (event: Event) => {
    console.warn('Input quota exceeded');
    updateSessionProps(session.value);
    onQuotaOverflow?.(event);
  };

  watch(session, (newSession) => {
    updateSessionProps(newSession ?? undefined);
  }, { deep: true });

  // private method
  const requestDefaultParams = async () => {
    try {
      if (typeof LanguageModel?.params === 'function') {
        defaultParams.value = await LanguageModel.params();
      }
    } catch {
      console.warn('Error fetching default model parameters');
    }
  };

  // private method
  const requestAvailability = async (model: LanguageModelCreateCoreOptions) => {
    processing.value = 'availability';
    availability.value = await checkAvailability(model);
    processing.value = '';
  };

  // utility method
  const checkAvailability = async (model: LanguageModelCreateCoreOptions) => {
    let _availability: Availability = 'unavailable';
    if (typeof LanguageModel?.availability !== 'function') {
      return _availability;
    }
    try {
      _availability = await LanguageModel.availability(model);
    } catch (error) {
      console.warn('Error checking model availability:', error);
    }
    return _availability;
  };

  // method to initialize model parameters and check availability
  const init = async (model?: LanguageModelCreateCoreOptions) => {
    dispose();
    processing.value = 'create';
    let args: LanguageModelCreateCoreOptions = {};
    if (model) {
      args = model;
    } else {
      if (!defaultParams.value) {
        await requestDefaultParams();
      }
      args = {
        temperature: defaultParams.value?.defaultTemperature || 1,
        topK: defaultParams.value?.defaultTopK || 3,
      };
    }
    await requestAvailability(args);
    if (availability.value === 'unavailable') {
      processing.value = '';
      throw new Error('Model is unavailable with the provided parameters.');
    }
    params.value = args;
    processing.value = '';
    console.info('Ready to create session with params:', params.value);
  };

  // method to create a new session
  const create = async () => {
    if (!params.value) {
      throw new Error('Model parameters not set. Call init() first.');
    }
    if (availability.value === 'unavailable') {
      throw new Error('Model is unavailable with the provided parameters.');
    }
    processing.value = 'create';

    let monitor: CreateMonitorCallback | undefined;
    if (availability.value !== 'available') {
      monitor = (m: CreateMonitor) => {
        m.ondownloadprogress = (e: ProgressEvent) => {
          downloadProgress.value = e.loaded * 100;
        };
      };
    }

    interrupt();
    abortController.value = new AbortController();
    const signal = abortController.value.signal;

    const args: LanguageModelCreateOptions = {
      ...params.value,
      signal,
      monitor,
    };
    session.value = await LanguageModel.create(args);
    session.value.addEventListener('quotaoverflow', handleQuotaoverflow);
    downloadProgress.value = 100;
    processing.value = '';
    console.info('Session created:', session.value);
  };

  // method to destroy the current session
  const destroy = () => {
    if (session.value) {
      session.value.removeEventListener('quotaoverflow', handleQuotaoverflow);
      session.value.destroy();
      session.value = null;
      console.info('Session destroyed');
    }
  };

  // method to dispose all resources
  const dispose = () => {
    destroy();
    params.value = null;
    availability.value = null;
    abortController.value?.abort();
    processing.value = '';
    downloadProgress.value = 0;
    console.info('Disposed all resources');
  };

  const prompt = async (
    input: LanguageModelPrompt,
    options?: LLMPromptOptions
  ): Promise<string> => {
    if (!session.value) {
      throw new Error('Session not initialized. Call create() first.');
    }
    processing.value = 'prompt';
    try {
      interrupt();
      abortController.value = new AbortController();
      const signal = abortController.value.signal;

      const opts: LanguageModelPromptOptions = { ...options, signal };
      const response = await session.value.prompt(input, opts);
      updateSessionProps(session.value);
      return response;
    } catch (error) {
      console.warn('Error during prompt:', error);
      return '';
    } finally {
      processing.value = '';
    }
  };

  const promptStreaming = (
    input: LanguageModelPrompt,
    options?: LLMPromptOptions
  ): ReadableStream<string> => {
    if (!session.value) {
      throw new Error('Session not initialized. Call create() first.');
    }
    processing.value = 'prompt';
    try {
      interrupt();
      abortController.value = new AbortController();
      const signal = abortController.value.signal;

      const opts: LanguageModelPromptOptions = { ...options, signal };
      const stream = session.value.promptStreaming(input, opts);
      const reader = stream.getReader();

      const newStream = new ReadableStream<string>({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              processing.value = '';
              updateSessionProps(session.value);
              return;
            }
            controller.enqueue(value);
          } catch (error) {
            console.warn('Error during streaming prompt:', error);
            controller.error(error);
            processing.value = '';
          }
        },
        cancel() {
          reader.cancel();
          processing.value = '';
        },
      });

      return newStream;
    } catch (error) {
      processing.value = '';
      throw error;
    }
  };

  const append = async (input: LanguageModelPrompt) => {
    if (!session.value) {
      throw new Error('Session not initialized. Call create() first.');
    }
    processing.value = 'prompt';
    try {
      interrupt();
      abortController.value = new AbortController();
      const signal = abortController.value.signal;

      await session.value.append(input, { signal });
      updateSessionProps(session.value);
    } catch (error) {
      console.warn('Error during append:', error);
    } finally {
      processing.value = '';
    }
  };

  const measureInputUsage = async (
    input: LanguageModelPrompt,
    options?: LLMPromptOptions
  ): Promise<number> => {
    if (!session.value) {
      throw new Error('Session not initialized. Call create() first.');
    }
    processing.value = 'measure';
    try {
      interrupt();
      abortController.value = new AbortController();
      const signal = abortController.value.signal;

      const opts: LanguageModelPromptOptions = { ...options, signal };
      const usage = await session.value.measureInputUsage(input, opts);
      return usage;
    } catch (error) {
      console.warn('Error measuring input usage:', error);
      return 0;
    } finally {
      processing.value = '';
    }
  };

  /**
   * Interrupt the current operation such as prompt, model download, etc.
   */
  const interrupt = () => {
    if (abortController.value) {
      abortController.value.abort();
      console.info('Operation interrupted');
      abortController.value = null;
    }
  };

  return {
    processing: computed(() => processing.value),
    availability: computed(() => availability.value),
    downloadProgress: computed(() => downloadProgress.value),
    temperature: computed(() => temperature.value),
    topK: computed(() => topK.value),
    inputQuota: computed(() => inputQuota.value),
    inputUsage: computed(() => inputUsage.value),

    isProcessing,
    isReady,

    init,
    create,
    destroy,
    dispose,
    prompt,
    promptStreaming,
    append,
    measureInputUsage,
    interrupt,
  };
}
