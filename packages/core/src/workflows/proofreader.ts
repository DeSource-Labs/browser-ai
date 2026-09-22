import { createWorkflowSession } from './lifecycle.js';
import { createBrowserAiStore } from '../store.js';
import { projectWorkflow } from './state.js';
import { normalizeTextInput, stripHtmlForText, type TextChunk } from '../text.js';
import { createDownloadMonitor, isAbortError, safeCheckAvailability, createAbortManager } from '../platform.js';
import {
  LANGUAGE_DETECTOR_LANGUAGE_OPTIONS,
  getLanguageDetectorLanguageName,
  type LanguageDetectorLanguageOption
} from './language-detector.js';
export type ProofreaderAvailability = Availability;
export type ProofreaderProcessingState = 'availability' | 'create' | 'measure' | 'proofread' | '';
export type ProofreaderCreateCore = ProofreaderCreateCoreOptions;
export type ProofreaderCreate = Omit<ProofreaderCreateOptions, 'signal' | 'monitor'>;
export type ProofreaderRunNativeOptions = Omit<ProofreaderProofreadOptions, 'signal'>;
export type ProofreaderLargeInputStrategy = 'auto' | 'never';
export type ProofreaderCorrectionType = CorrectionType;
export type ProofreaderProgressPhase =
  'idle' | 'checking' | 'creating' | 'measuring' | 'chunking' | 'proofreading' | 'ready' | 'error';
export interface ProofreaderProgressState {
  phase: ProofreaderProgressPhase;
  inputUsage: number | null;
  inputQuota: number | null;
  processedChunks: number;
  totalChunks: number;
  currentChunk: number;
  chunked: boolean;
  corrections: number;
}
export interface NormalizedProofreadCorrection {
  index: number;
  startIndex: number;
  endIndex: number;
  original: string;
  correction: string;
  types: ProofreaderCorrectionType[];
  explanation: string;
}
export interface ProofreaderChunkResult {
  index: number;
  input: string;
  correctedInput: string;
  corrections: NormalizedProofreadCorrection[];
  inputUsage: number | null;
  start: number;
  end: number;
}
export interface ProofreaderResult {
  input: string;
  correctedInput: string;
  corrections: NormalizedProofreadCorrection[];
  chunks: ProofreaderChunkResult[];
  inputUsage: number | null;
  inputQuota: number | null;
  chunked: boolean;
  hasCorrections: boolean;
  expectedInputLanguages: string[];
  includeCorrectionTypes: boolean;
  includeCorrectionExplanations: boolean;
  correctionExplanationLanguage?: string;
}
export interface ProofreaderRunOptions extends ProofreaderRunNativeOptions {
  createOptions?: ProofreaderCreate;
  autoCreate?: boolean;
  stripHtml?: boolean;
  largeInputStrategy?: ProofreaderLargeInputStrategy;
  maxChunkCharacters?: number;
  chunkBudgetRatio?: number;
  onProgress?: (state: ProofreaderProgressState) => void;
}
export interface ProofreaderBatchItem {
  input: string;
  expectedInputLanguages?: string[];
  stripHtml?: boolean;
}
export interface ProofreaderBatchOptions extends Omit<ProofreaderRunOptions, 'stripHtml'> {
  continueOnError?: boolean;
}
export interface ProofreaderTextSegment {
  text: string;
  correctedText?: string;
  correction?: NormalizedProofreadCorrection;
}
type ProofreaderWithOptionalQuota = Proofreader & {
  readonly inputQuota?: number;
  measureInputUsage?: (input: string, options?: ProofreaderProofreadOptions) => Promise<number>;
};
type GlobalWithProofreader = typeof globalThis & {
  Proofreader?: typeof Proofreader;
};
const DEFAULT_MAX_CHUNK_CHARACTERS = 8000;
const DEFAULT_CHUNK_BUDGET_RATIO = 0.82;
const MIN_CHUNK_CHARACTERS = 600;
export const PROOFREADER_LANGUAGE_OPTIONS: LanguageDetectorLanguageOption[] = LANGUAGE_DETECTOR_LANGUAGE_OPTIONS;
export const getProofreaderLanguageName = getLanguageDetectorLanguageName;
const getProofreader = () => {
  return (globalThis as GlobalWithProofreader).Proofreader;
};
const createEmptyProgressState = (): ProofreaderProgressState => ({
  phase: 'idle',
  inputUsage: null,
  inputQuota: null,
  processedChunks: 0,
  totalChunks: 0,
  currentChunk: 0,
  chunked: false,
  corrections: 0
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
const normalizeCreateOptions = (options: ProofreaderCreate = {}): ProofreaderCreate => {
  const normalized: ProofreaderCreate = {
    ...options,
    expectedInputLanguages: normalizeExpectedInputLanguages(options.expectedInputLanguages),
    includeCorrectionTypes: Boolean(options.includeCorrectionTypes),
    includeCorrectionExplanations: Boolean(options.includeCorrectionExplanations)
  };
  const explanationLanguage = options.correctionExplanationLanguage?.trim();
  if (normalized.includeCorrectionExplanations && explanationLanguage) {
    normalized.correctionExplanationLanguage = explanationLanguage;
  } else {
    delete normalized.correctionExplanationLanguage;
  }
  return normalized;
};
const getCreateOptionsKey = (options: ProofreaderCreate = {}) => {
  const normalized = normalizeCreateOptions(options);
  return JSON.stringify({
    expectedInputLanguages: normalizeExpectedInputLanguages(normalized.expectedInputLanguages)
      .map((item) => item.toLowerCase())
      .sort(),
    includeCorrectionTypes: normalized.includeCorrectionTypes,
    includeCorrectionExplanations: normalized.includeCorrectionExplanations,
    correctionExplanationLanguage: normalized.correctionExplanationLanguage?.toLowerCase() ?? ''
  });
};
const normalizeProofreaderInput = (value: string, stripHtml?: boolean) => {
  return stripHtml ? stripHtmlForText(value) : normalizeTextInput(value);
};
const clampRatio = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value as number, 0.2), 0.95);
};
const clampChunkCharacters = (value: number | undefined) => {
  if (!Number.isFinite(value)) return DEFAULT_MAX_CHUNK_CHARACTERS;
  return Math.max(Math.round(value as number), MIN_CHUNK_CHARACTERS);
};
const getNativeProofreadOptions = (
  options: ProofreaderRunOptions | ProofreaderBatchOptions = {}
): ProofreaderRunNativeOptions => {
  const {
    createOptions: _createOptions,
    autoCreate: _autoCreate,
    stripHtml: _stripHtml,
    largeInputStrategy: _largeInputStrategy,
    maxChunkCharacters: _maxChunkCharacters,
    chunkBudgetRatio: _chunkBudgetRatio,
    onProgress: _onProgress,
    continueOnError: _continueOnError,
    ...nativeOptions
  } = options as ProofreaderRunOptions & {
    continueOnError?: boolean;
  };
  return nativeOptions;
};
const getInputQuota = (instance?: Proofreader | null) => {
  const quota = (instance as ProofreaderWithOptionalQuota | null | undefined)?.inputQuota;
  return typeof quota === 'number' ? quota : null;
};
const normalizeCorrectionTypes = (types?: CorrectionType[]) => {
  return Array.isArray(types) ? types.filter(Boolean) : [];
};
const normalizeCorrections = (
  input: string,
  corrections: ProofreadCorrection[],
  offset = 0,
  startIndex = 0
): NormalizedProofreadCorrection[] => {
  return corrections.map((correction, index) => {
    const localStart = Math.min(Math.max(correction.startIndex, 0), input.length);
    const localEnd = Math.min(Math.max(correction.endIndex, localStart), input.length);
    const start = localStart + offset;
    const end = localEnd + offset;
    return {
      index: startIndex + index,
      startIndex: start,
      endIndex: end,
      original: input.slice(localStart, localEnd),
      correction: correction.correction,
      types: normalizeCorrectionTypes(correction.types),
      explanation: correction.explanation ?? ''
    };
  });
};
const createProofreadTextSegments = (
  input: string,
  corrections: NormalizedProofreadCorrection[]
): ProofreaderTextSegment[] => {
  const segments: ProofreaderTextSegment[] = [];
  let cursor = 0;
  for (const correction of corrections) {
    if (correction.startIndex > cursor) {
      segments.push({ text: input.slice(cursor, correction.startIndex) });
    }
    segments.push({
      text: input.slice(correction.startIndex, correction.endIndex),
      correctedText: correction.correction,
      correction
    });
    cursor = correction.endIndex;
  }
  if (cursor < input.length) {
    segments.push({ text: input.slice(cursor) });
  }
  return segments;
};
const buildCharacterChunks = (input: string, maxCharacters: number): TextChunk[] => {
  if (input.length <= maxCharacters) {
    return [{ text: input, index: 0, start: 0, end: input.length }];
  }
  const chunks: TextChunk[] = [];
  let cursor = 0;
  while (cursor < input.length) {
    let end = Math.min(cursor + maxCharacters, input.length);
    if (end < input.length) {
      const paragraphBreak = input.lastIndexOf('\n\n', end);
      const sentenceBreak = Math.max(
        input.lastIndexOf('. ', end),
        input.lastIndexOf('! ', end),
        input.lastIndexOf('? ', end)
      );
      const wordBreak = input.lastIndexOf(' ', end);
      const minimumBreak = cursor + Math.floor(maxCharacters * 0.45);
      const breakPoint = [paragraphBreak, sentenceBreak + 1, wordBreak]
        .filter((candidate) => candidate > minimumBreak)
        .sort((left, right) => right - left)[0];
      if (breakPoint && breakPoint > cursor) {
        end = breakPoint;
      }
    }
    if (end <= cursor) {
      end = Math.min(cursor + maxCharacters, input.length);
    }
    chunks.push({
      text: input.slice(cursor, end),
      index: chunks.length,
      start: cursor,
      end
    });
    cursor = end;
  }
  return chunks;
};
export function createProofreaderWorkflow(defaultCreateOptions: ProofreaderCreate = {}) {
  let current = {
    proofreader: null as Proofreader | null,
    availability: null as Availability | null,
    createOptions: normalizeCreateOptions(defaultCreateOptions) as ProofreaderCreate,
    processing: '' as ProofreaderProcessingState,
    downloadProgress: 0,
    inputUsage: null as number | null,
    inputQuota: null as number | null,
    output: '',
    corrections: [] as NormalizedProofreadCorrection[],
    error: null as unknown,
    progressState: createEmptyProgressState() as ProofreaderProgressState,
    lastResult: null as ProofreaderResult | null
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
    return current.proofreader !== null && current.availability === 'available';
  };
  const isProcessing = () => current.processing !== '';
  const hasCorrections = () => current.corrections.length > 0;
  const inputQuotaAvailable = () => {
    if (current.inputQuota == null || current.inputUsage == null) {
      return null;
    }
    return Math.max(current.inputQuota - current.inputUsage, 0);
  };
  const updateModelProps = (instance?: Proofreader | null) => {
    update({ inputQuota: getInputQuota(instance) });
  };
  const setProgressState = (
    patch: Partial<ProofreaderProgressState>,
    onProgress?: ProofreaderRunOptions['onProgress'],
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
  const checkAvailability = async (options: ProofreaderCreateCoreOptions = current.createOptions) => {
    return safeCheckAvailability(getProofreader(), normalizeCreateOptions(options));
  };
  const requestAvailability = async (options: ProofreaderCreateCoreOptions = current.createOptions) => {
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
  const init = async (options: ProofreaderCreateCoreOptions = current.createOptions) => {
    destroy();
    update({ createOptions: normalizeCreateOptions(options) });
    const status = await requestAvailability(options);
    if (status === 'unavailable') {
      throw new Error('Proofreader is unavailable with the provided options.');
    }
    return status;
  };
  const createInternal = async (options: ProofreaderCreate, signal: AbortSignal) => {
    signal.throwIfAborted();
    availabilityVersion += 1;
    const Constructor = getProofreader();
    if (typeof Constructor?.create !== 'function') {
      throw new Error('Proofreader is not available in this browser context.');
    }
    const normalizedOptions = normalizeCreateOptions(options);
    update({ processing: 'create', downloadProgress: 0 }, signal);
    setProgressState({ phase: 'creating' }, undefined, signal);
    const availabilityValue = await checkAvailability(normalizedOptions);
    signal.throwIfAborted();
    if (!current.proofreader) update({ availability: availabilityValue }, signal);
    if (availabilityValue === 'unavailable') throw new Error('Proofreader is unavailable with the provided options.');
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
    current.proofreader?.destroy();
    update(
      {
        proofreader: instance,
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
  const create = async (options: ProofreaderCreate = current.createOptions) => {
    const signal = operation.begin();
    try {
      return await createInternal(options, signal);
    } finally {
      if (operation.end(signal)) update({ processing: '' });
    }
  };
  const destroy = () => {
    interrupt();
    current.proofreader?.destroy();
    update({ proofreader: null });
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
    update({ output: '' });
    update({ corrections: [] });
    update({ error: null });
    update({ lastResult: null });
    update({ progressState: createEmptyProgressState() });
    update({ processing: '' });
  };
  const ensureProofreader = async (
    options: ProofreaderCreate | undefined,
    autoCreate: boolean,
    signal: AbortSignal
  ) => {
    signal.throwIfAborted();
    const nextOptions = normalizeCreateOptions(options ?? current.createOptions);
    if (current.proofreader && getCreateOptionsKey(nextOptions) === getCreateOptionsKey(current.createOptions)) {
      return current.proofreader;
    }
    if (!autoCreate) {
      throw new Error('Proofreader is not initialized. Call create() first or enable autoCreate.');
    }
    return createInternal(nextOptions, signal);
  };
  const measureInputUsageInternal = async (
    instance: Proofreader,
    input: string,
    options: ProofreaderRunNativeOptions | undefined,
    signal: AbortSignal
  ) => {
    signal.throwIfAborted();
    const measure = (instance as ProofreaderWithOptionalQuota).measureInputUsage;
    if (typeof measure !== 'function') {
      update({ inputUsage: null }, signal);
      return null;
    }
    signal.throwIfAborted();
    const usage = await measure.call(instance, input, {
      ...options,
      signal
    });
    signal.throwIfAborted();
    update({ inputUsage: usage }, signal);
    return usage;
  };
  const measureWithSignal = async (
    instance: Proofreader,
    input: string,
    options: ProofreaderRunNativeOptions | undefined,
    signal: AbortSignal
  ) => {
    try {
      return await measureInputUsageInternal(instance, input, options, signal);
    } catch (caughtError) {
      signal.throwIfAborted();
      if (isAbortError(caughtError)) {
        throw caughtError;
      }
      return null;
    }
  };
  const measureInputUsage = async (input: string, options: ProofreaderRunOptions = {}) => {
    const signal = operation.begin();
    try {
      const instance = await ensureProofreader(options.createOptions, options.autoCreate !== false, signal);
      signal.throwIfAborted();
      const normalized = normalizeProofreaderInput(input, options.stripHtml);
      const nativeOptions = getNativeProofreadOptions(options);
      update({ processing: 'measure' }, signal);
      setProgressState({ phase: 'measuring', inputQuota: getInputQuota(instance) }, options.onProgress, signal);
      const usage = await measureInputUsageInternal(instance, normalized, nativeOptions, signal);
      signal.throwIfAborted();
      setProgressState(
        {
          inputUsage: usage,
          inputQuota: getInputQuota(instance)
        },
        options.onProgress,
        signal
      );
      return usage;
    } finally {
      if (operation.end(signal)) update({ processing: '' }, signal);
    }
  };
  const proofreadChunk = async (
    instance: Proofreader,
    chunk: TextChunk,
    nativeOptions: ProofreaderRunNativeOptions,
    signal: AbortSignal,
    correctionStartIndex: number
  ): Promise<ProofreaderChunkResult> => {
    const usage = await measureWithSignal(instance, chunk.text, nativeOptions, signal);
    signal.throwIfAborted();
    const result = await instance.proofread(chunk.text, {
      ...nativeOptions,
      signal
    });
    signal.throwIfAborted();
    const normalizedCorrections = normalizeCorrections(
      chunk.text,
      result.corrections,
      chunk.start,
      correctionStartIndex
    );
    return {
      index: chunk.index,
      input: chunk.text,
      correctedInput: result.correctedInput,
      corrections: normalizedCorrections,
      inputUsage: usage,
      start: chunk.start,
      end: chunk.end
    };
  };
  const proofreadWithDetailsInternal = async (
    input: string,
    options: ProofreaderRunOptions,
    signal: AbortSignal
  ): Promise<ProofreaderResult> => {
    update({ error: null }, signal);
    update({ output: '' }, signal);
    update({ corrections: [] }, signal);
    update({ lastResult: null }, signal);
    try {
      const instance = await ensureProofreader(options.createOptions, options.autoCreate !== false, signal);
      signal.throwIfAborted();
      const normalized = normalizeProofreaderInput(input, options.stripHtml);
      const nativeOptions = getNativeProofreadOptions(options);
      const chunkBudgetRatio = clampRatio(options.chunkBudgetRatio, DEFAULT_CHUNK_BUDGET_RATIO);
      const maxChunkCharacters = clampChunkCharacters(options.maxChunkCharacters);
      const largeInputStrategy = options.largeInputStrategy ?? 'auto';
      update({ processing: 'proofread' }, signal);
      setProgressState(
        {
          phase: 'measuring',
          inputUsage: null,
          inputQuota: getInputQuota(instance),
          processedChunks: 0,
          totalChunks: 0,
          currentChunk: 0,
          chunked: false,
          corrections: 0
        },
        options.onProgress,
        signal
      );
      const usage = await measureWithSignal(instance, normalized, nativeOptions, signal);
      signal.throwIfAborted();
      update({ inputUsage: usage }, signal);
      update({ inputQuota: getInputQuota(instance) }, signal);
      const measuredBudget =
        current.inputQuota && Number.isFinite(current.inputQuota)
          ? Math.floor(current.inputQuota * chunkBudgetRatio)
          : null;
      const shouldChunkByUsage =
        largeInputStrategy !== 'never' && measuredBudget != null && usage != null && usage > measuredBudget;
      const shouldChunkByLength = largeInputStrategy !== 'never' && normalized.length > maxChunkCharacters;
      const shouldChunk = shouldChunkByUsage || shouldChunkByLength;
      if (!shouldChunk) {
        setProgressState(
          {
            phase: 'proofreading',
            inputUsage: usage,
            inputQuota: current.inputQuota,
            totalChunks: 1,
            currentChunk: 1
          },
          options.onProgress,
          signal
        );
        signal.throwIfAborted();
        const proofreadResult = await instance.proofread(normalized, {
          ...nativeOptions,
          signal
        });
        signal.throwIfAborted();
        const normalizedCorrections = normalizeCorrections(normalized, proofreadResult.corrections);
        update({ output: proofreadResult.correctedInput }, signal);
        update({ corrections: normalizedCorrections }, signal);
        const result: ProofreaderResult = {
          input: normalized,
          correctedInput: proofreadResult.correctedInput,
          corrections: normalizedCorrections,
          chunks: [],
          inputUsage: usage,
          inputQuota: current.inputQuota,
          chunked: false,
          hasCorrections: normalizedCorrections.length > 0,
          expectedInputLanguages: normalizeExpectedInputLanguages(instance.expectedInputLanguages),
          includeCorrectionTypes: instance.includeCorrectionTypes,
          includeCorrectionExplanations: instance.includeCorrectionExplanations,
          correctionExplanationLanguage: instance.correctionExplanationLanguage
        };
        update({ lastResult: result }, signal);
        setProgressState(
          {
            phase: 'ready',
            processedChunks: 1,
            corrections: normalizedCorrections.length
          },
          options.onProgress,
          signal
        );
        return result;
      }
      setProgressState({ phase: 'chunking', chunked: true }, options.onProgress, signal);
      const measuredChunkCharacters =
        shouldChunkByUsage && usage != null && usage > 0 && measuredBudget != null
          ? Math.max(Math.floor(normalized.length * (measuredBudget / usage)), MIN_CHUNK_CHARACTERS)
          : maxChunkCharacters;
      const chunks = buildCharacterChunks(normalized, Math.min(maxChunkCharacters, measuredChunkCharacters));
      const chunkResults: ProofreaderChunkResult[] = [];
      for (const chunk of chunks) {
        setProgressState(
          {
            phase: 'proofreading',
            totalChunks: chunks.length,
            currentChunk: chunk.index + 1,
            processedChunks: chunkResults.length,
            chunked: true
          },
          options.onProgress,
          signal
        );
        const result = await proofreadChunk(
          instance,
          chunk,
          nativeOptions,
          signal,
          chunkResults.reduce((total, item) => total + item.corrections.length, 0)
        );
        signal.throwIfAborted();
        chunkResults.push(result);
        update({ output: chunkResults.map((item) => item.correctedInput).join('') }, signal);
        update({ corrections: chunkResults.flatMap((item) => item.corrections) }, signal);
        setProgressState(
          {
            processedChunks: chunkResults.length,
            corrections: current.corrections.length
          },
          options.onProgress,
          signal
        );
      }
      const correctedInput = current.output;
      const result: ProofreaderResult = {
        input: normalized,
        correctedInput,
        corrections: current.corrections,
        chunks: chunkResults,
        inputUsage: current.inputUsage,
        inputQuota: current.inputQuota,
        chunked: true,
        hasCorrections: current.corrections.length > 0,
        expectedInputLanguages: normalizeExpectedInputLanguages(instance.expectedInputLanguages),
        includeCorrectionTypes: instance.includeCorrectionTypes,
        includeCorrectionExplanations: instance.includeCorrectionExplanations,
        correctionExplanationLanguage: instance.correctionExplanationLanguage
      };
      update({ lastResult: result }, signal);
      setProgressState(
        {
          phase: 'ready',
          processedChunks: chunkResults.length,
          totalChunks: chunkResults.length,
          corrections: current.corrections.length
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
  const proofreadWithDetails = async (input: string, options: ProofreaderRunOptions = {}) => {
    const signal = operation.begin();
    try {
      return await proofreadWithDetailsInternal(input, options, signal);
    } finally {
      if (operation.end(signal)) update({ processing: '' });
    }
  };
  const proofread = async (input: string, options: ProofreaderRunOptions = {}) => {
    const result = await proofreadWithDetails(input, options);
    return result.correctedInput;
  };
  const proofreadMany = async (items: ProofreaderBatchItem[], options: ProofreaderBatchOptions = {}) => {
    const signal = operation.begin();
    try {
      const batchResults: Array<ProofreaderResult | null> = [];
      const failures: unknown[] = [];
      const { continueOnError, ...runOptions } = options;
      for (let index = 0; index < items.length; index += 1) {
        signal.throwIfAborted();
        const item = items[index];
        const baseCreateOptions = runOptions.createOptions ?? current.createOptions;
        setProgressState(
          {
            phase: 'proofreading',
            currentChunk: index + 1,
            totalChunks: items.length
          },
          runOptions.onProgress,
          signal
        );
        try {
          batchResults.push(
            await proofreadWithDetailsInternal(
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
      proofreader: current.proofreader,
      processing: current.processing,
      availability: current.availability,
      downloadProgress: current.downloadProgress,
      inputUsage: current.inputUsage,
      inputQuota: current.inputQuota,
      inputQuotaAvailable: inputQuotaAvailable(),
      output: current.output,
      corrections: current.corrections,
      hasCorrections: hasCorrections(),
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
      proofread,
      proofreadWithDetails,
      proofreadMany,
      createProofreadTextSegments,
      interrupt
    }
  );
}
