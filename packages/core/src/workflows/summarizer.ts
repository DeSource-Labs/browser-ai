import { createWorkflowSession } from './lifecycle.js';
import { equalOptions } from '../model.js';
import { createBrowserAiStore } from '../store.js';
import { projectWorkflow } from './state.js';
import {
  collectTextStream,
  observeTextStream,
  createDownloadMonitor,
  isAbortError,
  safeCheckAvailability,
  createAbortManager
} from '../platform.js';
import {
  buildMeasuredTextChunks,
  normalizeTextInput as normalizeSummaryInput,
  stripHtmlForText as stripHtmlForSummary,
  type TextChunk
} from '../text.js';
export type SummarizerAvailability = Availability;
export type SummarizerProcessingState = 'availability' | 'create' | 'measure' | 'summarize' | '';
export type SummarizerCreateCore = SummarizerCreateCoreOptions;
export type SummarizerCreate = Omit<SummarizerCreateOptions, 'signal' | 'monitor'>;
export type SummarizerRunNativeOptions = Omit<SummarizerSummarizeOptions, 'signal'>;
export type SummarizerProgressPhase =
  'idle' | 'checking' | 'creating' | 'measuring' | 'chunking' | 'summarizing' | 'rolling-up' | 'ready' | 'error';
export interface SummarizerProgressState {
  phase: SummarizerProgressPhase;
  inputUsage: number | null;
  inputQuota: number | null;
  processedChunks: number;
  totalChunks: number;
  currentChunk: number;
  outputLength: number;
  chunked: boolean;
}
export interface SummarizerChunkResult {
  index: number;
  input: string;
  summary: string;
  usage: number | null;
  start: number;
  end: number;
}
export interface SummarizerResult {
  summary: string;
  input: string;
  inputUsage: number | null;
  inputQuota: number | null;
  chunked: boolean;
  chunks: SummarizerChunkResult[];
  rollupRounds: number;
}
export interface SummarizerRunOptions extends SummarizerRunNativeOptions {
  createOptions?: SummarizerCreate;
  autoCreate?: boolean;
  stripHtml?: boolean;
  chunking?: 'auto' | 'never';
  chunkBudgetRatio?: number;
  maxRollupRounds?: number;
  onProgress?: (state: SummarizerProgressState) => void;
}
type GlobalWithSummarizer = typeof globalThis & {
  Summarizer?: typeof Summarizer;
};
const DEFAULT_CHUNK_BUDGET_RATIO = 0.72;
const DEFAULT_MAX_ROLLUP_ROUNDS = 4;
const getSummarizer = () => {
  return (globalThis as GlobalWithSummarizer).Summarizer;
};
const createEmptyProgressState = (): SummarizerProgressState => ({
  phase: 'idle',
  inputUsage: null,
  inputQuota: null,
  processedChunks: 0,
  totalChunks: 0,
  currentChunk: 0,
  outputLength: 0,
  chunked: false
});
const getCreateCoreOptions = (options: SummarizerCreate = {}): SummarizerCreateCoreOptions => {
  const { sharedContext: _sharedContext, ...coreOptions } = options;
  return coreOptions;
};
const getNativeSummarizeOptions = (options: SummarizerRunOptions = {}): SummarizerRunNativeOptions => {
  const {
    createOptions: _createOptions,
    autoCreate: _autoCreate,
    stripHtml: _stripHtml,
    chunking: _chunking,
    chunkBudgetRatio: _chunkBudgetRatio,
    maxRollupRounds: _maxRollupRounds,
    onProgress: _onProgress,
    ...nativeOptions
  } = options;
  return nativeOptions;
};
const clampRatio = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value as number, 0.2), 0.95);
};
export function createSummarizerWorkflow() {
  let current = {
    summarizer: null as Summarizer | null,
    availability: null as Availability | null,
    createOptions: null as SummarizerCreate | null,
    processing: '' as SummarizerProcessingState,
    downloadProgress: 0,
    inputUsage: null as number | null,
    inputQuota: null as number | null,
    output: '',
    error: null as unknown,
    progressState: createEmptyProgressState() as SummarizerProgressState,
    lastResult: null as SummarizerResult | null
  };
  const store = createBrowserAiStore(current);
  const update = (patch: Partial<typeof current>, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    current = { ...current, ...patch };
    store.update(() => current);
    signal?.throwIfAborted();
  };
  const operation = createAbortManager();
  let availabilityVersion = 0;
  const isReady = () => {
    return current.summarizer !== null && current.availability === 'available';
  };
  const isProcessing = () => current.processing !== '';
  const inputQuotaAvailable = () => {
    if (current.inputQuota == null || current.inputUsage == null) {
      return null;
    }
    return Math.max(current.inputQuota - current.inputUsage, 0);
  };
  const updateModelProps = (instance?: Summarizer | null) => {
    update({ inputQuota: instance?.inputQuota ?? null });
  };
  const setProgressState = (
    patch: Partial<SummarizerProgressState>,
    onProgress?: SummarizerRunOptions['onProgress'],
    signal?: AbortSignal
  ) => {
    update(
      {
        progressState: {
          ...current.progressState,
          ...patch
        }
      },
      signal
    );
    onProgress?.({ ...current.progressState });
    signal?.throwIfAborted();
  };
  const checkAvailability = async (options: SummarizerCreateCoreOptions = {}) => {
    return safeCheckAvailability(getSummarizer(), options);
  };
  const requestAvailability = async (options: SummarizerCreateCoreOptions = {}) => {
    const version = ++availabilityVersion;
    const ownsProcessing = !operation.signal;
    if (ownsProcessing) {
      update({ processing: 'availability' });
      setProgressState({ phase: 'checking' });
    }
    try {
      const availabilityValue = await checkAvailability(options);
      if (version === availabilityVersion) update({ availability: availabilityValue });
      return availabilityValue;
    } finally {
      if (version === availabilityVersion && ownsProcessing && !operation.signal) update({ processing: '' });
    }
  };
  const init = async (options: SummarizerCreateCoreOptions = {}) => {
    destroy();
    update({ createOptions: options });
    const status = await requestAvailability(options);
    if (status === 'unavailable') {
      throw new Error('Summarizer is unavailable with the provided options.');
    }
    return status;
  };
  const createInternal = async (options: SummarizerCreate, signal: AbortSignal) => {
    signal.throwIfAborted();
    availabilityVersion += 1;
    const Constructor = getSummarizer();
    if (typeof Constructor?.create !== 'function') {
      throw new Error('Summarizer is not available in this browser context.');
    }
    const normalizedOptions = options;
    update({ processing: 'create', downloadProgress: 0 }, signal);
    setProgressState({ phase: 'creating' }, undefined, signal);
    const availabilityValue = await checkAvailability(getCreateCoreOptions(normalizedOptions));
    signal.throwIfAborted();
    if (!current.summarizer) update({ availability: availabilityValue }, signal);
    if (availabilityValue === 'unavailable') throw new Error('Summarizer is unavailable with the provided options.');
    const instance = await createWorkflowSession(signal, (creationSignal) =>
      Constructor.create({
        ...normalizedOptions,
        signal: creationSignal,
        monitor: createDownloadMonitor((progress) => {
          if (operation.isCurrent(signal)) update({ downloadProgress: progress }, signal);
        })
      })
    );
    if (signal.aborted) {
      instance.destroy();
      signal.throwIfAborted();
    }
    current.summarizer?.destroy();
    update(
      {
        summarizer: instance,
        createOptions: normalizedOptions,
        availability: 'available',
        downloadProgress: 100
      },
      signal
    );
    signal.throwIfAborted();
    updateModelProps(instance);
    signal.throwIfAborted();
    return instance;
  };
  const create = async (options: SummarizerCreate = {}) => {
    const signal = operation.begin();
    try {
      return await createInternal(options, signal);
    } finally {
      if (operation.end(signal)) update({ processing: '' });
    }
  };
  const destroy = () => {
    interrupt();
    current.summarizer?.destroy();
    update({ summarizer: null });
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
    update({ lastResult: null });
    update({ progressState: createEmptyProgressState() });
    update({ processing: '' });
  };
  const interrupt = () => {
    availabilityVersion += 1;
    operation.interrupt();
    update({ processing: '' });
  };
  const ensureSummarizer = async (options: SummarizerCreate | undefined, autoCreate: boolean, signal: AbortSignal) => {
    signal.throwIfAborted();
    const nextOptions = options ?? current.createOptions ?? {};
    if (current.summarizer && equalOptions(nextOptions, current.createOptions)) return current.summarizer;
    if (!autoCreate) throw new Error('Summarizer is not initialized. Call create() first or enable autoCreate.');
    return createInternal(nextOptions, signal);
  };
  const measureInputUsageInternal = async (
    instance: Summarizer,
    input: string,
    options: SummarizerRunNativeOptions | undefined,
    signal: AbortSignal
  ) => {
    signal.throwIfAborted();
    const usage = await instance.measureInputUsage(input, {
      ...options,
      signal
    });
    signal.throwIfAborted();
    update({ inputUsage: usage }, signal);
    return usage;
  };
  const measureInputUsage = async (input: string, options: SummarizerRunOptions = {}) => {
    const signal = operation.begin();
    try {
      const instance = await ensureSummarizer(options.createOptions, options.autoCreate !== false, signal);
      signal.throwIfAborted();
      const normalized = options.stripHtml ? stripHtmlForSummary(input) : normalizeSummaryInput(input);
      const nativeOptions = getNativeSummarizeOptions(options);
      update({ processing: 'measure' }, signal);
      setProgressState({ phase: 'measuring', inputQuota: instance.inputQuota }, undefined, signal);
      const usage = await measureInputUsageInternal(instance, normalized, nativeOptions, signal);
      signal.throwIfAborted();
      setProgressState(
        {
          inputUsage: usage,
          inputQuota: instance.inputQuota
        },
        options.onProgress,
        signal
      );
      return usage;
    } finally {
      if (operation.end(signal)) update({ processing: '' });
    }
  };
  const measureWithSignal = async (
    instance: Summarizer,
    input: string,
    options: SummarizerRunNativeOptions | undefined,
    signal: AbortSignal
  ) => {
    try {
      return await measureInputUsageInternal(instance, input, options, signal);
    } catch (caughtError) {
      signal.throwIfAborted();
      if (isAbortError(caughtError)) {
        throw caughtError;
      }
      return Number.POSITIVE_INFINITY;
    }
  };
  const buildMeasuredChunks = async (
    input: string,
    budget: number,
    instance: Summarizer,
    options: SummarizerRunNativeOptions | undefined,
    signal: AbortSignal,
    onProgress?: SummarizerRunOptions['onProgress']
  ) => {
    return buildMeasuredTextChunks({
      input,
      budget,
      measure: (candidate) => measureWithSignal(instance, candidate, options, signal),
      onProgress: (chunks) =>
        setProgressState(
          {
            phase: 'chunking',
            processedChunks: chunks.length,
            totalChunks: Math.max(chunks.length + 1, 1),
            chunked: true
          },
          onProgress,
          signal
        )
    });
  };
  const summarizeChunk = async (
    instance: Summarizer,
    chunk: TextChunk,
    options: SummarizerRunNativeOptions | undefined,
    signal: AbortSignal
  ): Promise<SummarizerChunkResult> => {
    const usage = await measureWithSignal(instance, chunk.text, options, signal);
    signal.throwIfAborted();
    const summary = await instance.summarize(chunk.text, {
      ...options,
      signal
    });
    signal.throwIfAborted();
    return {
      index: chunk.index,
      input: chunk.text,
      summary,
      usage: Number.isFinite(usage) ? usage : null,
      start: chunk.start,
      end: chunk.end
    };
  };
  const formatChunkSummaries = (chunks: SummarizerChunkResult[]) => {
    return chunks.map((chunk) => `Part ${chunk.index + 1} summary:\n${chunk.summary.trim()}`).join('\n\n');
  };
  const summarizeWithDetails = async (input: string, options: SummarizerRunOptions = {}): Promise<SummarizerResult> => {
    const signal = operation.begin();
    try {
      update({ error: null, output: '', lastResult: null }, signal);
      const instance = await ensureSummarizer(options.createOptions, options.autoCreate !== false, signal);
      signal.throwIfAborted();
      const normalized = options.stripHtml ? stripHtmlForSummary(input) : normalizeSummaryInput(input);
      const nativeOptions = getNativeSummarizeOptions(options);
      const chunkBudgetRatio = clampRatio(options.chunkBudgetRatio, DEFAULT_CHUNK_BUDGET_RATIO);
      const maxRollupRounds = Math.max(options.maxRollupRounds ?? DEFAULT_MAX_ROLLUP_ROUNDS, 0);
      const chunking = options.chunking ?? 'auto';
      update({ processing: 'summarize' }, signal);
      setProgressState(
        {
          phase: 'measuring',
          inputUsage: null,
          inputQuota: instance.inputQuota,
          processedChunks: 0,
          totalChunks: 0,
          currentChunk: 0,
          outputLength: 0,
          chunked: false
        },
        options.onProgress,
        signal
      );
      const usage = await measureWithSignal(instance, normalized, nativeOptions, signal);
      signal.throwIfAborted();
      update({ inputUsage: Number.isFinite(usage) ? usage : null }, signal);
      update({ inputQuota: instance.inputQuota }, signal);
      const budget = Math.floor(instance.inputQuota * chunkBudgetRatio);
      const shouldChunk = chunking !== 'never' && Number.isFinite(usage) && usage > budget && budget > 0;
      if (!shouldChunk) {
        setProgressState(
          {
            phase: 'summarizing',
            inputUsage: current.inputUsage,
            inputQuota: instance.inputQuota,
            totalChunks: 1,
            currentChunk: 1
          },
          options.onProgress,
          signal
        );
        signal.throwIfAborted();
        const summary = await instance.summarize(normalized, {
          ...nativeOptions,
          signal
        });
        signal.throwIfAborted();
        update({ output: summary }, signal);
        const result: SummarizerResult = {
          summary,
          input: normalized,
          inputUsage: current.inputUsage,
          inputQuota: instance.inputQuota,
          chunked: false,
          chunks: [],
          rollupRounds: 0
        };
        update({ lastResult: result }, signal);
        setProgressState(
          {
            phase: 'ready',
            outputLength: summary.length,
            processedChunks: 1
          },
          options.onProgress,
          signal
        );
        return result;
      }
      const chunks = await buildMeasuredChunks(normalized, budget, instance, nativeOptions, signal, options.onProgress);
      signal.throwIfAborted();
      const chunkResults: SummarizerChunkResult[] = [];
      for (const chunk of chunks) {
        setProgressState(
          {
            phase: 'summarizing',
            totalChunks: chunks.length,
            currentChunk: chunk.index + 1,
            processedChunks: chunkResults.length,
            chunked: true
          },
          options.onProgress,
          signal
        );
        const result = await summarizeChunk(instance, chunk, nativeOptions, signal);
        signal.throwIfAborted();
        chunkResults.push(result);
        update({ output: formatChunkSummaries(chunkResults) }, signal);
        setProgressState(
          {
            outputLength: current.output.length,
            processedChunks: chunkResults.length
          },
          options.onProgress,
          signal
        );
      }
      let rollupInput = formatChunkSummaries(chunkResults);
      let rollupRounds = 0;
      for (; rollupRounds < maxRollupRounds; rollupRounds += 1) {
        const rollupUsage = await measureWithSignal(instance, rollupInput, nativeOptions, signal);
        signal.throwIfAborted();
        if (rollupUsage <= budget || rollupRounds === maxRollupRounds - 1) {
          break;
        }
        setProgressState(
          {
            phase: 'rolling-up',
            currentChunk: rollupRounds + 1
          },
          options.onProgress,
          signal
        );
        const rollupChunks = await buildMeasuredChunks(
          rollupInput,
          budget,
          instance,
          nativeOptions,
          signal,
          options.onProgress
        );
        signal.throwIfAborted();
        const partials: SummarizerChunkResult[] = [];
        for (const chunk of rollupChunks) {
          partials.push(await summarizeChunk(instance, chunk, nativeOptions, signal));
          signal.throwIfAborted();
        }
        rollupInput = formatChunkSummaries(partials);
      }
      setProgressState(
        {
          phase: 'rolling-up',
          currentChunk: rollupRounds + 1,
          totalChunks: Math.max(chunkResults.length, 1)
        },
        options.onProgress,
        signal
      );
      const summary = await instance.summarize(rollupInput, {
        ...nativeOptions,
        signal
      });
      signal.throwIfAborted();
      update({ output: summary }, signal);
      const result: SummarizerResult = {
        summary,
        input: normalized,
        inputUsage: current.inputUsage,
        inputQuota: instance.inputQuota,
        chunked: true,
        chunks: chunkResults,
        rollupRounds
      };
      update({ lastResult: result }, signal);
      setProgressState(
        {
          phase: 'ready',
          outputLength: summary.length,
          processedChunks: chunkResults.length,
          totalChunks: chunkResults.length,
          chunked: true
        },
        options.onProgress,
        signal
      );
      return result;
    } catch (caughtError) {
      if (operation.isCurrent(signal)) {
        update({ error: caughtError }, signal);
        setProgressState({ phase: 'error' }, options.onProgress, signal);
      }
      throw caughtError;
    } finally {
      if (operation.end(signal)) update({ processing: '' });
    }
  };
  const summarize = async (input: string, options: SummarizerRunOptions = {}) => {
    const result = await summarizeWithDetails(input, options);
    return result.summary;
  };
  const summarizeStreaming = (input: string, options: SummarizerRunOptions = {}): ReadableStream<string> => {
    if (!current.summarizer) {
      throw new Error('Summarizer is not initialized. Call create() first.');
    }
    const normalized = options.stripHtml ? stripHtmlForSummary(input) : normalizeSummaryInput(input);
    const nativeOptions = getNativeSummarizeOptions(options);
    const signal = operation.begin();
    try {
      update({ processing: 'summarize', output: '', error: null }, signal);
      const stream = current.summarizer.summarizeStreaming(normalized, { ...nativeOptions, signal });
      return observeTextStream(stream, signal, {
        onChunk: (output) => update({ output }, signal),
        onComplete: () => signal.throwIfAborted(),
        onError: (error) => {
          if (operation.isCurrent(signal) && !signal.aborted) update({ error });
        },
        onFinally: () => {
          if (operation.end(signal)) update({ processing: '' });
        }
      });
    } catch (error) {
      if (operation.isCurrent(signal)) update({ error });
      if (operation.end(signal)) update({ processing: '' });
      throw error;
    }
  };
  const summarizeStreamingToText = async (
    input: string,
    options: SummarizerRunOptions = {},
    onChunk?: (chunk: string, accumulated: string) => void
  ) => {
    update({ output: '' });
    const stream = summarizeStreaming(input, options);
    return collectTextStream(stream, onChunk);
  };
  return projectWorkflow(
    store,
    () => ({
      summarizer: current.summarizer,
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
      summarize,
      summarizeWithDetails,
      summarizeStreaming,
      summarizeStreamingToText,
      interrupt
    }
  );
}
