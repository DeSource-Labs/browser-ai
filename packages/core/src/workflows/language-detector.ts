import { createWorkflowSession } from './lifecycle.js';
import { createBrowserAiStore } from '../store.js';
import { projectWorkflow } from './state.js';
import { buildMeasuredTextChunks, normalizeTextInput, stripHtmlForText, type TextChunk } from '../text.js';
import { createDownloadMonitor, isAbortError, safeCheckAvailability, createAbortManager } from '../platform.js';
export type LanguageDetectorAvailability = Availability;
export type LanguageDetectorProcessingState = 'availability' | 'create' | 'measure' | 'detect' | '';
export type LanguageDetectorCreateCore = LanguageDetectorCreateCoreOptions;
export type LanguageDetectorCreate = Omit<LanguageDetectorCreateOptions, 'signal' | 'monitor'>;
export type LanguageDetectorRunNativeOptions = Omit<LanguageDetectorDetectOptions, 'signal'>;
export type LanguageDetectorLargeInputStrategy = 'chunk' | 'sample' | 'never';
export type LanguageDetectorProgressPhase =
  'idle' | 'checking' | 'creating' | 'measuring' | 'chunking' | 'detecting' | 'ready' | 'error';
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
  } = options as LanguageDetectorRunOptions & {
    continueOnError?: boolean;
  };
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
const getTopResult = (results: NormalizedLanguageDetectionResult[], minConfidence: number) => {
  const topKnown = results.find((result) => {
    return !result.isUnknown && result.confidence >= minConfidence;
  });
  return (
    topKnown ??
    results.find((result) => result.isUnknown) ?? {
      detectedLanguage: UNKNOWN_LANGUAGE_CODE,
      confidence: 1,
      name: 'Unknown',
      isUnknown: true
    }
  );
};
const aggregateChunkResults = (chunkResults: LanguageDetectorChunkResult[], maxResults: number) => {
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
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
};
export function createLanguageDetectorWorkflow(defaultCreateOptions: LanguageDetectorCreate = {}) {
  let current = {
    detector: null as LanguageDetector | null,
    availability: null as Availability | null,
    createOptions: normalizeCreateOptions(defaultCreateOptions) as LanguageDetectorCreate,
    processing: '' as LanguageDetectorProcessingState,
    downloadProgress: 0,
    inputUsage: null as number | null,
    inputQuota: null as number | null,
    results: [] as NormalizedLanguageDetectionResult[],
    error: null as unknown,
    progressState: createEmptyProgressState() as LanguageDetectorProgressState,
    lastResult: null as LanguageDetectorResult | null
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
    return current.detector !== null && current.availability === 'available';
  };
  const isProcessing = () => current.processing !== '';
  const topResult = () => {
    return current.lastResult
      ? {
          detectedLanguage: current.lastResult.detectedLanguage,
          confidence: current.lastResult.confidence,
          name: current.lastResult.name,
          isUnknown: current.lastResult.isUnknown
        }
      : null;
  };
  const inputQuotaAvailable = () => {
    if (current.inputQuota == null || current.inputUsage == null) {
      return null;
    }
    return Math.max(current.inputQuota - current.inputUsage, 0);
  };
  const updateModelProps = (instance?: LanguageDetector | null) => {
    update({ inputQuota: instance?.inputQuota ?? null });
  };
  const setProgressState = (
    patch: Partial<LanguageDetectorProgressState>,
    onProgress?: LanguageDetectorRunOptions['onProgress'],
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
  const checkAvailability = async (options: LanguageDetectorCreateCoreOptions = current.createOptions) => {
    return safeCheckAvailability(getLanguageDetector(), normalizeCreateOptions(options));
  };
  const requestAvailability = async (options: LanguageDetectorCreateCoreOptions = current.createOptions) => {
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
  const init = async (options: LanguageDetectorCreateCoreOptions = current.createOptions) => {
    destroy();
    update({ createOptions: normalizeCreateOptions(options) });
    const status = await requestAvailability(options);
    if (status === 'unavailable') {
      throw new Error('Language Detector is unavailable with the provided options.');
    }
    return status;
  };
  const createInternal = async (options: LanguageDetectorCreate, signal: AbortSignal) => {
    signal.throwIfAborted();
    availabilityVersion += 1;
    const Constructor = getLanguageDetector();
    if (typeof Constructor?.create !== 'function') {
      throw new Error('Language Detector is not available in this browser context.');
    }
    const normalizedOptions = normalizeCreateOptions(options);
    update({ processing: 'create', downloadProgress: 0 }, signal);
    setProgressState({ phase: 'creating' }, undefined, signal);
    const availabilityValue = await checkAvailability(normalizedOptions);
    signal.throwIfAborted();
    if (!current.detector) update({ availability: availabilityValue }, signal);
    if (availabilityValue === 'unavailable')
      throw new Error('Language Detector is unavailable with the provided options.');
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
    current.detector?.destroy();
    update(
      { detector: instance, createOptions: normalizedOptions, availability: 'available', downloadProgress: 100 },
      signal
    );
    signal.throwIfAborted();
    updateModelProps(instance);
    signal.throwIfAborted();
    return instance;
  };
  const create = async (options: LanguageDetectorCreate = current.createOptions) => {
    const signal = operation.begin();
    try {
      return await createInternal(options, signal);
    } finally {
      if (operation.end(signal)) update({ processing: '' });
    }
  };
  const destroy = () => {
    interrupt();
    current.detector?.destroy();
    update({ detector: null });
    updateModelProps(null);
  };
  const interrupt = () => {
    availabilityVersion += 1;
    operation.interrupt();
    update({ processing: '' });
  };
  const dispose = () => {
    interrupt();
    destroy();
    update({ availability: null });
    update({ createOptions: normalizeCreateOptions(defaultCreateOptions) });
    update({ downloadProgress: 0 });
    update({ inputUsage: null });
    update({ results: [] });
    update({ error: null });
    update({ lastResult: null });
    update({ progressState: createEmptyProgressState() });
    update({ processing: '' });
  };
  const ensureDetector = async (
    options: LanguageDetectorCreate | undefined,
    autoCreate: boolean,
    signal: AbortSignal
  ) => {
    signal.throwIfAborted();
    const nextOptions = normalizeCreateOptions(options ?? current.createOptions);
    if (current.detector && getCreateOptionsKey(nextOptions) === getCreateOptionsKey(current.createOptions)) {
      return current.detector;
    }
    if (!autoCreate) {
      throw new Error('Language Detector is not initialized. Call create() first or enable autoCreate.');
    }
    return createInternal(nextOptions, signal);
  };
  const measureInputUsageInternal = async (
    instance: LanguageDetector,
    input: string,
    options: LanguageDetectorRunNativeOptions | undefined,
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
  const measureWithSignal = async (
    instance: LanguageDetector,
    input: string,
    options: LanguageDetectorRunNativeOptions | undefined,
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
  const measureInputUsage = async (input: string, options: LanguageDetectorRunOptions = {}) => {
    const signal = operation.begin();
    try {
      const instance = await ensureDetector(options.createOptions, options.autoCreate !== false, signal);
      signal.throwIfAborted();
      const normalized = normalizeDetectorInput(input, options.stripHtml);
      const nativeOptions = getNativeDetectOptions(options);
      update({ processing: 'measure' }, signal);
      setProgressState({ phase: 'measuring', inputQuota: instance.inputQuota }, options.onProgress, signal);
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
      if (operation.end(signal)) update({ processing: '' }, signal);
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
  const detectChunk = async (
    instance: LanguageDetector,
    chunk: TextChunk,
    nativeOptions: LanguageDetectorRunNativeOptions,
    signal: AbortSignal,
    maxResults: number
  ): Promise<LanguageDetectorChunkResult> => {
    const usage = await measureWithSignal(instance, chunk.text, nativeOptions, signal);
    signal.throwIfAborted();
    const chunkResults = await instance.detect(chunk.text, {
      ...nativeOptions,
      signal
    });
    signal.throwIfAborted();
    const weight = Number.isFinite(usage) && usage > 0 ? usage : Math.max(chunk.text.length, 1);
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
  const detectWithDetailsInternal = async (
    input: string,
    options: LanguageDetectorRunOptions,
    signal: AbortSignal
  ): Promise<LanguageDetectorResult> => {
    update({ error: null }, signal);
    update({ results: [] }, signal);
    update({ lastResult: null }, signal);
    try {
      const instance = await ensureDetector(options.createOptions, options.autoCreate !== false, signal);
      signal.throwIfAborted();
      const normalized = normalizeDetectorInput(input, options.stripHtml);
      const nativeOptions = getNativeDetectOptions(options);
      const chunkBudgetRatio = clampRatio(options.chunkBudgetRatio, DEFAULT_CHUNK_BUDGET_RATIO);
      const largeInputStrategy = options.largeInputStrategy ?? 'chunk';
      const minConfidence = clampConfidence(options.minConfidence ?? DEFAULT_MIN_CONFIDENCE);
      const maxResults = clampCount(options.maxResults, DEFAULT_MAX_RESULTS);
      update({ processing: 'detect' }, signal);
      setProgressState(
        {
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
        },
        options.onProgress,
        signal
      );
      const usage = await measureWithSignal(instance, normalized, nativeOptions, signal);
      signal.throwIfAborted();
      update({ inputUsage: Number.isFinite(usage) ? usage : null }, signal);
      update({ inputQuota: instance.inputQuota }, signal);
      const budget = Math.floor(instance.inputQuota * chunkBudgetRatio);
      const shouldUseLargeInputPath =
        largeInputStrategy !== 'never' && Number.isFinite(usage) && usage > budget && budget > 0;
      let analyzedInput = normalized;
      let chunked = false;
      let sampled = false;
      let chunkResults: LanguageDetectorChunkResult[] = [];
      let rankedResults: NormalizedLanguageDetectionResult[];
      if (shouldUseLargeInputPath && largeInputStrategy === 'sample') {
        const estimatedCharacters = Math.max(Math.floor(normalized.length * (budget / usage)), 600);
        analyzedInput = createSampledInput(normalized, estimatedCharacters);
        sampled = analyzedInput !== normalized;
      }
      if (shouldUseLargeInputPath && largeInputStrategy === 'chunk') {
        chunked = true;
        const chunks = await buildChunks(normalized, budget, instance, nativeOptions, signal, options.onProgress);
        signal.throwIfAborted();
        for (const chunk of chunks) {
          setProgressState(
            {
              phase: 'detecting',
              totalChunks: chunks.length,
              currentChunk: chunk.index + 1,
              processedChunks: chunkResults.length,
              chunked: true
            },
            options.onProgress,
            signal
          );
          const result = await detectChunk(instance, chunk, nativeOptions, signal, maxResults);
          signal.throwIfAborted();
          chunkResults.push(result);
          setProgressState(
            {
              processedChunks: chunkResults.length
            },
            options.onProgress,
            signal
          );
        }
        rankedResults = aggregateChunkResults(chunkResults, maxResults);
      } else {
        setProgressState(
          {
            phase: 'detecting',
            inputUsage: current.inputUsage,
            inputQuota: instance.inputQuota,
            totalChunks: 1,
            currentChunk: 1,
            sampled
          },
          options.onProgress,
          signal
        );
        signal.throwIfAborted();
        const nativeResults = await instance.detect(analyzedInput, {
          ...nativeOptions,
          signal
        });
        signal.throwIfAborted();
        rankedResults = normalizeDetectionResults(nativeResults, maxResults);
      }
      const reportedResults = selectReportedResults(rankedResults, minConfidence, maxResults);
      const top = getTopResult(rankedResults, minConfidence);
      update({ results: reportedResults }, signal);
      const result: LanguageDetectorResult = {
        input: normalized,
        analyzedInput,
        detectedLanguage: top.detectedLanguage,
        confidence: top.confidence,
        name: top.name,
        isUnknown: top.isUnknown,
        inputUsage: current.inputUsage,
        inputQuota: instance.inputQuota,
        minConfidence,
        maxResults,
        expectedInputLanguages: normalizeExpectedInputLanguages(instance.expectedInputLanguages),
        chunked,
        sampled,
        chunks: chunkResults,
        results: reportedResults
      };
      update({ lastResult: result }, signal);
      setProgressState(
        {
          phase: 'ready',
          inputUsage: current.inputUsage,
          inputQuota: instance.inputQuota,
          processedChunks: chunked ? chunkResults.length : 1,
          totalChunks: chunked ? chunkResults.length : 1,
          topLanguage: top.detectedLanguage,
          topConfidence: top.confidence,
          chunked,
          sampled
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
    }
  };
  const detectWithDetails = async (input: string, options: LanguageDetectorRunOptions = {}) => {
    const signal = operation.begin();
    try {
      return await detectWithDetailsInternal(input, options, signal);
    } finally {
      if (operation.end(signal)) update({ processing: '' });
    }
  };
  const detect = async (input: string, options: LanguageDetectorRunOptions = {}) => {
    const result = await detectWithDetails(input, options);
    return result.detectedLanguage;
  };
  const detectMany = async (items: LanguageDetectorBatchItem[], options: LanguageDetectorBatchOptions = {}) => {
    const signal = operation.begin();
    try {
      const batchResults: Array<LanguageDetectorResult | null> = [];
      const failures: unknown[] = [];
      const { continueOnError, ...runOptions } = options;
      for (let index = 0; index < items.length; index += 1) {
        signal.throwIfAborted();
        const item = items[index];
        const baseCreateOptions = runOptions.createOptions ?? current.createOptions;
        setProgressState(
          {
            phase: 'detecting',
            currentChunk: index + 1,
            totalChunks: items.length
          },
          runOptions.onProgress,
          signal
        );
        try {
          batchResults.push(
            await detectWithDetailsInternal(
              item.input,
              {
                ...runOptions,
                createOptions: {
                  ...baseCreateOptions,
                  expectedInputLanguages: item.expectedInputLanguages ?? baseCreateOptions.expectedInputLanguages
                },
                stripHtml: item.stripHtml
              },
              signal
            )
          );
        } catch (caughtError) {
          failures.push(caughtError);
          batchResults.push(null);
          if (signal.aborted || isAbortError(caughtError) || !continueOnError) {
            throw caughtError;
          }
        }
      }
      return { results: batchResults, failures };
    } finally {
      if (operation.end(signal)) update({ processing: '' }, signal);
    }
  };
  return projectWorkflow(
    store,
    () => ({
      detector: current.detector,
      processing: current.processing,
      availability: current.availability,
      downloadProgress: current.downloadProgress,
      inputUsage: current.inputUsage,
      inputQuota: current.inputQuota,
      inputQuotaAvailable: inputQuotaAvailable(),
      results: current.results,
      topResult: topResult(),
      error: current.error,
      progressState: current.progressState,
      lastResult: current.lastResult,
      createOptions: current.createOptions,
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
      detect,
      detectWithDetails,
      detectMany,
      interrupt
    }
  );
}
