import { computed, ref, watch } from 'vue';
import {
  collectTextStream,
  createDownloadMonitor,
  isAbortError,
  safeCheckAvailability,
  useAbortableOperation
} from '../utils/browserAi';
import {
  createTextChunk,
  normalizeSummaryInput,
  splitTextIntoSegments,
  stripHtmlForSummary,
  type TextChunk,
  type TextSegment
} from '../utils/text';

export type SummarizerAvailability = Availability;
export type SummarizerProcessingState = 'availability' | 'create' | 'measure' | 'summarize' | '';
export type SummarizerCreateCore = SummarizerCreateCoreOptions;
export type SummarizerCreate = Omit<SummarizerCreateOptions, 'signal' | 'monitor'>;
export type SummarizerRunNativeOptions = Omit<SummarizerSummarizeOptions, 'signal'>;

export type SummarizerProgressPhase =
  | 'idle'
  | 'checking'
  | 'creating'
  | 'measuring'
  | 'chunking'
  | 'summarizing'
  | 'rolling-up'
  | 'ready'
  | 'error';

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

const getNativeSummarizeOptions = (
  options: SummarizerRunOptions = {}
): SummarizerRunNativeOptions => {
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

const joinChunkText = (current: string, next: string) => {
  return current ? `${current}\n\n${next}` : next;
};

const clampRatio = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value as number, 0.2), 0.95);
};

export function useSummarizer() {
  const summarizer = ref<Summarizer | null>(null);
  const availability = ref<Availability | null>(null);
  const createOptions = ref<SummarizerCreate | null>(null);
  const processing = ref<SummarizerProcessingState>('');
  const downloadProgress = ref(0);
  const inputUsage = ref<number | null>(null);
  const inputQuota = ref<number | null>(null);
  const output = ref('');
  const error = ref<unknown>(null);
  const progressState = ref<SummarizerProgressState>(createEmptyProgressState());
  const lastResult = ref<SummarizerResult | null>(null);

  const operation = useAbortableOperation();

  const isReady = computed(() => {
    return summarizer.value !== null && availability.value === 'available';
  });

  const isProcessing = computed(() => processing.value !== '');

  const inputQuotaAvailable = computed(() => {
    if (inputQuota.value == null || inputUsage.value == null) {
      return null;
    }

    return Math.max(inputQuota.value - inputUsage.value, 0);
  });

  const updateModelProps = (instance?: Summarizer | null) => {
    inputQuota.value = instance?.inputQuota ?? null;
  };

  const setProgressState = (
    patch: Partial<SummarizerProgressState>,
    onProgress?: SummarizerRunOptions['onProgress']
  ) => {
    progressState.value = {
      ...progressState.value,
      ...patch
    };
    onProgress?.({ ...progressState.value });
  };

  watch(
    summarizer,
    (next) => updateModelProps(next),
    { deep: true }
  );

  const checkAvailability = async (options: SummarizerCreateCoreOptions = {}) => {
    return safeCheckAvailability(getSummarizer(), options);
  };

  const requestAvailability = async (options: SummarizerCreateCoreOptions = {}) => {
    processing.value = 'availability';
    setProgressState({ phase: 'checking' });
    try {
      availability.value = await checkAvailability(options);
      return availability.value;
    } finally {
      processing.value = '';
    }
  };

  const init = async (options: SummarizerCreateCoreOptions = {}) => {
    destroy();
    createOptions.value = options;
    const status = await requestAvailability(options);

    if (status === 'unavailable') {
      throw new Error('Summarizer is unavailable with the provided options.');
    }

    return status;
  };

  const create = async (options: SummarizerCreate = {}) => {
    const SummarizerConstructor = getSummarizer();
    if (typeof SummarizerConstructor?.create !== 'function') {
      throw new Error('Summarizer is not available in this browser context.');
    }

    const coreOptions = getCreateCoreOptions(options);
    createOptions.value = options;

    availability.value = await checkAvailability(coreOptions);
    if (availability.value === 'unavailable') {
      throw new Error('Summarizer is unavailable with the provided options.');
    }

    processing.value = 'create';
    setProgressState({ phase: 'creating' });
    const signal = operation.begin();
    destroy();
    downloadProgress.value = 0;

    const monitor = createDownloadMonitor((progress) => {
      downloadProgress.value = progress;
    });

    try {
      summarizer.value = await SummarizerConstructor.create({
        ...options,
        signal,
        monitor
      });
      availability.value = 'available';
      downloadProgress.value = 100;
      updateModelProps(summarizer.value);
      return summarizer.value;
    } finally {
      operation.end(signal);
      processing.value = '';
    }
  };

  const destroy = () => {
    summarizer.value?.destroy();
    summarizer.value = null;
    updateModelProps(null);
  };

  const dispose = () => {
    interrupt();
    destroy();
    availability.value = null;
    createOptions.value = null;
    downloadProgress.value = 0;
    inputUsage.value = null;
    output.value = '';
    lastResult.value = null;
    progressState.value = createEmptyProgressState();
    processing.value = '';
  };

  const interrupt = () => {
    operation.interrupt();
  };

  const ensureSummarizer = async (options?: SummarizerCreate, autoCreate = true) => {
    if (options) {
      return create(options);
    }

    if (summarizer.value) {
      return summarizer.value;
    }

    if (!autoCreate) {
      throw new Error('Summarizer is not initialized. Call create() first or enable autoCreate.');
    }

    return create(createOptions.value ?? {});
  };

  const measureInputUsageInternal = async (
    instance: Summarizer,
    input: string,
    options: SummarizerRunNativeOptions | undefined,
    signal: AbortSignal
  ) => {
    const usage = await instance.measureInputUsage(input, {
      ...options,
      signal
    });
    inputUsage.value = usage;
    return usage;
  };

  const measureInputUsage = async (
    input: string,
    options: SummarizerRunOptions = {}
  ) => {
    const instance = await ensureSummarizer(options.createOptions, options.autoCreate !== false);
    const normalized = options.stripHtml ? stripHtmlForSummary(input) : normalizeSummaryInput(input);
    const nativeOptions = getNativeSummarizeOptions(options);

    processing.value = 'measure';
    setProgressState({ phase: 'measuring', inputQuota: instance.inputQuota });
    const signal = operation.begin();

    try {
      const usage = await measureInputUsageInternal(instance, normalized, nativeOptions, signal);
      setProgressState({
        inputUsage: usage,
        inputQuota: instance.inputQuota
      }, options.onProgress);
      return usage;
    } finally {
      operation.end(signal);
      processing.value = '';
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
      if (isAbortError(caughtError)) {
        throw caughtError;
      }

      return Number.POSITIVE_INFINITY;
    }
  };

  const splitOversizedSegment = async (
    segment: TextSegment,
    budget: number,
    instance: Summarizer,
    options: SummarizerRunNativeOptions | undefined,
    signal: AbortSignal,
    startIndex: number
  ) => {
    const chunks: TextChunk[] = [];
    let remaining = segment.text;
    let absoluteStart = segment.start;
    let index = startIndex;

    while (remaining.trim()) {
      let low = 1;
      let high = remaining.length;
      let best = 0;

      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = remaining.slice(0, middle).trim();
        const usage = await measureWithSignal(instance, candidate, options, signal);
        if (usage <= budget) {
          best = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }

      if (best <= 0) {
        best = Math.min(remaining.length, 1200);
      }

      const whitespace = remaining.lastIndexOf(' ', best);
      const sliceEnd = whitespace > 240 ? whitespace : best;
      const text = remaining.slice(0, sliceEnd).trim();
      chunks.push(createTextChunk(text, index, absoluteStart));

      absoluteStart += sliceEnd;
      remaining = remaining.slice(sliceEnd).trim();
      index += 1;
    }

    return chunks;
  };

  const buildMeasuredChunks = async (
    input: string,
    budget: number,
    instance: Summarizer,
    options: SummarizerRunNativeOptions | undefined,
    signal: AbortSignal,
    onProgress?: SummarizerRunOptions['onProgress']
  ) => {
    const segments = splitTextIntoSegments(input);
    const chunks: TextChunk[] = [];
    let current = '';
    let currentStart = segments[0]?.start ?? 0;

    for (const segment of segments) {
      const candidate = joinChunkText(current, segment.text);
      const usage = await measureWithSignal(instance, candidate, options, signal);

      if (usage <= budget) {
        if (!current) {
          currentStart = segment.start;
        }
        current = candidate;
      } else if (!current) {
        const split = await splitOversizedSegment(
          segment,
          budget,
          instance,
          options,
          signal,
          chunks.length
        );
        chunks.push(...split);
      } else {
        chunks.push(createTextChunk(current, chunks.length, currentStart));
        current = segment.text;
        currentStart = segment.start;
      }

      setProgressState({
        phase: 'chunking',
        processedChunks: chunks.length,
        totalChunks: Math.max(chunks.length + 1, 1),
        chunked: true
      }, onProgress);
    }

    if (current.trim()) {
      chunks.push(createTextChunk(current, chunks.length, currentStart));
    }

    return chunks;
  };

  const summarizeChunk = async (
    instance: Summarizer,
    chunk: TextChunk,
    options: SummarizerRunNativeOptions | undefined,
    signal: AbortSignal
  ): Promise<SummarizerChunkResult> => {
    const usage = await measureWithSignal(instance, chunk.text, options, signal);
    const summary = await instance.summarize(chunk.text, {
      ...options,
      signal
    });

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
    return chunks
      .map((chunk) => `Part ${chunk.index + 1} summary:\n${chunk.summary.trim()}`)
      .join('\n\n');
  };

  const summarizeWithDetails = async (
    input: string,
    options: SummarizerRunOptions = {}
  ): Promise<SummarizerResult> => {
    error.value = null;
    output.value = '';
    lastResult.value = null;

    const instance = await ensureSummarizer(options.createOptions, options.autoCreate !== false);
    const normalized = options.stripHtml ? stripHtmlForSummary(input) : normalizeSummaryInput(input);
    const nativeOptions = getNativeSummarizeOptions(options);
    const signal = operation.begin();
    const chunkBudgetRatio = clampRatio(options.chunkBudgetRatio, DEFAULT_CHUNK_BUDGET_RATIO);
    const maxRollupRounds = Math.max(options.maxRollupRounds ?? DEFAULT_MAX_ROLLUP_ROUNDS, 0);
    const chunking = options.chunking ?? 'auto';

    processing.value = 'summarize';

    try {
      setProgressState({
        phase: 'measuring',
        inputUsage: null,
        inputQuota: instance.inputQuota,
        processedChunks: 0,
        totalChunks: 0,
        currentChunk: 0,
        outputLength: 0,
        chunked: false
      }, options.onProgress);

      const usage = await measureWithSignal(instance, normalized, nativeOptions, signal);
      inputUsage.value = Number.isFinite(usage) ? usage : null;
      inputQuota.value = instance.inputQuota;

      const budget = Math.floor(instance.inputQuota * chunkBudgetRatio);
      const shouldChunk = chunking !== 'never'
        && Number.isFinite(usage)
        && usage > budget
        && budget > 0;

      if (!shouldChunk) {
        setProgressState({
          phase: 'summarizing',
          inputUsage: inputUsage.value,
          inputQuota: instance.inputQuota,
          totalChunks: 1,
          currentChunk: 1
        }, options.onProgress);

        const summary = await instance.summarize(normalized, {
          ...nativeOptions,
          signal
        });

        output.value = summary;
        const result: SummarizerResult = {
          summary,
          input: normalized,
          inputUsage: inputUsage.value,
          inputQuota: instance.inputQuota,
          chunked: false,
          chunks: [],
          rollupRounds: 0
        };
        lastResult.value = result;
        setProgressState({
          phase: 'ready',
          outputLength: summary.length,
          processedChunks: 1
        }, options.onProgress);
        return result;
      }

      const chunks = await buildMeasuredChunks(
        normalized,
        budget,
        instance,
        nativeOptions,
        signal,
        options.onProgress
      );
      const chunkResults: SummarizerChunkResult[] = [];

      for (const chunk of chunks) {
        setProgressState({
          phase: 'summarizing',
          totalChunks: chunks.length,
          currentChunk: chunk.index + 1,
          processedChunks: chunkResults.length,
          chunked: true
        }, options.onProgress);

        const result = await summarizeChunk(instance, chunk, nativeOptions, signal);
        chunkResults.push(result);
        output.value = formatChunkSummaries(chunkResults);
        setProgressState({
          outputLength: output.value.length,
          processedChunks: chunkResults.length
        }, options.onProgress);
      }

      let rollupInput = formatChunkSummaries(chunkResults);
      let rollupRounds = 0;

      for (; rollupRounds < maxRollupRounds; rollupRounds += 1) {
        const rollupUsage = await measureWithSignal(instance, rollupInput, nativeOptions, signal);
        if (rollupUsage <= budget || rollupRounds === maxRollupRounds - 1) {
          break;
        }

        setProgressState({
          phase: 'rolling-up',
          currentChunk: rollupRounds + 1
        }, options.onProgress);

        const rollupChunks = await buildMeasuredChunks(
          rollupInput,
          budget,
          instance,
          nativeOptions,
          signal,
          options.onProgress
        );
        const partials: SummarizerChunkResult[] = [];
        for (const chunk of rollupChunks) {
          partials.push(await summarizeChunk(instance, chunk, nativeOptions, signal));
        }
        rollupInput = formatChunkSummaries(partials);
      }

      setProgressState({
        phase: 'rolling-up',
        currentChunk: rollupRounds + 1,
        totalChunks: Math.max(chunkResults.length, 1)
      }, options.onProgress);

      const summary = await instance.summarize(rollupInput, {
        ...nativeOptions,
        signal
      });

      output.value = summary;
      const result: SummarizerResult = {
        summary,
        input: normalized,
        inputUsage: inputUsage.value,
        inputQuota: instance.inputQuota,
        chunked: true,
        chunks: chunkResults,
        rollupRounds
      };
      lastResult.value = result;
      setProgressState({
        phase: 'ready',
        outputLength: summary.length,
        processedChunks: chunkResults.length,
        totalChunks: chunkResults.length,
        chunked: true
      }, options.onProgress);
      return result;
    } catch (caughtError) {
      error.value = caughtError;
      setProgressState({ phase: 'error' }, options.onProgress);
      throw caughtError;
    } finally {
      operation.end(signal);
      processing.value = '';
    }
  };

  const summarize = async (input: string, options: SummarizerRunOptions = {}) => {
    const result = await summarizeWithDetails(input, options);
    return result.summary;
  };

  const summarizeStreaming = (
    input: string,
    options: SummarizerRunOptions = {}
  ): ReadableStream<string> => {
    if (!summarizer.value) {
      throw new Error('Summarizer is not initialized. Call create() first.');
    }

    const normalized = options.stripHtml ? stripHtmlForSummary(input) : normalizeSummaryInput(input);
    const nativeOptions = getNativeSummarizeOptions(options);
    processing.value = 'summarize';
    const signal = operation.begin();
    const stream = summarizer.value.summarizeStreaming(normalized, {
      ...nativeOptions,
      signal
    });
    const reader = stream.getReader();

    return new ReadableStream<string>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            operation.end(signal);
            processing.value = '';
            return;
          }

          output.value += value;
          controller.enqueue(value);
        } catch (streamError) {
          error.value = streamError;
          operation.end(signal);
          processing.value = '';
          controller.error(streamError);
        }
      },
      cancel(reason) {
        operation.end(signal);
        processing.value = '';
        return reader.cancel(reason);
      }
    });
  };

  const summarizeStreamingToText = async (
    input: string,
    options: SummarizerRunOptions = {},
    onChunk?: (chunk: string, accumulated: string) => void
  ) => {
    output.value = '';
    const stream = summarizeStreaming(input, options);
    const result = await collectTextStream(stream, onChunk);
    output.value = result;
    return result;
  };

  return {
    summarizer: computed(() => summarizer.value),
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
    summarize,
    summarizeWithDetails,
    summarizeStreaming,
    summarizeStreamingToText,
    interrupt
  };
}
