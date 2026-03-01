import { ref, computed, onBeforeUnmount, onBeforeMount, type Ref, type ComputedRef, shallowRef } from 'vue';

type LLMCreateOptions = LanguageModelCreateCoreOptions;
type LLMPromptOptions = Omit<LanguageModelPromptOptions, 'signal'>;

export interface UsePromptApiOptions {
  /**
   * Configuration options for creating the language model session
   */
  initOptions?: LLMCreateOptions;

  /**
   * Whether to automatically create the session on composable initialization
   * @default false
   */
  immediate?: boolean;

  /**
   * Whether to automatically destroy the session when the component unmounts
   * @default true
   */
  autoDestroy?: boolean;

  /**
   * Callback when session is successfully created
   */
  onCreated?: (session: LanguageModel) => void;

  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Callback when availability changes
   */
  onAvailabilityChange?: (availability: Availability) => void;

  /**
   * Callback when a prompt is interrupted
   */
  onInterrupt?: () => void;
}

export interface UsePromptApiReturn {
  /**
   * The language model session instance (null if not created yet)
   * A session maintains shared memory between prompts limited by token quota
   */
  session: ComputedRef<LanguageModel | null>;

  /**
   * Whether the session is currently being created
   */
  isCreating: ComputedRef<boolean>;

  /**
   * Whether a prompt is currently being processed
   */
  isPrompting: ComputedRef<boolean>;

  /**
   * The latest response from the model
   */
  response: ComputedRef<string>;

  /**
   * Any error that occurred during operations
   */
  error: ComputedRef<Error | null>;

  /**
   * Current availability status with parameters
   */
  availability: ComputedRef<Availability | null>;

  /**
   * Model parameters (topK, temperature limits)
   */
  params: ComputedRef<LanguageModelParams | null>;

  /**
   * Whether the model is available and ready to use
   */
  isReady: ComputedRef<boolean>;

  /**
   * Current input usage (tokens used in this session)
   */
  inputUsage: ComputedRef<number>;

  /**
   * Maximum input quota (tokens allowed in this session)
   */
  inputQuota: ComputedRef<number>;

  /**
   * Percentage of quota used (0-100)
   */
  quotaUsagePercent: ComputedRef<number>;

  /**
   * Current temperature setting (readonly; computed from session or defaults)
   */
  temperature: ComputedRef<number>;

  /**
   * Current topK setting (readonly; computed from session or defaults)
   */
  topK: ComputedRef<number>;

  /**
   * Create and initialize a new language model session
   * If temperature or topK are changed, a new session will be created
   */
  create: (options?: LanguageModelCreateOptions) => Promise<LanguageModel>;

  /**
   * Check model availability with current options
   */
  checkAvailability: (options?: LanguageModelCreateCoreOptions) => Promise<Availability>;

  /**
   * Send a prompt to the model and get a response
   */
  prompt: (input: LanguageModelPrompt, options?: LLMPromptOptions) => Promise<string>;

  /**
   * Send a prompt and get a streaming response
   */
  promptStreaming: (
    input: LanguageModelPrompt,
    options?: LLMPromptOptions
  ) => ReadableStream<string>;

  /**
   * Interrupt the current prompt operation
   */
  interrupt: () => void;

  /**
   * Append a message to the session's context
   */
  append: (input: LanguageModelPrompt, options?: LanguageModelAppendOptions) => Promise<void>;

  /**
   * Measure how many tokens an input would use
   */
  measureInputUsage: (input: LanguageModelPrompt, options?: LLMPromptOptions) => Promise<number>;

  /**
   * Clone the current session with optional new options
   */
  clone: (options?: LanguageModelCloneOptions) => Promise<LanguageModel>;

  /**
   * Destroy the session and free resources
   */
  destroy: () => void;

  /**
   * Reset all state (clears response, error, etc.)
   */
  reset: () => void;
}

/**
 * VueUse-style composable for interacting with Chrome's built-in AI Language Model (Prompt API)
 * 
 * Creates a session with shared memory between prompts limited by token quota.
 * Temperature and topK are immutable during a session - changing them requires creating a new session.
 * 
 * @example
 * ```ts
 * const {
 *   session,
 *   isReady,
 *   isPrompting,
 *   response,
 *   error,
 *   availability,
 *   create,
 *   prompt,
 *   destroy
 * } = usePromptApi({ immediate: true });
 * 
 * // Check availability
 * await checkAvailability();
 * 
 * // Send a prompt
 * await prompt('What is the capital of France?');
 * console.log(response.value); // "Paris"
 * 
 * // Streaming response
 * const stream = await promptStreaming('Tell me a story');
 * for await (const chunk of stream) {
 *   console.log(chunk);
 * }
 * ```
 */
export function usePromptApiOld(options: UsePromptApiOptions = {}): UsePromptApiReturn {
  const {
    initOptions,
    immediate = false,
    autoDestroy = true,
    onCreated,
    onError,
    onAvailabilityChange,
    onInterrupt,
  } = options;

  // State
  const session = shallowRef<LanguageModel | null>(null);
  const isCreating = ref(false);
  const isPrompting = ref(false);
  const response = ref('');
  const error = ref<Error | null>(null);
  const availability = ref<Availability | null>(null);
  const params = ref<LanguageModelParams | null>(null);
  const inputUsage = ref(0);
  const inputQuota = ref(0);

  const temperature = computed<number>(() => {
    if (session.value) return session.value.temperature;
    if (lastTemperature !== undefined) return lastTemperature;
    if (initOptions?.temperature !== undefined) return initOptions.temperature as number;
    if (params.value?.defaultTemperature !== undefined) return params.value.defaultTemperature;
    return 0;
  });
  const topK = computed<number>(() => {
    if (session.value) return session.value.topK;
    if (lastTopK !== undefined) return lastTopK;
    if (initOptions?.topK !== undefined) return initOptions.topK as number;
    if (params.value?.defaultTopK !== undefined) return params.value.defaultTopK;
    return 0;
  });

  // Track last used options to detect changes
  let lastTemperature: number | undefined;
  let lastTopK: number | undefined;

  // Computed
  const isReady = computed(() => session.value !== null && availability.value === 'available');
  const quotaUsagePercent = computed(() => {
    if (inputQuota.value === 0) return 0;
    return Math.round((inputUsage.value / inputQuota.value) * 100);
  });

  // Handle abort signal for interruptions
  const abortController = new AbortController();
  const abortSignal = abortController!.signal;
  abortSignal.addEventListener('abort', () => {
    onInterrupt?.();
    isPrompting.value = false;
  });

  // Update reactive properties from session
  const updateSessionProperties = () => {
    if (session.value) {
      inputUsage.value = session.value.inputUsage;
      inputQuota.value = session.value.inputQuota;
    }
  };

  // Check availability
  const checkAvailability = async (opts?: LanguageModelCreateCoreOptions): Promise<Availability> => {
    try {
      error.value = null;
      
      const options = opts || initOptions;
      
      if (typeof LanguageModel?.availability !== 'function') {
        const unavailable: Availability = 'unavailable';
        availability.value = unavailable;
        onAvailabilityChange?.(unavailable);
        return unavailable;
      }

      const status = await LanguageModel.availability(options);
      availability.value = status;
      onAvailabilityChange?.(status);

      // Get model parameters if available
      if (typeof LanguageModel?.params === 'function') {
        params.value = await LanguageModel.params();
      }

      return status;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err;
      onError?.(err);
      const unavailable: Availability = 'unavailable';
      availability.value = unavailable;
      return unavailable;
    }
  };

  // Create session
  const create = async (): Promise<LanguageModel> => {
    try {
      isCreating.value = true;
      error.value = null;

      const options: LanguageModelCreateOptions = initOptions ? { ...initOptions } : {};
      options.signal = abortSignal; // pass it to the session for prompt streaming interruptions

      // Check if temperature or topK changed - if so, destroy existing session
      const tempChanged = lastTemperature !== undefined && options?.temperature !== lastTemperature;
      const topKChanged = lastTopK !== undefined && options?.topK !== lastTopK;

      if ((tempChanged || topKChanged) && session.value) {
        session.value.destroy();
        session.value = null;
      }

      // Check availability with the options
      await checkAvailability(options);

      if (availability.value !== 'available') {
        throw new Error(`Language Model is ${availability.value}. It must be 'available' to create a session.`);
      }

      if (typeof LanguageModel?.create !== 'function') {
        throw new Error('LanguageModel.create is not available in this browser');
      }

      const newSession = await LanguageModel.create(options);
      session.value = newSession;

      // Store current options
      lastTemperature = options?.temperature;
      lastTopK = options?.topK;

      updateSessionProperties();

      // Listen for quota overflow
      if (newSession.onquotaoverflow !== undefined) {
        newSession.addEventListener('quotaoverflow', () => {
          updateSessionProperties();
        });
      }

      onCreated?.(newSession);

      return newSession;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err;
      onError?.(err);
      throw err;
    } finally {
      isCreating.value = false;
    }
  };

  // Prompt
  const prompt = async (
    input: LanguageModelPrompt,
    opts?: LLMPromptOptions
  ): Promise<string> => {
    if (!session.value) {
      throw new Error('Session not initialized. Call create() first.');
    }

    try {
      isPrompting.value = true;
      error.value = null;

      const result = await session.value.prompt(input, opts);
      response.value = result;
      updateSessionProperties();

      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err;
      onError?.(err);
      throw err;
    } finally {
      isPrompting.value = false;
    }
  };

  // Prompt streaming
  const promptStreaming = (
    input: LanguageModelPrompt,
    opts?: LLMPromptOptions
  ): ReadableStream<string> => {
    if (!session.value) {
      throw new Error('Session not initialized. Call create() first.');
    }

    try {
      isPrompting.value = true;
      error.value = null;
      response.value = '';

      const stream = session.value.promptStreaming(input, opts);

      // Create a new stream that updates our response ref
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      return new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                updateSessionProperties();
                isPrompting.value = false;
                controller.close();
                break;
              }

              response.value += value;
              controller.enqueue(value);
            }
          } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            error.value = err;
            onError?.(err);
            isPrompting.value = false;
            controller.error(err);
          }
        },
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err;
      onError?.(err);
      isPrompting.value = false;
      throw err;
    }
  };

  // Append
  const append = async (
    input: LanguageModelPrompt,
  ): Promise<void> => {
    if (!session.value) {
      throw new Error('Session not initialized. Call create() first.');
    }

    try {
      error.value = null;
      await session.value.append(input);
      updateSessionProperties();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err;
      onError?.(err);
      throw err;
    }
  };

  // Measure input usage
  const measureInputUsage = async (
    input: LanguageModelPrompt,
    opts?: LLMPromptOptions
  ): Promise<number> => {
    if (!session.value) {
      throw new Error('Session not initialized. Call create() first.');
    }

    try {
      error.value = null;
      const usage = await session.value.measureInputUsage(input, opts);
      return usage;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err;
      onError?.(err);
      throw err;
    }
  };

  // Clone
  const clone = async (opts?: LanguageModelCloneOptions): Promise<LanguageModel> => {
    if (!session.value) {
      throw new Error('Session not initialized. Call create() first.');
    }

    try {
      error.value = null;
      const clonedSession = await session.value.clone(opts);
      return clonedSession;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err;
      onError?.(err);
      throw err;
    }
  };

  const interrupt = (): void => {
    try {
      error.value = null;
      abortController?.abort();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err;
      onError?.(err);
      throw err;
    }
  };

  // Destroy session
  const destroy = () => {
    if (session.value) {
      session.value.destroy();
      session.value = null;
    }
    reset();
  };

  // Reset state
  const reset = () => {
    response.value = '';
    error.value = null;
    inputUsage.value = 0;
    inputQuota.value = 0;
  };

  // Check availability on mount
  onBeforeMount(() => {
    checkAvailability();
  });

  // Auto-create if immediate
  if (immediate) {
    create();
  }

  // Auto-destroy session on unmount
  if (autoDestroy) {
    onBeforeUnmount(() => {
      destroy();
    });
  }

  return {
    session: computed(() => session.value),
    isCreating: computed(() => isCreating.value),
    isPrompting: computed(() => isPrompting.value),
    response: computed(() => response.value),
    error: computed(() => error.value),
    availability: computed(() => availability.value),
    params: computed(() => params.value),
    isReady: computed(() => isReady.value),
    inputUsage: computed(() => inputUsage.value),
    inputQuota: computed(() => inputQuota.value),
    quotaUsagePercent: computed(() => quotaUsagePercent.value),
    temperature,
    topK,
    create,
    checkAvailability,
    prompt,
    promptStreaming,
    interrupt,
    append,
    measureInputUsage,
    clone,
    destroy,
    reset,
  };
}

export { usePromptApiOld as usePromptAPIOld };
