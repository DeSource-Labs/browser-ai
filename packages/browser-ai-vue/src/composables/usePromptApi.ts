import { computed, ref, shallowRef, watch } from 'vue';

export type LLMAvailability = Availability;
export type LLMPromptOptions = Omit<LanguageModelPromptOptions, 'signal'>;
export type LLMProcessingState = 'availability' | 'create' | 'measure' | 'prompt' | '';
export type LLMCreateCoreOptions = LanguageModelCreateCoreOptions;
export type LLMCreateOptions = Omit<LanguageModelCreateOptions, 'signal' | 'monitor'>;
export type LLMPrompt = LanguageModelPrompt;

export interface UsePromptApiOptions {
  onContextOverflow?: (event: Event) => void;
  /**
   * @deprecated Use onContextOverflow. Kept as a compatibility alias for older consumers.
   */
  onQuotaOverflow?: (event: Event) => void;
}

type GlobalWithLanguageModel = typeof globalThis & {
  LanguageModel?: typeof LanguageModel;
};

const getLanguageModel = () => {
  return (globalThis as GlobalWithLanguageModel).LanguageModel;
};

const getCreateCoreOptions = (options: LLMCreateOptions = {}): LanguageModelCreateCoreOptions => {
  const { initialPrompts: _initialPrompts, ...coreOptions } = options;
  return coreOptions;
};

export function usePromptApi(options: UsePromptApiOptions = {}) {
  const { onContextOverflow, onQuotaOverflow } = options;

  const session = ref<LanguageModel | null>(null);
  const processing = ref<LLMProcessingState>('');
  const availability = ref<Availability | null>(null);
  const defaultParams = ref<LanguageModelParams | null>(null);
  const params = ref<LanguageModelCreateCoreOptions | null>(null);
  const downloadProgress = ref(0);

  const temperature = ref<number | null>(null);
  const topK = ref<number | null>(null);
  const contextWindow = ref<number | null>(null);
  const contextUsage = ref<number | null>(null);

  const abortController = shallowRef<AbortController | null>(null);

  const isReady = computed(() => {
    return session.value !== null && availability.value === 'available';
  });

  const isProcessing = computed(() => processing.value !== '');

  const contextWindowAvailable = computed(() => {
    if (contextWindow.value == null || contextUsage.value == null) {
      return null;
    }

    return Math.max(contextWindow.value - contextUsage.value, 0);
  });

  const updateSessionProps = (sessionInstance?: LanguageModel | null) => {
    temperature.value = sessionInstance?.temperature ?? null;
    topK.value = sessionInstance?.topK ?? null;
    contextWindow.value = sessionInstance?.contextWindow ?? null;
    contextUsage.value = sessionInstance?.contextUsage ?? null;
  };

  const handleContextOverflow = (event: Event) => {
    updateSessionProps(session.value);
    onContextOverflow?.(event);
    onQuotaOverflow?.(event);
  };

  watch(
    session,
    (newSession) => {
      updateSessionProps(newSession);
    },
    { deep: true }
  );

  const beginOperation = () => {
    interrupt();
    abortController.value = new AbortController();
    return abortController.value.signal;
  };

  const endOperation = (signal: AbortSignal) => {
    if (abortController.value?.signal === signal) {
      abortController.value = null;
    }
  };

  const requestDefaultParams = async () => {
    const LanguageModel = getLanguageModel();
    if (typeof LanguageModel?.params !== 'function') {
      defaultParams.value = null;
      return null;
    }

    try {
      defaultParams.value = await LanguageModel.params();
      return defaultParams.value;
    } catch {
      defaultParams.value = null;
      return null;
    }
  };

  const checkAvailability = async (model: LanguageModelCreateCoreOptions = {}) => {
    const LanguageModel = getLanguageModel();
    if (typeof LanguageModel?.availability !== 'function') {
      return 'unavailable' as Availability;
    }

    try {
      return await LanguageModel.availability(model);
    } catch {
      return 'unavailable' as Availability;
    }
  };

  const requestAvailability = async (model: LanguageModelCreateCoreOptions = {}) => {
    processing.value = 'availability';
    try {
      availability.value = await checkAvailability(model);
      return availability.value;
    } finally {
      processing.value = '';
    }
  };

  const init = async (model: LanguageModelCreateCoreOptions = {}) => {
    destroy();
    params.value = model;
    const status = await requestAvailability(model);

    if (status === 'unavailable') {
      throw new Error('LanguageModel is unavailable with the provided options.');
    }

    return status;
  };

  const create = async (createOptions: LLMCreateOptions = {}) => {
    const LanguageModel = getLanguageModel();
    if (typeof LanguageModel?.create !== 'function') {
      throw new Error('LanguageModel is not available in this browser context.');
    }

    const coreOptions = getCreateCoreOptions(createOptions);
    const modelOptions = params.value ?? coreOptions;
    params.value = modelOptions;

    if (availability.value === 'unavailable') {
      throw new Error('LanguageModel is unavailable with the provided options.');
    }

    if (!availability.value) {
      availability.value = await checkAvailability(modelOptions);
      if (availability.value === 'unavailable') {
        throw new Error('LanguageModel is unavailable with the provided options.');
      }
    }

    processing.value = 'create';
    const signal = beginOperation();
    destroy();

    const monitor: CreateMonitorCallback = (monitorTarget) => {
      monitorTarget.addEventListener('downloadprogress', (event) => {
        downloadProgress.value = Math.round(event.loaded * 100);
      });
    };

    try {
      session.value = await LanguageModel.create({
        ...modelOptions,
        ...createOptions,
        signal,
        monitor,
      });
      session.value.addEventListener('contextoverflow', handleContextOverflow);
      availability.value = 'available';
      downloadProgress.value = 100;
      updateSessionProps(session.value);
      return session.value;
    } finally {
      endOperation(signal);
      processing.value = '';
    }
  };

  const destroy = () => {
    if (!session.value) {
      updateSessionProps(null);
      return;
    }

    session.value.removeEventListener('contextoverflow', handleContextOverflow);
    session.value.destroy();
    session.value = null;
    updateSessionProps(null);
  };

  const dispose = () => {
    interrupt();
    destroy();
    params.value = null;
    availability.value = null;
    downloadProgress.value = 0;
    processing.value = '';
  };

  const prompt = async (
    input: LanguageModelPrompt,
    options?: LLMPromptOptions
  ): Promise<string> => {
    if (!session.value) {
      throw new Error('Session is not initialized. Call create() first.');
    }

    processing.value = 'prompt';
    const signal = beginOperation();

    try {
      const response = await session.value.prompt(input, { ...options, signal });
      updateSessionProps(session.value);
      return response;
    } finally {
      endOperation(signal);
      processing.value = '';
    }
  };

  const promptStreaming = (
    input: LanguageModelPrompt,
    options?: LLMPromptOptions
  ): ReadableStream<string> => {
    if (!session.value) {
      throw new Error('Session is not initialized. Call create() first.');
    }

    processing.value = 'prompt';
    const signal = beginOperation();
    const stream = session.value.promptStreaming(input, { ...options, signal });
    const reader = stream.getReader();

    return new ReadableStream<string>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            updateSessionProps(session.value);
            endOperation(signal);
            processing.value = '';
            return;
          }

          controller.enqueue(value);
        } catch (error) {
          updateSessionProps(session.value);
          endOperation(signal);
          processing.value = '';
          controller.error(error);
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason);
        } finally {
          updateSessionProps(session.value);
          endOperation(signal);
          processing.value = '';
        }
      },
    });
  };

  const append = async (input: LanguageModelPrompt) => {
    if (!session.value) {
      throw new Error('Session is not initialized. Call create() first.');
    }

    processing.value = 'prompt';
    const signal = beginOperation();

    try {
      await session.value.append(input, { signal });
      updateSessionProps(session.value);
    } finally {
      endOperation(signal);
      processing.value = '';
    }
  };

  const measureContextUsage = async (
    input: LanguageModelPrompt,
    options?: LLMPromptOptions
  ): Promise<number> => {
    if (!session.value) {
      throw new Error('Session is not initialized. Call create() first.');
    }

    processing.value = 'measure';
    const signal = beginOperation();

    try {
      return await session.value.measureContextUsage(input, { ...options, signal });
    } finally {
      endOperation(signal);
      processing.value = '';
    }
  };

  /**
   * @deprecated Use measureContextUsage. Kept as a compatibility alias for older consumers.
   */
  const measureInputUsage = measureContextUsage;

  const interrupt = () => {
    abortController.value?.abort();
    abortController.value = null;
  };

  return {
    session: computed(() => session.value),
    processing: computed(() => processing.value),
    availability: computed(() => availability.value),
    downloadProgress: computed(() => downloadProgress.value),
    defaultParams: computed(() => defaultParams.value),
    temperature: computed(() => temperature.value),
    topK: computed(() => topK.value),
    contextWindow: computed(() => contextWindow.value),
    contextUsage: computed(() => contextUsage.value),
    contextWindowAvailable,
    /**
     * @deprecated Use contextWindow.
     */
    inputQuota: computed(() => contextWindow.value),
    /**
     * @deprecated Use contextUsage.
     */
    inputUsage: computed(() => contextUsage.value),

    isProcessing,
    isReady,

    checkAvailability,
    requestAvailability,
    requestDefaultParams,
    init,
    create,
    destroy,
    dispose,
    prompt,
    promptStreaming,
    append,
    measureContextUsage,
    measureInputUsage,
    interrupt,
  };
}
