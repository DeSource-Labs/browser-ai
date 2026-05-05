import { computed, ref, watch } from 'vue';
import {
  buildMeasuredTextChunks,
  normalizeTextInput,
  stripHtmlForText,
  type TextChunk
} from '../utils/text';
import {
  createDownloadMonitor,
  isAbortError,
  safeCheckAvailability,
  useAbortableOperation
} from '../utils/browserAi';

export type LanguageDetectorAvailability = Availability;
export type LanguageDetectorProcessingState = 'availability' | 'create' | 'measure' | 'detect' | '';
export type LanguageDetectorCreateCore = LanguageDetectorCreateCoreOptions;
export type LanguageDetectorCreate = Omit<LanguageDetectorCreateOptions, 'signal' | 'monitor'>;
export type LanguageDetectorRunNativeOptions = Omit<LanguageDetectorDetectOptions, 'signal'>;
export type LanguageDetectorLargeInputStrategy = 'chunk' | 'sample' | 'never';

export type LanguageDetectorProgressPhase =
  | 'idle'
  | 'checking'
  | 'creating'
  | 'measuring'
  | 'chunking'
  | 'detecting'
  | 'ready'
  | 'error';

export interface LanguageDetectorLanguageOption {
  code: string;
  name: string;
}

export interface NormalizedLanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
  name: string;
  isUnknown: boolean;
}

export interface LanguageDetectorProgressState {
  phase: LanguageDetectorProgressPhase;
  inputUsage: number | null;
  inputQuota: number | null;
  processedChunks: number;
  totalChunks: number;
  currentChunk: number;
  chunked: boolean;
  sampled: boolean;
  topLanguage: string | null;
  topConfidence: number | null;
}

export interface LanguageDetectorChunkResult {
  index: number;
  input: string;
  usage: number | null;
  start: number;
  end: number;
  weight: number;
  results: NormalizedLanguageDetectionResult[];
}

export interface LanguageDetectorResult {
  input: string;
  analyzedInput: string;
  detectedLanguage: string;
  confidence: number;
  name: string;
  isUnknown: boolean;
  inputUsage: number | null;
  inputQuota: number | null;
  minConfidence: number;
  maxResults: number;
  expectedInputLanguages: string[];
  chunked: boolean;
  sampled: boolean;
  chunks: LanguageDetectorChunkResult[];
  results: NormalizedLanguageDetectionResult[];
}

export interface LanguageDetectorRunOptions extends LanguageDetectorRunNativeOptions {
  createOptions?: LanguageDetectorCreate;
  autoCreate?: boolean;
  stripHtml?: boolean;
  largeInputStrategy?: LanguageDetectorLargeInputStrategy;
  chunkBudgetRatio?: number;
  minConfidence?: number;
  maxResults?: number;
  onProgress?: (state: LanguageDetectorProgressState) => void;
}

export interface LanguageDetectorBatchItem {
  input: string;
  expectedInputLanguages?: string[];
  stripHtml?: boolean;
}

export interface LanguageDetectorBatchOptions extends Omit<LanguageDetectorRunOptions, 'stripHtml'> {
  continueOnError?: boolean;
}

type GlobalWithLanguageDetector = typeof globalThis & {
  LanguageDetector?: typeof LanguageDetector;
};

const UNKNOWN_LANGUAGE_CODE = 'und';
const DEFAULT_CHUNK_BUDGET_RATIO = 0.78;
const DEFAULT_MIN_CONFIDENCE = 0.42;
const DEFAULT_MAX_RESULTS = 6;

export const LANGUAGE_DETECTOR_LANGUAGE_OPTIONS: LanguageDetectorLanguageOption[] = [
  { code: 'ar', name: 'Arabic' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hr', name: 'Croatian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'no', name: 'Norwegian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'sr-Cyrl', name: 'Serbian Cyrillic' },
  { code: 'sr-Latn', name: 'Serbian Latin' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'zh-Hant', name: 'Chinese Traditional' }
];

export const getLanguageDetectorLanguageName = (code: string) => {
  if (code === UNKNOWN_LANGUAGE_CODE) return 'Unknown';

  const known = LANGUAGE_DETECTOR_LANGUAGE_OPTIONS.find((item) => {
    return item.code.toLowerCase() === code.toLowerCase();
  });
  if (known) return known.name;

  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
};

const getLanguageDetector = () => {
  return (globalThis as GlobalWithLanguageDetector).LanguageDetector;
};

const createEmptyProgressState = (): LanguageDetectorProgressState => ({
  phase: 'idle',
  inputUsage: null,
  inputQuota: null,
  processedChunks: 0,
  totalChunks: 0,
  currentChunk: 0,
  chunked: false,
  sampled: false,
  topLanguage: null,
  topConfidence: null
});

const normalizeExpectedInputLanguages = (languages?: readonly string[]) => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const language of languages ?? []) {
    const trimmed = language.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
};

const normalizeCreateOptions = (options: LanguageDetectorCreate = {}): LanguageDetectorCreate => ({
  ...options,
  expectedInputLanguages: normalizeExpectedInputLanguages(options.expectedInputLanguages)
});

const getCreateOptionsKey = (options: LanguageDetectorCreate = {}) => {
  return normalizeExpectedInputLanguages(options.expectedInputLanguages)
    .map((item) => item.toLowerCase())
    .sort()
    .join('|');
};

const normalizeDetectorInput = (value: string, stripHtml?: boolean) => {
  return stripHtml ? stripHtmlForText(value) : normalizeTextInput(value);
};

const clampRatio = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value as number, 0.2), 0.95);
};

const clampConfidence = (value: number | undefined) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value as number, 0), 1);
};

const clampCount = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value as number), 1), 24);
};

const getNativeDetectOptions = (
  options: LanguageDetectorRunOptions | LanguageDetectorBatchOptions = {}
): LanguageDetectorRunNativeOptions => {
  const {
    createOptions: _createOptions,
    autoCreate: _autoCreate,
    stripHtml: _stripHtml,
    largeInputStrategy: _largeInputStrategy,
    chunkBudgetRatio: _chunkBudgetRatio,
    minConfidence: _minConfidence,
    maxResults: _maxResults,
    onProgress: _onProgress,
    continueOnError: _continueOnError,
    ...nativeOptions
  } = options as LanguageDetectorRunOptions & { continueOnError?: boolean };
  return nativeOptions;
};

const normalizeDetectionResults = (
  results: LanguageDetectionResult[],
  maxResults = DEFAULT_MAX_RESULTS,
  includeUnknown = true
): NormalizedLanguageDetectionResult[] => {
  const scores = new Map<string, number>();

  for (const result of results) {
    const code = result.detectedLanguage?.trim() || UNKNOWN_LANGUAGE_CODE;
    scores.set(code, Math.max(scores.get(code) ?? 0, clampConfidence(result.confidence)));
  }

  const knownTotal = Array.from(scores.entries())
    .filter(([code]) => code !== UNKNOWN_LANGUAGE_CODE)
    .reduce((total, [, confidence]) => total + confidence, 0);

  if (includeUnknown && !scores.has(UNKNOWN_LANGUAGE_CODE)) {
    scores.set(UNKNOWN_LANGUAGE_CODE, Math.max(0, 1 - Math.min(knownTotal, 1)));
  }

  return Array.from(scores.entries())
    .filter(([code]) => includeUnknown || code !== UNKNOWN_LANGUAGE_CODE)
    .map(([detectedLanguage, confidence]) => ({
      detectedLanguage,
      confidence,
      name: getLanguageDetectorLanguageName(detectedLanguage),
      isUnknown: detectedLanguage === UNKNOWN_LANGUAGE_CODE
    }))
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, maxResults);
};

const selectReportedResults = (
  results: NormalizedLanguageDetectionResult[],
  minConfidence: number,
  maxResults: number
) => {
  const filtered = results.filter((result) => {
    return result.isUnknown || result.confidence >= minConfidence;
  });

  return (filtered.length > 0 ? filtered : results).slice(0, maxResults);
};

const getTopResult = (
  results: NormalizedLanguageDetectionResult[],
  minConfidence: number
) => {
  const topKnown = results.find((result) => {
    return !result.isUnknown && result.confidence >= minConfidence;
  });

  return topKnown
    ?? results.find((result) => result.isUnknown)
    ?? {
      detectedLanguage: UNKNOWN_LANGUAGE_CODE,
      confidence: 1,
      name: 'Unknown',
      isUnknown: true
    };
};

const aggregateChunkResults = (
  chunkResults: LanguageDetectorChunkResult[],
  maxResults: number
) => {
  const scores = new Map<string, number>();
  const totalWeight = chunkResults.reduce((total, chunk) => total + chunk.weight, 0) || 1;

  for (const chunk of chunkResults) {
    for (const result of chunk.results) {
      const current = scores.get(result.detectedLanguage) ?? 0;
      scores.set(result.detectedLanguage, current + result.confidence * chunk.weight);
    }
  }

  return normalizeDetectionResults(
    Array.from(scores.entries()).map(([detectedLanguage, weightedConfidence]) => ({
      detectedLanguage,
      confidence: weightedConfidence / totalWeight
    })),
    maxResults,
    true
  );
};

const createSampledInput = (input: string, targetCharacters: number) => {
  if (input.length <= targetCharacters) return input;

  const safeTarget = Math.max(targetCharacters, 600);
  const segmentLength = Math.max(Math.floor(safeTarget / 3), 180);
  const middleStart = Math.max(Math.floor(input.length / 2 - segmentLength / 2), 0);

  return [
    input.slice(0, segmentLength),
    input.slice(middleStart, middleStart + segmentLength),
    input.slice(-segmentLength)
  ].map((part) => part.trim()).filter(Boolean).join('\n\n');
};

export function useLanguageDetector(defaultCreateOptions: LanguageDetectorCreate = {}) {
  const detector = ref<LanguageDetector | null>(null);
  const availability = ref<Availability | null>(null);
  const createOptions = ref<LanguageDetectorCreate>(normalizeCreateOptions(defaultCreateOptions));
  const processing = ref<LanguageDetectorProcessingState>('');
  const downloadProgress = ref(0);
  const inputUsage = ref<number | null>(null);
  const inputQuota = ref<number | null>(null);
  const results = ref<NormalizedLanguageDetectionResult[]>([]);
  const error = ref<unknown>(null);
  const progressState = ref<LanguageDetectorProgressState>(createEmptyProgressState());
  const lastResult = ref<LanguageDetectorResult | null>(null);

  const operation = useAbortableOperation();

  const isReady = computed(() => {
    return detector.value !== null && availability.value === 'available';
  });

  const isProcessing = computed(() => processing.value !== '');

  const topResult = computed(() => {
    return lastResult.value
      ? {
        detectedLanguage: lastResult.value.detectedLanguage,
        confidence: lastResult.value.confidence,
        name: lastResult.value.name,
        isUnknown: lastResult.value.isUnknown
      }
      : null;
  });

  const inputQuotaAvailable = computed(() => {
    if (inputQuota.value == null || inputUsage.value == null) {
      return null;
    }

    return Math.max(inputQuota.value - inputUsage.value, 0);
  });

  const updateModelProps = (instance?: LanguageDetector | null) => {
    inputQuota.value = instance?.inputQuota ?? null;
  };

  const setProgressState = (
    patch: Partial<LanguageDetectorProgressState>,
    onProgress?: LanguageDetectorRunOptions['onProgress']
  ) => {
    progressState.value = {
      ...progressState.value,
      ...patch
    };
    onProgress?.({ ...progressState.value });
  };

  watch(
    detector,
    (next) => updateModelProps(next),
    { deep: true }
  );

  const checkAvailability = async (options: LanguageDetectorCreateCoreOptions = createOptions.value) => {
    return safeCheckAvailability(getLanguageDetector(), normalizeCreateOptions(options));
  };

  const requestAvailability = async (options: LanguageDetectorCreateCoreOptions = createOptions.value) => {
    processing.value = 'availability';
    setProgressState({ phase: 'checking' });
    try {
      availability.value = await checkAvailability(options);
      return availability.value;
    } finally {
      processing.value = '';
    }
  };

  const init = async (options: LanguageDetectorCreateCoreOptions = createOptions.value) => {
    destroy();
    createOptions.value = normalizeCreateOptions(options);
    const status = await requestAvailability(options);

    if (status === 'unavailable') {
      throw new Error('Language Detector is unavailable with the provided options.');
    }

    return status;
  };

  const create = async (options: LanguageDetectorCreate = createOptions.value) => {
    const LanguageDetectorConstructor = getLanguageDetector();
    if (typeof LanguageDetectorConstructor?.create !== 'function') {
      throw new Error('Language Detector is not available in this browser context.');
    }

    const normalizedOptions = normalizeCreateOptions(options);
    createOptions.value = normalizedOptions;

    availability.value = await checkAvailability(normalizedOptions);
    if (availability.value === 'unavailable') {
      throw new Error('Language Detector is unavailable with the provided options.');
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
      detector.value = await LanguageDetectorConstructor.create({
        ...normalizedOptions,
        signal,
        monitor
      });
      availability.value = 'available';
      downloadProgress.value = 100;
      updateModelProps(detector.value);
      return detector.value;
    } finally {
      operation.end(signal);
      processing.value = '';
    }
  };

  const destroy = () => {
    detector.value?.destroy();
    detector.value = null;
    updateModelProps(null);
  };

  const interrupt = () => {
    operation.interrupt();
  };

  const dispose = () => {
    interrupt();
    destroy();
    availability.value = null;
    createOptions.value = normalizeCreateOptions(defaultCreateOptions);
    downloadProgress.value = 0;
    inputUsage.value = null;
    results.value = [];
    error.value = null;
    lastResult.value = null;
    progressState.value = createEmptyProgressState();
    processing.value = '';
  };

  const ensureDetector = async (options?: LanguageDetectorCreate, autoCreate = true) => {
    const nextOptions = normalizeCreateOptions(options ?? createOptions.value);

    if (detector.value && getCreateOptionsKey(nextOptions) === getCreateOptionsKey(createOptions.value)) {
      return detector.value;
    }

    if (!autoCreate) {
      throw new Error('Language Detector is not initialized. Call create() first or enable autoCreate.');
    }

    return create(nextOptions);
  };

  const measureInputUsageInternal = async (
    instance: LanguageDetector,
    input: string,
    options: LanguageDetectorRunNativeOptions | undefined,
    signal: AbortSignal
  ) => {
    const usage = await instance.measureInputUsage(input, {
      ...options,
      signal
    });
    inputUsage.value = usage;
    return usage;
  };

  const measureWithSignal = async (
    instance: LanguageDetector,
    input: string,
    options: LanguageDetectorRunNativeOptions | undefined,
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

  const measureInputUsage = async (
    input: string,
    options: LanguageDetectorRunOptions = {}
  ) => {
    const instance = await ensureDetector(options.createOptions, options.autoCreate !== false);
    const normalized = normalizeDetectorInput(input, options.stripHtml);
    const nativeOptions = getNativeDetectOptions(options);

    processing.value = 'measure';
    setProgressState({ phase: 'measuring', inputQuota: instance.inputQuota }, options.onProgress);
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

  const buildChunks = async (
    input: string,
    budget: number,
    instance: LanguageDetector,
    nativeOptions: LanguageDetectorRunNativeOptions,
    signal: AbortSignal,
    onProgress?: LanguageDetectorRunOptions['onProgress']
  ) => {
    return buildMeasuredTextChunks({
      input,
      budget,
      measure: (candidate) => measureWithSignal(instance, candidate, nativeOptions, signal),
      onProgress: (chunks) => setProgressState({
        phase: 'chunking',
        processedChunks: chunks.length,
        totalChunks: Math.max(chunks.length + 1, 1),
        chunked: true
      }, onProgress)
    });
  };

  const detectChunk = async (
    instance: LanguageDetector,
    chunk: TextChunk,
    nativeOptions: LanguageDetectorRunNativeOptions,
    signal: AbortSignal,
    maxResults: number
  ): Promise<LanguageDetectorChunkResult> => {
    const usage = await measureWithSignal(instance, chunk.text, nativeOptions, signal);
    const chunkResults = await instance.detect(chunk.text, {
      ...nativeOptions,
      signal
    });
    const weight = Number.isFinite(usage) && usage > 0
      ? usage
      : Math.max(chunk.text.length, 1);

    return {
      index: chunk.index,
      input: chunk.text,
      usage: Number.isFinite(usage) ? usage : null,
      start: chunk.start,
      end: chunk.end,
      weight,
      results: normalizeDetectionResults(chunkResults, maxResults)
    };
  };

  const detectWithDetails = async (
    input: string,
    options: LanguageDetectorRunOptions = {}
  ): Promise<LanguageDetectorResult> => {
    error.value = null;
    results.value = [];
    lastResult.value = null;

    const instance = await ensureDetector(options.createOptions, options.autoCreate !== false);
    const normalized = normalizeDetectorInput(input, options.stripHtml);
    const nativeOptions = getNativeDetectOptions(options);
    const signal = operation.begin();
    const chunkBudgetRatio = clampRatio(options.chunkBudgetRatio, DEFAULT_CHUNK_BUDGET_RATIO);
    const largeInputStrategy = options.largeInputStrategy ?? 'chunk';
    const minConfidence = clampConfidence(options.minConfidence ?? DEFAULT_MIN_CONFIDENCE);
    const maxResults = clampCount(options.maxResults, DEFAULT_MAX_RESULTS);

    processing.value = 'detect';

    try {
      setProgressState({
        phase: 'measuring',
        inputUsage: null,
        inputQuota: instance.inputQuota,
        processedChunks: 0,
        totalChunks: 0,
        currentChunk: 0,
        chunked: false,
        sampled: false,
        topLanguage: null,
        topConfidence: null
      }, options.onProgress);

      const usage = await measureWithSignal(instance, normalized, nativeOptions, signal);
      inputUsage.value = Number.isFinite(usage) ? usage : null;
      inputQuota.value = instance.inputQuota;

      const budget = Math.floor(instance.inputQuota * chunkBudgetRatio);
      const shouldUseLargeInputPath = largeInputStrategy !== 'never'
        && Number.isFinite(usage)
        && usage > budget
        && budget > 0;

      let analyzedInput = normalized;
      let chunked = false;
      let sampled = false;
      let chunkResults: LanguageDetectorChunkResult[] = [];
      let rankedResults: NormalizedLanguageDetectionResult[];

      if (shouldUseLargeInputPath && largeInputStrategy === 'sample') {
        const estimatedCharacters = Math.max(
          Math.floor(normalized.length * (budget / usage)),
          600
        );
        analyzedInput = createSampledInput(normalized, estimatedCharacters);
        sampled = analyzedInput !== normalized;
      }

      if (shouldUseLargeInputPath && largeInputStrategy === 'chunk') {
        chunked = true;
        const chunks = await buildChunks(
          normalized,
          budget,
          instance,
          nativeOptions,
          signal,
          options.onProgress
        );

        for (const chunk of chunks) {
          setProgressState({
            phase: 'detecting',
            totalChunks: chunks.length,
            currentChunk: chunk.index + 1,
            processedChunks: chunkResults.length,
            chunked: true
          }, options.onProgress);

          const result = await detectChunk(instance, chunk, nativeOptions, signal, maxResults);
          chunkResults.push(result);
          setProgressState({
            processedChunks: chunkResults.length
          }, options.onProgress);
        }

        rankedResults = aggregateChunkResults(chunkResults, maxResults);
      } else {
        setProgressState({
          phase: 'detecting',
          inputUsage: inputUsage.value,
          inputQuota: instance.inputQuota,
          totalChunks: 1,
          currentChunk: 1,
          sampled
        }, options.onProgress);

        const nativeResults = await instance.detect(analyzedInput, {
          ...nativeOptions,
          signal
        });
        rankedResults = normalizeDetectionResults(nativeResults, maxResults);
      }

      const reportedResults = selectReportedResults(rankedResults, minConfidence, maxResults);
      const top = getTopResult(rankedResults, minConfidence);
      results.value = reportedResults;

      const result: LanguageDetectorResult = {
        input: normalized,
        analyzedInput,
        detectedLanguage: top.detectedLanguage,
        confidence: top.confidence,
        name: top.name,
        isUnknown: top.isUnknown,
        inputUsage: inputUsage.value,
        inputQuota: instance.inputQuota,
        minConfidence,
        maxResults,
        expectedInputLanguages: normalizeExpectedInputLanguages(instance.expectedInputLanguages),
        chunked,
        sampled,
        chunks: chunkResults,
        results: reportedResults
      };
      lastResult.value = result;
      setProgressState({
        phase: 'ready',
        inputUsage: inputUsage.value,
        inputQuota: instance.inputQuota,
        processedChunks: chunked ? chunkResults.length : 1,
        totalChunks: chunked ? chunkResults.length : 1,
        topLanguage: top.detectedLanguage,
        topConfidence: top.confidence,
        chunked,
        sampled
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

  const detect = async (input: string, options: LanguageDetectorRunOptions = {}) => {
    const result = await detectWithDetails(input, options);
    return result.detectedLanguage;
  };

  const detectMany = async (
    items: LanguageDetectorBatchItem[],
    options: LanguageDetectorBatchOptions = {}
  ) => {
    const batchResults: Array<LanguageDetectorResult | null> = [];
    const failures: unknown[] = [];
    const {
      continueOnError,
      ...runOptions
    } = options;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const baseCreateOptions = runOptions.createOptions ?? createOptions.value;
      setProgressState({
        phase: 'detecting',
        currentChunk: index + 1,
        totalChunks: items.length
      }, runOptions.onProgress);

      try {
        batchResults.push(await detectWithDetails(item.input, {
          ...runOptions,
          createOptions: {
            ...baseCreateOptions,
            expectedInputLanguages: item.expectedInputLanguages
              ?? baseCreateOptions.expectedInputLanguages
          },
          stripHtml: item.stripHtml
        }));
      } catch (caughtError) {
        failures.push(caughtError);
        batchResults.push(null);
        if (!continueOnError) {
          throw caughtError;
        }
      }
    }

    return { results: batchResults, failures };
  };

  return {
    detector: computed(() => detector.value),
    processing: computed(() => processing.value),
    availability: computed(() => availability.value),
    downloadProgress: computed(() => downloadProgress.value),
    inputUsage: computed(() => inputUsage.value),
    inputQuota: computed(() => inputQuota.value),
    inputQuotaAvailable,
    results: computed(() => results.value),
    topResult,
    error: computed(() => error.value),
    progressState: computed(() => progressState.value),
    lastResult: computed(() => lastResult.value),
    createOptions: computed(() => createOptions.value),
    isReady,
    isProcessing,
    checkAvailability,
    requestAvailability,
    init,
    create,
    destroy,
    dispose,
    measureInputUsage,
    detect,
    detectWithDetails,
    detectMany,
    interrupt
  };
}
