import { computed, ref, shallowRef } from "vue";
import type { BrowserAiConstructor } from "../utils/browserAi";
import {
  collectTextStream,
  createDownloadMonitor,
  safeCheckAvailability,
  useAbortableOperation,
} from "../utils/browserAi";
import { normalizeTextInput, stripHtmlForText } from "../utils/text";

export type WritingAssistantProcessingState<OperationState extends string> =
  "availability" | "create" | "measure" | OperationState | "";

export type WritingAssistantFitStrategy = "error" | "truncate-context";

export type WritingAssistantProgressPhase<ActivePhase extends string> =
  | "idle"
  | "checking"
  | "creating"
  | "measuring"
  | "fitting-context"
  | ActivePhase
  | "ready"
  | "error";

export interface WritingAssistantProgressState<ActivePhase extends string> {
  phase: WritingAssistantProgressPhase<ActivePhase>;
  inputUsage: number | null;
  inputQuota: number | null;
  outputLength: number;
  currentItem: number;
  totalItems: number;
  fitted: boolean;
}

export interface WritingAssistantResult {
  text: string;
  input: string;
  context?: string;
  originalContext?: string;
  inputUsage: number | null;
  inputQuota: number | null;
  fitted: boolean;
}

export type WritingAssistantRunOptions<
  TCreateOptions,
  TNativeOptions extends { context?: string },
  TProgressState,
> = TNativeOptions & {
  createOptions?: TCreateOptions;
  autoCreate?: boolean;
  stripHtml?: boolean;
  fitStrategy?: WritingAssistantFitStrategy;
  inputBudgetRatio?: number;
  onProgress?: (state: TProgressState) => void;
};

export type WritingAssistantBatchItem<
  TNativeOptions extends { context?: string },
> = TNativeOptions & {
  input: string;
  stripHtml?: boolean;
};

export type WritingAssistantBatchOptions<
  TCreateOptions,
  TNativeOptions extends { context?: string },
  TProgressState,
> = Omit<
  WritingAssistantRunOptions<TCreateOptions, TNativeOptions, TProgressState>,
  "context" | "stripHtml"
> & {
  continueOnError?: boolean;
};

type AbortableNativeOptions<TNativeOptions> = TNativeOptions & {
  signal?: AbortSignal;
};

type WritingAssistantInstance<TNativeOptions> = DestroyableModel & {
  measureInputUsage(
    input: string,
    options?: AbortableNativeOptions<TNativeOptions>,
  ): Promise<number>;
  inputQuota: number;
};

type WritingAssistantCreateOptions<TCreateOptions> = TCreateOptions & {
  signal?: AbortSignal;
  monitor?: CreateMonitorCallback;
};

export interface UseWritingAssistantConfig<
  TInstance extends WritingAssistantInstance<TNativeOptions>,
  TCreateOptions,
  TCreateCoreOptions,
  TNativeOptions extends { context?: string },
  TActivePhase extends string,
  TOperationState extends string,
> {
  getConstructor: () =>
    | BrowserAiConstructor<
        TCreateCoreOptions,
        WritingAssistantCreateOptions<TCreateOptions>,
        TInstance
      >
    | undefined;
  getCreateCoreOptions: (options?: TCreateOptions) => TCreateCoreOptions;
  getDefaultCreateOptions: () => TCreateOptions;
  activePhase: TActivePhase;
  operationState: TOperationState;
  unavailableMessage: string;
  uninitializedMessage: string;
  unsupportedMessage: string;
  budgetExceededMessage: (usage: number, budget: number) => string;
  run: (
    instance: TInstance,
    input: string,
    options: AbortableNativeOptions<TNativeOptions>,
  ) => Promise<string>;
  runStreaming: (
    instance: TInstance,
    input: string,
    options: AbortableNativeOptions<TNativeOptions>,
  ) => ReadableStream<string>;
}

const DEFAULT_INPUT_BUDGET_RATIO = 0.88;

const clampRatio = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value as number, 0.2), 0.98);
};

const normalizeAssistantInput = (value: string, stripHtml?: boolean) => {
  return stripHtml ? stripHtmlForText(value) : normalizeTextInput(value);
};

const createEmptyProgressState = <TActivePhase extends string>() =>
  ({
    phase: "idle",
    inputUsage: null,
    inputQuota: null,
    outputLength: 0,
    currentItem: 0,
    totalItems: 0,
    fitted: false,
  }) as WritingAssistantProgressState<TActivePhase>;

export function useWritingAssistant<
  TInstance extends WritingAssistantInstance<TNativeOptions>,
  TCreateOptions,
  TCreateCoreOptions,
  TNativeOptions extends { context?: string },
  TActivePhase extends string,
  TOperationState extends string,
  TProgressState extends WritingAssistantProgressState<TActivePhase>,
>(
  config: UseWritingAssistantConfig<
    TInstance,
    TCreateOptions,
    TCreateCoreOptions,
    TNativeOptions,
    TActivePhase,
    TOperationState
  >,
) {
  type RunOptions = WritingAssistantRunOptions<
    TCreateOptions,
    TNativeOptions,
    TProgressState
  >;
  type BatchOptions = WritingAssistantBatchOptions<
    TCreateOptions,
    TNativeOptions,
    TProgressState
  >;
  type BatchItem = WritingAssistantBatchItem<TNativeOptions>;
  type ProgressCallback = ((state: TProgressState) => void) | undefined;

  const model = shallowRef<TInstance | null>(null);
  const availability = ref<Availability | null>(null);
  const createOptions = ref<TCreateOptions | null>(null);
  const processing = ref<WritingAssistantProcessingState<TOperationState>>("");
  const downloadProgress = ref(0);
  const inputUsage = ref<number | null>(null);
  const inputQuota = ref<number | null>(null);
  const output = ref("");
  const error = ref<unknown>(null);
  const progressState = ref<TProgressState>(
    createEmptyProgressState<TActivePhase>() as TProgressState,
  );
  const lastResult = ref<WritingAssistantResult | null>(null);

  const operation = useAbortableOperation();

  const isReady = computed(() => {
    return model.value !== null && availability.value === "available";
  });

  const isProcessing = computed(() => processing.value !== "");

  const inputQuotaAvailable = computed(() => {
    if (inputQuota.value == null || inputUsage.value == null) {
      return null;
    }

    return Math.max(inputQuota.value - inputUsage.value, 0);
  });

  const updateModelProps = (instance?: TInstance | null) => {
    inputQuota.value = instance?.inputQuota ?? null;
  };

  const setProgressState = (
    patch: Partial<TProgressState>,
    onProgress?: ProgressCallback,
  ) => {
    progressState.value = {
      ...progressState.value,
      ...patch,
    };
    onProgress?.({ ...progressState.value });
  };

  const checkAvailability = async (options?: TCreateCoreOptions) => {
    return safeCheckAvailability(config.getConstructor(), options);
  };

  const requestAvailability = async (options?: TCreateCoreOptions) => {
    processing.value = "availability";
    setProgressState({ phase: "checking" } as Partial<TProgressState>);
    try {
      availability.value = await checkAvailability(options);
      return availability.value;
    } finally {
      processing.value = "";
    }
  };

  const init = async (options = config.getCreateCoreOptions()) => {
    destroy();
    createOptions.value = config.getDefaultCreateOptions();
    const status = await requestAvailability(options);

    if (status === "unavailable") {
      throw new Error(config.unavailableMessage);
    }

    return status;
  };

  const create = async (options = config.getDefaultCreateOptions()) => {
    const Constructor = config.getConstructor();
    if (typeof Constructor?.create !== "function") {
      throw new Error(config.unsupportedMessage);
    }

    const coreOptions = config.getCreateCoreOptions(options);
    createOptions.value = options;

    availability.value = await checkAvailability(coreOptions);
    if (availability.value === "unavailable") {
      throw new Error(config.unavailableMessage);
    }

    processing.value = "create";
    setProgressState({ phase: "creating" } as Partial<TProgressState>);
    const signal = operation.begin();
    destroy();
    downloadProgress.value = 0;

    const monitor = createDownloadMonitor((progress) => {
      downloadProgress.value = progress;
    });

    try {
      model.value = await Constructor.create({
        ...options,
        signal,
        monitor,
      });
      availability.value = "available";
      downloadProgress.value = 100;
      updateModelProps(model.value);
      return model.value;
    } finally {
      operation.end(signal);
      processing.value = "";
    }
  };

  const destroy = () => {
    model.value?.destroy();
    model.value = null;
    updateModelProps(null);
  };

  const dispose = () => {
    interrupt();
    destroy();
    availability.value = null;
    createOptions.value = null;
    downloadProgress.value = 0;
    inputUsage.value = null;
    output.value = "";
    error.value = null;
    lastResult.value = null;
    progressState.value =
      createEmptyProgressState<TActivePhase>() as TProgressState;
    processing.value = "";
  };

  const interrupt = () => {
    operation.interrupt();
  };

  const ensureModel = async (options?: TCreateOptions, autoCreate = true) => {
    if (options) {
      return create(options);
    }

    if (model.value) {
      return model.value;
    }

    if (!autoCreate) {
      throw new Error(config.uninitializedMessage);
    }

    return create(createOptions.value ?? config.getDefaultCreateOptions());
  };

  const getNativeOptions = (
    options: RunOptions | BatchOptions = {} as RunOptions,
  ): TNativeOptions => {
    const {
      createOptions: _createOptions,
      autoCreate: _autoCreate,
      stripHtml: _stripHtml,
      fitStrategy: _fitStrategy,
      inputBudgetRatio: _inputBudgetRatio,
      onProgress: _onProgress,
      continueOnError: _continueOnError,
      ...nativeOptions
    } = options as RunOptions & { continueOnError?: boolean };

    return nativeOptions as TNativeOptions;
  };

  const measureInputUsageInternal = async (
    instance: TInstance,
    input: string,
    options: TNativeOptions | undefined,
    signal: AbortSignal,
  ) => {
    const usage = await instance.measureInputUsage(input, {
      ...options,
      signal,
    } as AbortableNativeOptions<TNativeOptions>);
    inputUsage.value = usage;
    return usage;
  };

  const measureInputUsage = async (
    input: string,
    options: RunOptions = {} as RunOptions,
  ) => {
    const instance = await ensureModel(
      options.createOptions,
      options.autoCreate !== false,
    );
    const normalized = normalizeAssistantInput(input, options.stripHtml);
    const nativeOptions = getNativeOptions(options);

    processing.value = "measure";
    setProgressState(
      {
        phase: "measuring",
        inputQuota: instance.inputQuota,
      } as Partial<TProgressState>,
      options.onProgress,
    );
    const signal = operation.begin();

    try {
      const usage = await measureInputUsageInternal(
        instance,
        normalized,
        nativeOptions,
        signal,
      );
      setProgressState(
        {
          inputUsage: usage,
          inputQuota: instance.inputQuota,
        } as Partial<TProgressState>,
        options.onProgress,
      );
      return usage;
    } finally {
      operation.end(signal);
      processing.value = "";
    }
  };

  const fitContextToBudget = async (
    instance: TInstance,
    input: string,
    context: string,
    nativeOptions: TNativeOptions,
    budget: number,
    signal: AbortSignal,
    onProgress?: ProgressCallback,
  ) => {
    const normalizedContext = normalizeTextInput(context);
    if (!normalizedContext) {
      return {
        context: "",
        usage: await measureInputUsageInternal(
          instance,
          input,
          nativeOptions,
          signal,
        ),
      };
    }

    let low = 0;
    let high = normalizedContext.length;
    let bestContext = "";
    let bestUsage = Number.POSITIVE_INFINITY;

    setProgressState(
      {
        phase: "fitting-context",
        fitted: true,
      } as Partial<TProgressState>,
      onProgress,
    );

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = normalizedContext.slice(0, middle).trim();
      const usage = await measureInputUsageInternal(
        instance,
        input,
        {
          ...nativeOptions,
          context: candidate || undefined,
        },
        signal,
      );

      if (usage <= budget) {
        bestContext = candidate;
        bestUsage = usage;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    const lastBreak = Math.max(
      bestContext.lastIndexOf("\n\n"),
      bestContext.lastIndexOf(". "),
      bestContext.lastIndexOf("! "),
      bestContext.lastIndexOf("? "),
    );
    if (lastBreak > 240) {
      bestContext = bestContext.slice(0, lastBreak + 1).trim();
      bestUsage = await measureInputUsageInternal(
        instance,
        input,
        {
          ...nativeOptions,
          context: bestContext || undefined,
        },
        signal,
      );
    }

    return {
      context: bestContext,
      usage: Number.isFinite(bestUsage) ? bestUsage : null,
    };
  };

  const prepareRunRequest = async (
    instance: TInstance,
    input: string,
    options: RunOptions,
    signal: AbortSignal,
  ) => {
    const normalizedInput = normalizeAssistantInput(input, options.stripHtml);
    const nativeOptions = getNativeOptions(options);
    const normalizedContext = nativeOptions.context
      ? normalizeAssistantInput(nativeOptions.context, options.stripHtml)
      : undefined;
    const runOptions = {
      ...nativeOptions,
      context: normalizedContext || undefined,
    } as TNativeOptions;
    const budget = Math.floor(
      instance.inputQuota *
        clampRatio(options.inputBudgetRatio, DEFAULT_INPUT_BUDGET_RATIO),
    );

    const usage = await measureInputUsageInternal(
      instance,
      normalizedInput,
      runOptions,
      signal,
    );
    inputQuota.value = instance.inputQuota;

    if (usage <= budget || !runOptions.context) {
      return {
        input: normalizedInput,
        options: runOptions,
        usage,
        originalContext: runOptions.context,
        fitted: false,
      };
    }

    if (options.fitStrategy !== "truncate-context") {
      throw new Error(config.budgetExceededMessage(usage, budget));
    }

    const fitted = await fitContextToBudget(
      instance,
      normalizedInput,
      runOptions.context,
      runOptions,
      budget,
      signal,
      options.onProgress,
    );

    return {
      input: normalizedInput,
      options: {
        ...runOptions,
        context: fitted.context || undefined,
      } as TNativeOptions,
      usage: fitted.usage,
      originalContext: runOptions.context,
      fitted: true,
    };
  };

  const runWithDetails = async (
    input: string,
    options: RunOptions = {} as RunOptions,
  ): Promise<WritingAssistantResult> => {
    error.value = null;
    output.value = "";
    lastResult.value = null;

    const instance = await ensureModel(
      options.createOptions,
      options.autoCreate !== false,
    );
    const signal = operation.begin();
    processing.value = config.operationState;

    try {
      setProgressState(
        {
          phase: "measuring",
          inputUsage: null,
          inputQuota: instance.inputQuota,
          outputLength: 0,
          currentItem: 1,
          totalItems: 1,
          fitted: false,
        } as Partial<TProgressState>,
        options.onProgress,
      );

      const prepared = await prepareRunRequest(
        instance,
        input,
        options,
        signal,
      );
      inputUsage.value = prepared.usage;
      inputQuota.value = instance.inputQuota;

      setProgressState(
        {
          phase: config.activePhase,
          inputUsage: prepared.usage,
          inputQuota: instance.inputQuota,
          fitted: prepared.fitted,
        } as Partial<TProgressState>,
        options.onProgress,
      );

      const text = await config.run(instance, prepared.input, {
        ...prepared.options,
        signal,
      } as AbortableNativeOptions<TNativeOptions>);

      output.value = text;
      const result: WritingAssistantResult = {
        text,
        input: prepared.input,
        context: prepared.options.context,
        originalContext: prepared.originalContext,
        inputUsage: prepared.usage,
        inputQuota: instance.inputQuota,
        fitted: prepared.fitted,
      };
      lastResult.value = result;
      setProgressState(
        {
          phase: "ready",
          outputLength: text.length,
        } as Partial<TProgressState>,
        options.onProgress,
      );
      return result;
    } catch (caughtError) {
      error.value = caughtError;
      setProgressState(
        { phase: "error" } as Partial<TProgressState>,
        options.onProgress,
      );
      throw caughtError;
    } finally {
      operation.end(signal);
      processing.value = "";
    }
  };

  const run = async (input: string, options: RunOptions = {} as RunOptions) => {
    const result = await runWithDetails(input, options);
    return result.text;
  };

  const runStreaming = async (
    input: string,
    options: RunOptions = {} as RunOptions,
  ): Promise<ReadableStream<string>> => {
    const instance = await ensureModel(
      options.createOptions,
      options.autoCreate !== false,
    );
    const signal = operation.begin();
    processing.value = config.operationState;
    output.value = "";

    try {
      setProgressState(
        {
          phase: "measuring",
          inputUsage: null,
          inputQuota: instance.inputQuota,
          outputLength: 0,
          currentItem: 1,
          totalItems: 1,
          fitted: false,
        } as Partial<TProgressState>,
        options.onProgress,
      );
      const prepared = await prepareRunRequest(
        instance,
        input,
        options,
        signal,
      );
      inputUsage.value = prepared.usage;
      inputQuota.value = instance.inputQuota;
      setProgressState(
        {
          phase: config.activePhase,
          inputUsage: prepared.usage,
          inputQuota: instance.inputQuota,
          fitted: prepared.fitted,
        } as Partial<TProgressState>,
        options.onProgress,
      );

      const stream = config.runStreaming(instance, prepared.input, {
        ...prepared.options,
        signal,
      } as AbortableNativeOptions<TNativeOptions>);
      const reader = stream.getReader();

      return new ReadableStream<string>({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              lastResult.value = {
                text: output.value,
                input: prepared.input,
                context: prepared.options.context,
                originalContext: prepared.originalContext,
                inputUsage: prepared.usage,
                inputQuota: instance.inputQuota,
                fitted: prepared.fitted,
              };
              controller.close();
              operation.end(signal);
              processing.value = "";
              setProgressState(
                {
                  phase: "ready",
                  outputLength: output.value.length,
                } as Partial<TProgressState>,
                options.onProgress,
              );
              return;
            }

            output.value += value;
            setProgressState(
              {
                outputLength: output.value.length,
              } as Partial<TProgressState>,
              options.onProgress,
            );
            controller.enqueue(value);
          } catch (streamError) {
            error.value = streamError;
            operation.end(signal);
            processing.value = "";
            setProgressState(
              { phase: "error" } as Partial<TProgressState>,
              options.onProgress,
            );
            controller.error(streamError);
          }
        },
        cancel(reason) {
          operation.end(signal);
          processing.value = "";
          return reader.cancel(reason);
        },
      });
    } catch (caughtError) {
      operation.end(signal);
      processing.value = "";
      error.value = caughtError;
      setProgressState(
        { phase: "error" } as Partial<TProgressState>,
        options.onProgress,
      );
      throw caughtError;
    }
  };

  const runStreamingToText = async (
    input: string,
    options: RunOptions = {} as RunOptions,
    onChunk?: (chunk: string, accumulated: string) => void,
  ) => {
    output.value = "";
    const stream = await runStreaming(input, options);
    const result = await collectTextStream(stream, onChunk);
    output.value = result;
    return result;
  };

  const runMany = async (
    items: BatchItem[],
    options: BatchOptions = {} as BatchOptions,
  ) => {
    const results: Array<WritingAssistantResult | null> = [];
    const failures: unknown[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      setProgressState(
        {
          phase: config.activePhase,
          currentItem: index + 1,
          totalItems: items.length,
        } as Partial<TProgressState>,
        options.onProgress,
      );

      try {
        results.push(
          await runWithDetails(item.input, {
            ...options,
            context: item.context,
            stripHtml: item.stripHtml,
          } as RunOptions),
        );
      } catch (caughtError) {
        failures.push(caughtError);
        results.push(null);
        if (!options.continueOnError) {
          throw caughtError;
        }
      }
    }

    return { results, failures };
  };

  return {
    model: computed(() => model.value),
    processing: computed(() => processing.value),
    availability: computed(() => availability.value),
    downloadProgress: computed(() => downloadProgress.value),
    inputUsage: computed(() => inputUsage.value),
    inputQuota: computed(() => inputQuota.value),
    inputQuotaAvailable,
    output: computed(() => output.value),
    error: computed(() => error.value),
    progressState: computed(() => progressState.value),
    lastResult: computed(() => lastResult.value),
    isReady,
    isProcessing,
    checkAvailability,
    requestAvailability,
    init,
    create,
    destroy,
    dispose,
    measureInputUsage,
    run,
    runWithDetails,
    runStreaming,
    runStreamingToText,
    runMany,
    interrupt,
  };
}
