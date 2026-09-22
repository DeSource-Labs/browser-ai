import { createBrowserAiStore } from '../store.js';
import { projectWorkflow } from './state.js';
import { createWorkflowSession } from './lifecycle.js';
import type { BrowserAiConstructor } from '../platform.js';
import { collectTextStream, createDownloadMonitor, safeCheckAvailability, createAbortManager } from '../platform.js';
import { normalizeTextInput, stripHtmlForText } from '../text.js';
import { equalOptions } from '../model.js';
export type WritingAssistantProcessingState<OperationState extends string> =
  'availability' | 'create' | 'measure' | OperationState | '';
export type WritingAssistantFitStrategy = 'error' | 'truncate-context';
export type WritingAssistantProgressPhase<ActivePhase extends string> =
  'idle' | 'checking' | 'creating' | 'measuring' | 'fitting-context' | ActivePhase | 'ready' | 'error';
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
  TNativeOptions extends {
    context?: string;
  },
  TProgressState
> = TNativeOptions & {
  createOptions?: TCreateOptions;
  autoCreate?: boolean;
  stripHtml?: boolean;
  fitStrategy?: WritingAssistantFitStrategy;
  inputBudgetRatio?: number;
  onProgress?: (state: TProgressState) => void;
};
export type WritingAssistantBatchItem<
  TNativeOptions extends {
    context?: string;
  }
> = TNativeOptions & {
  input: string;
  stripHtml?: boolean;
};
export type WritingAssistantBatchOptions<
  TCreateOptions,
  TNativeOptions extends {
    context?: string;
  },
  TProgressState
> = Omit<WritingAssistantRunOptions<TCreateOptions, TNativeOptions, TProgressState>, 'context' | 'stripHtml'> & {
  continueOnError?: boolean;
};
type AbortableNativeOptions<TNativeOptions> = TNativeOptions & {
  signal?: AbortSignal;
};
type WritingAssistantInstance<TNativeOptions> = DestroyableModel & {
  measureInputUsage(input: string, options?: AbortableNativeOptions<TNativeOptions>): Promise<number>;
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
  TNativeOptions extends {
    context?: string;
  },
  TActivePhase extends string,
  TOperationState extends string
> {
  getConstructor: () =>
    BrowserAiConstructor<TCreateCoreOptions, WritingAssistantCreateOptions<TCreateOptions>, TInstance> | undefined;
  getCreateCoreOptions: (options?: TCreateOptions) => TCreateCoreOptions;
  getDefaultCreateOptions: () => TCreateOptions;
  activePhase: TActivePhase;
  operationState: TOperationState;
  unavailableMessage: string;
  uninitializedMessage: string;
  unsupportedMessage: string;
  budgetExceededMessage: (usage: number, budget: number) => string;
  run: (instance: TInstance, input: string, options: AbortableNativeOptions<TNativeOptions>) => Promise<string>;
  runStreaming: (
    instance: TInstance,
    input: string,
    options: AbortableNativeOptions<TNativeOptions>
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
    phase: 'idle',
    inputUsage: null,
    inputQuota: null,
    outputLength: 0,
    currentItem: 0,
    totalItems: 0,
    fitted: false
  }) as WritingAssistantProgressState<TActivePhase>;
export function createWritingWorkflow<
  TInstance extends WritingAssistantInstance<TNativeOptions>,
  TCreateOptions,
  TCreateCoreOptions,
  TNativeOptions extends {
    context?: string;
  },
  TActivePhase extends string,
  TOperationState extends string,
  TProgressState extends WritingAssistantProgressState<TActivePhase>
>(
  config: UseWritingAssistantConfig<
    TInstance,
    TCreateOptions,
    TCreateCoreOptions,
    TNativeOptions,
    TActivePhase,
    TOperationState
  >
) {
  type RunOptions = WritingAssistantRunOptions<TCreateOptions, TNativeOptions, TProgressState>;
  type BatchOptions = WritingAssistantBatchOptions<TCreateOptions, TNativeOptions, TProgressState>;
  type BatchItem = WritingAssistantBatchItem<TNativeOptions>;
  type ProgressCallback = ((state: TProgressState) => void) | undefined;
  let current = {
    model: null as TInstance | null,
    availability: null as Availability | null,
    createOptions: null as TCreateOptions | null,
    processing: '' as WritingAssistantProcessingState<TOperationState>,
    downloadProgress: 0,
    inputUsage: null as number | null,
    inputQuota: null as number | null,
    output: '',
    error: null as unknown,
    progressState: createEmptyProgressState<TActivePhase>() as TProgressState as TProgressState,
    lastResult: null as WritingAssistantResult | null
  };
  const store = createBrowserAiStore(current);
  const update = (patch: Partial<typeof current>) => {
    current = { ...current, ...patch };
    store.update(() => current);
  };
  const operation = createAbortManager();
  let availabilityRequest = 0;
  const assertCurrent = (signal: AbortSignal) => {
    signal.throwIfAborted();
    if (!operation.isCurrent(signal)) throw new DOMException('The operation was interrupted.', 'AbortError');
  };
  const begin = (processing: WritingAssistantProcessingState<TOperationState>) => {
    availabilityRequest += 1;
    const signal = operation.begin();
    update({ processing, error: null });
    return signal;
  };
  const finish = (signal: AbortSignal) => {
    if (operation.end(signal)) update({ processing: '' });
  };
  const isReady = () => {
    return current.model !== null && current.availability === 'available';
  };
  const isProcessing = () => current.processing !== '';
  const inputQuotaAvailable = () => {
    if (current.inputQuota == null || current.inputUsage == null) {
      return null;
    }
    return Math.max(current.inputQuota - current.inputUsage, 0);
  };
  const updateModelProps = (instance?: TInstance | null) => {
    update({ inputQuota: instance?.inputQuota ?? null });
  };
  const setProgressState = (patch: Partial<TProgressState>, onProgress?: ProgressCallback, signal?: AbortSignal) => {
    if (signal) assertCurrent(signal);
    update({
      progressState: {
        ...current.progressState,
        ...patch
      }
    });
    onProgress?.({ ...current.progressState });
    if (signal) assertCurrent(signal);
  };
  const recordError = (error: unknown, signal: AbortSignal, onProgress?: ProgressCallback) => {
    if (!operation.isCurrent(signal)) return;
    update({ error, progressState: { ...current.progressState, phase: 'error' } });
    try {
      onProgress?.({ ...current.progressState });
    } catch {
      // Preserve the original error if a progress callback also fails.
    }
  };
  const checkAvailability = async (options?: TCreateCoreOptions) => {
    return safeCheckAvailability(config.getConstructor(), options);
  };
  const requestAvailability = async (options?: TCreateCoreOptions) => {
    const request = ++availabilityRequest;
    const ownsProcessing = !operation.signal;
    if (ownsProcessing) {
      update({ processing: 'availability' });
      setProgressState({ phase: 'checking' } as Partial<TProgressState>);
    }
    try {
      const availabilityValue = await checkAvailability(options);
      if (request === availabilityRequest) update({ availability: availabilityValue });
      return availabilityValue;
    } finally {
      if (request === availabilityRequest && ownsProcessing) update({ processing: '' });
    }
  };
  const init = async (options = config.getCreateCoreOptions()) => {
    destroy();
    update({ createOptions: config.getDefaultCreateOptions() });
    const status = await requestAvailability(options);
    if (status === 'unavailable') {
      throw new Error(config.unavailableMessage);
    }
    return status;
  };
  const createInternal = async (options: TCreateOptions, signal: AbortSignal) => {
    assertCurrent(signal);
    const Constructor = config.getConstructor();
    if (typeof Constructor?.create !== 'function') {
      throw new Error(config.unsupportedMessage);
    }
    const coreOptions = config.getCreateCoreOptions(options);
    const availabilityValue = await checkAvailability(coreOptions);
    assertCurrent(signal);
    update({ availability: availabilityValue });
    if (availabilityValue === 'unavailable') {
      throw new Error(config.unavailableMessage);
    }
    update({ processing: 'create' });
    setProgressState({ phase: 'creating' } as Partial<TProgressState>, undefined, signal);
    update({ downloadProgress: 0 });
    const monitor = createDownloadMonitor((progress) => {
      if (operation.isCurrent(signal)) update({ downloadProgress: progress });
    });
    const instance = await createWorkflowSession(signal, (creationSignal) =>
      Constructor.create!({ ...options, signal: creationSignal, monitor })
    );
    if (!operation.isCurrent(signal) || signal.aborted) {
      instance.destroy();
      assertCurrent(signal);
    }
    current.model?.destroy();
    update({ model: instance, createOptions: options, availability: 'available', downloadProgress: 100 });
    signal.throwIfAborted();
    updateModelProps(instance);
    signal.throwIfAborted();
    return instance;
  };
  const create = async (options = config.getDefaultCreateOptions()) => {
    const signal = begin('create');
    try {
      return await createInternal(options, signal);
    } catch (error) {
      recordError(error, signal);
      throw error;
    } finally {
      finish(signal);
    }
  };
  const destroy = () => {
    interrupt();
    current.model?.destroy();
    update({ model: null });
    updateModelProps(null);
  };
  const dispose = () => {
    interrupt();
    destroy();
    update({ availability: null });
    update({ createOptions: null });
    update({ downloadProgress: 0 });
    update({ inputUsage: null });
    update({ output: '' });
    update({ error: null });
    update({ lastResult: null });
    update({ progressState: createEmptyProgressState<TActivePhase>() as TProgressState });
    update({ processing: '' });
  };
  const interrupt = () => {
    availabilityRequest += 1;
    operation.interrupt();
    update({ processing: '' });
  };
  const ensureModel = async (options: TCreateOptions | undefined, autoCreate: boolean, signal: AbortSignal) => {
    assertCurrent(signal);
    const desiredOptions = options ?? current.createOptions ?? config.getDefaultCreateOptions();
    if (current.model && equalOptions(desiredOptions, current.createOptions)) {
      return current.model;
    }
    if (!options && !autoCreate) {
      throw new Error(config.uninitializedMessage);
    }
    return createInternal(desiredOptions, signal);
  };
  const getNativeOptions = (options: RunOptions | BatchOptions = {} as RunOptions): TNativeOptions => {
    const {
      createOptions: _createOptions,
      autoCreate: _autoCreate,
      stripHtml: _stripHtml,
      fitStrategy: _fitStrategy,
      inputBudgetRatio: _inputBudgetRatio,
      onProgress: _onProgress,
      continueOnError: _continueOnError,
      ...nativeOptions
    } = options as RunOptions & {
      continueOnError?: boolean;
    };
    return nativeOptions as TNativeOptions;
  };
  const measureInputUsageInternal = async (
    instance: TInstance,
    input: string,
    options: TNativeOptions | undefined,
    signal: AbortSignal
  ) => {
    assertCurrent(signal);
    const usage = await instance.measureInputUsage(input, {
      ...options,
      signal
    } as AbortableNativeOptions<TNativeOptions>);
    assertCurrent(signal);
    update({ inputUsage: usage });
    return usage;
  };
  const measureInputUsage = async (input: string, options: RunOptions = {} as RunOptions) => {
    const signal = begin('measure');
    try {
      const instance = await ensureModel(options.createOptions, options.autoCreate !== false, signal);
      assertCurrent(signal);
      const normalized = normalizeAssistantInput(input, options.stripHtml);
      const nativeOptions = getNativeOptions(options);
      update({ processing: 'measure' });
      setProgressState(
        { phase: 'measuring', inputQuota: instance.inputQuota } as Partial<TProgressState>,
        options.onProgress,
        signal
      );
      const usage = await measureInputUsageInternal(instance, normalized, nativeOptions, signal);
      setProgressState(
        {
          inputUsage: usage,
          inputQuota: instance.inputQuota
        } as Partial<TProgressState>,
        options.onProgress,
        signal
      );
      return usage;
    } catch (error) {
      recordError(error, signal, options.onProgress);
      throw error;
    } finally {
      finish(signal);
    }
  };
  const fitContextToBudget = async (
    instance: TInstance,
    input: string,
    context: string,
    nativeOptions: TNativeOptions,
    budget: number,
    signal: AbortSignal,
    onProgress?: ProgressCallback
  ) => {
    const normalizedContext = normalizeTextInput(context);
    let low = 0;
    let high = normalizedContext.length;
    let bestContext = '';
    let bestUsage = Number.POSITIVE_INFINITY;
    setProgressState(
      {
        phase: 'fitting-context',
        fitted: true
      } as Partial<TProgressState>,
      onProgress,
      signal
    );
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = normalizedContext.slice(0, middle).trim();
      const usage = await measureInputUsageInternal(
        instance,
        input,
        {
          ...nativeOptions,
          context: candidate || undefined
        },
        signal
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
      bestContext.lastIndexOf('\n\n'),
      bestContext.lastIndexOf('. '),
      bestContext.lastIndexOf('! '),
      bestContext.lastIndexOf('? ')
    );
    if (lastBreak > 240) {
      bestContext = bestContext.slice(0, lastBreak + 1).trim();
      bestUsage = await measureInputUsageInternal(
        instance,
        input,
        {
          ...nativeOptions,
          context: bestContext || undefined
        },
        signal
      );
    }
    return {
      context: bestContext,
      usage: Number.isFinite(bestUsage) ? bestUsage : null
    };
  };
  const prepareRunRequest = async (instance: TInstance, input: string, options: RunOptions, signal: AbortSignal) => {
    const normalizedInput = normalizeAssistantInput(input, options.stripHtml);
    const nativeOptions = getNativeOptions(options);
    const normalizedContext = nativeOptions.context
      ? normalizeAssistantInput(nativeOptions.context, options.stripHtml)
      : undefined;
    const runOptions = {
      ...nativeOptions,
      context: normalizedContext || undefined
    } as TNativeOptions;
    const budget = Math.floor(instance.inputQuota * clampRatio(options.inputBudgetRatio, DEFAULT_INPUT_BUDGET_RATIO));
    const usage = await measureInputUsageInternal(instance, normalizedInput, runOptions, signal);
    assertCurrent(signal);
    update({ inputQuota: instance.inputQuota });
    if (usage <= budget || !runOptions.context) {
      return {
        input: normalizedInput,
        options: runOptions,
        usage,
        originalContext: runOptions.context,
        fitted: false
      };
    }
    if (options.fitStrategy !== 'truncate-context') {
      throw new Error(config.budgetExceededMessage(usage, budget));
    }
    const fitted = await fitContextToBudget(
      instance,
      normalizedInput,
      runOptions.context,
      runOptions,
      budget,
      signal,
      options.onProgress
    );
    assertCurrent(signal);
    if (fitted.usage == null || fitted.usage > budget) {
      throw new Error(config.budgetExceededMessage(usage, budget));
    }
    return {
      input: normalizedInput,
      options: {
        ...runOptions,
        context: fitted.context || undefined
      } as TNativeOptions,
      usage: fitted.usage,
      originalContext: runOptions.context,
      fitted: true
    };
  };
  const runWithDetailsInternal = async (
    input: string,
    options: RunOptions,
    signal: AbortSignal,
    currentItem = 1,
    totalItems = 1
  ): Promise<WritingAssistantResult> => {
    assertCurrent(signal);
    update({ error: null });
    update({ output: '' });
    update({ lastResult: null });
    try {
      const instance = await ensureModel(options.createOptions, options.autoCreate !== false, signal);
      assertCurrent(signal);
      update({ processing: config.operationState });
      setProgressState(
        {
          phase: 'measuring',
          inputUsage: null,
          inputQuota: instance.inputQuota,
          outputLength: 0,
          currentItem,
          totalItems,
          fitted: false
        } as Partial<TProgressState>,
        options.onProgress,
        signal
      );
      const prepared = await prepareRunRequest(instance, input, options, signal);
      assertCurrent(signal);
      update({ inputUsage: prepared.usage });
      update({ inputQuota: instance.inputQuota });
      setProgressState(
        {
          phase: config.activePhase,
          inputUsage: prepared.usage,
          inputQuota: instance.inputQuota,
          fitted: prepared.fitted
        } as Partial<TProgressState>,
        options.onProgress,
        signal
      );
      const text = await config.run(instance, prepared.input, {
        ...prepared.options,
        signal
      } as AbortableNativeOptions<TNativeOptions>);
      assertCurrent(signal);
      update({ output: text });
      const result: WritingAssistantResult = {
        text,
        input: prepared.input,
        context: prepared.options.context,
        originalContext: prepared.originalContext,
        inputUsage: prepared.usage,
        inputQuota: instance.inputQuota,
        fitted: prepared.fitted
      };
      update({ lastResult: result });
      setProgressState(
        {
          phase: 'ready',
          outputLength: text.length
        } as Partial<TProgressState>,
        options.onProgress,
        signal
      );
      return result;
    } catch (caughtError) {
      recordError(caughtError, signal, options.onProgress);
      throw caughtError;
    }
  };
  const runWithDetails = async (input: string, options: RunOptions = {} as RunOptions) => {
    const signal = begin(config.operationState);
    try {
      return await runWithDetailsInternal(input, options, signal);
    } finally {
      finish(signal);
    }
  };
  const run = async (input: string, options: RunOptions = {} as RunOptions) => {
    const result = await runWithDetails(input, options);
    return result.text;
  };
  const runStreaming = async (
    input: string,
    options: RunOptions = {} as RunOptions
  ): Promise<ReadableStream<string>> => {
    const signal = begin(config.operationState);
    update({ output: '', lastResult: null });
    try {
      const instance = await ensureModel(options.createOptions, options.autoCreate !== false, signal);
      assertCurrent(signal);
      update({ processing: config.operationState });
      setProgressState(
        {
          phase: 'measuring',
          inputUsage: null,
          inputQuota: instance.inputQuota,
          outputLength: 0,
          currentItem: 1,
          totalItems: 1,
          fitted: false
        } as Partial<TProgressState>,
        options.onProgress,
        signal
      );
      const prepared = await prepareRunRequest(instance, input, options, signal);
      assertCurrent(signal);
      update({ inputUsage: prepared.usage });
      update({ inputQuota: instance.inputQuota });
      setProgressState(
        {
          phase: config.activePhase,
          inputUsage: prepared.usage,
          inputQuota: instance.inputQuota,
          fitted: prepared.fitted
        } as Partial<TProgressState>,
        options.onProgress,
        signal
      );
      const stream = config.runStreaming(instance, prepared.input, {
        ...prepared.options,
        signal
      } as AbortableNativeOptions<TNativeOptions>);
      const reader = stream.getReader();
      let output = '';
      let cancelled = false;
      let released = false;
      let cancellation: Promise<void> | undefined;
      const cleanup = () => {
        if (released) return;
        released = true;
        signal.removeEventListener('abort', handleAbort);
        reader.releaseLock();
        finish(signal);
      };
      const cancelReader = (reason: unknown) => {
        cancellation ??= reader.cancel(reason).finally(cleanup);
        return cancellation;
      };
      const handleAbort = () => void cancelReader(signal.reason).catch(() => undefined);
      signal.addEventListener('abort', handleAbort, { once: true });
      return new ReadableStream<string>({
        async pull(controller) {
          try {
            assertCurrent(signal);
            const { done, value } = await reader.read();
            if (cancelled) return;
            assertCurrent(signal);
            if (done) {
              update({
                lastResult: {
                  text: output,
                  input: prepared.input,
                  context: prepared.options.context,
                  originalContext: prepared.originalContext,
                  inputUsage: prepared.usage,
                  inputQuota: instance.inputQuota,
                  fitted: prepared.fitted
                }
              });
              setProgressState(
                {
                  phase: 'ready',
                  outputLength: output.length
                } as Partial<TProgressState>,
                options.onProgress,
                signal
              );
              controller.close();
              cleanup();
              return;
            }
            output += value;
            update({ output });
            setProgressState(
              {
                outputLength: output.length
              } as Partial<TProgressState>,
              options.onProgress,
              signal
            );
            controller.enqueue(value);
          } catch (streamError) {
            if (cancelled) return;
            recordError(streamError, signal, options.onProgress);
            controller.error(streamError);
            try {
              await cancelReader(streamError);
            } catch {
              // Preserve the stream error when native cancellation also fails.
            }
          }
        },
        cancel(reason) {
          cancelled = true;
          finish(signal);
          return cancelReader(reason);
        }
      });
    } catch (caughtError) {
      recordError(caughtError, signal, options.onProgress);
      finish(signal);
      throw caughtError;
    }
  };
  const runStreamingToText = async (
    input: string,
    options: RunOptions = {} as RunOptions,
    onChunk?: (chunk: string, accumulated: string) => void
  ) => {
    const stream = await runStreaming(input, options);
    return collectTextStream(stream, onChunk);
  };
  const runMany = async (items: BatchItem[], options: BatchOptions = {} as BatchOptions) => {
    const signal = begin(config.operationState);
    const results: Array<WritingAssistantResult | null> = [];
    const failures: unknown[] = [];
    try {
      for (let index = 0; index < items.length; index += 1) {
        assertCurrent(signal);
        const item = items[index];
        try {
          results.push(
            await runWithDetailsInternal(
              item.input,
              {
                ...options,
                context: item.context,
                stripHtml: item.stripHtml
              } as RunOptions,
              signal,
              index + 1,
              items.length
            )
          );
        } catch (caughtError) {
          assertCurrent(signal);
          failures.push(caughtError);
          results.push(null);
          if (!options.continueOnError) throw caughtError;
        }
      }
      return { results, failures };
    } finally {
      finish(signal);
    }
  };
  return projectWorkflow(
    store,
    () => ({
      model: current.model,
      processing: current.processing,
      availability: current.availability,
      downloadProgress: current.downloadProgress,
      inputUsage: current.inputUsage,
      inputQuota: current.inputQuota,
      inputQuotaAvailable: inputQuotaAvailable(),
      output: current.output,
      error: current.error,
      progressState: current.progressState,
      lastResult: current.lastResult,
      isReady: isReady(),
      isProcessing: isProcessing()
    }),
    {
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
      interrupt
    }
  );
}
