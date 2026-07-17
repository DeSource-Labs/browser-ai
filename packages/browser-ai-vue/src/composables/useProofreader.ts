import { computed, ref, shallowRef } from "vue";
import {
  normalizeTextInput,
  stripHtmlForText,
  type TextChunk,
} from "../utils/text";
import {
  createDownloadMonitor,
  isAbortError,
  safeCheckAvailability,
  useAbortableOperation,
} from "../utils/browserAi";
import {
  LANGUAGE_DETECTOR_LANGUAGE_OPTIONS,
  getLanguageDetectorLanguageName,
  type LanguageDetectorLanguageOption,
} from "./useLanguageDetector";

export type ProofreaderAvailability = Availability;
export type ProofreaderProcessingState =
  "availability" | "create" | "measure" | "proofread" | "";
export type ProofreaderCreateCore = ProofreaderCreateCoreOptions;
export type ProofreaderCreate = Omit<
  ProofreaderCreateOptions,
  "signal" | "monitor"
>;
export type ProofreaderRunNativeOptions = Omit<
  ProofreaderProofreadOptions,
  "signal"
>;
export type ProofreaderLargeInputStrategy = "auto" | "never";
export type ProofreaderCorrectionType = CorrectionType;

export type ProofreaderProgressPhase =
  | "idle"
  | "checking"
  | "creating"
  | "measuring"
  | "chunking"
  | "proofreading"
  | "ready"
  | "error";

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

export interface ProofreaderBatchOptions extends Omit<
  ProofreaderRunOptions,
  "stripHtml"
> {
  continueOnError?: boolean;
}

export interface ProofreaderTextSegment {
  text: string;
  correctedText?: string;
  correction?: NormalizedProofreadCorrection;
}

type ProofreaderWithOptionalQuota = Proofreader & {
  readonly inputQuota?: number;
  measureInputUsage?: (
    input: string,
    options?: ProofreaderProofreadOptions,
  ) => Promise<number>;
};

type GlobalWithProofreader = typeof globalThis & {
  Proofreader?: typeof Proofreader;
};

const DEFAULT_MAX_CHUNK_CHARACTERS = 8000;
const DEFAULT_CHUNK_BUDGET_RATIO = 0.82;
const MIN_CHUNK_CHARACTERS = 600;

export const PROOFREADER_LANGUAGE_OPTIONS: LanguageDetectorLanguageOption[] =
  LANGUAGE_DETECTOR_LANGUAGE_OPTIONS;
export const getProofreaderLanguageName = getLanguageDetectorLanguageName;

const getProofreader = () => {
  return (globalThis as GlobalWithProofreader).Proofreader;
};

const createEmptyProgressState = (): ProofreaderProgressState => ({
  phase: "idle",
  inputUsage: null,
  inputQuota: null,
  processedChunks: 0,
  totalChunks: 0,
  currentChunk: 0,
  chunked: false,
  corrections: 0,
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

const normalizeCreateOptions = (
  options: ProofreaderCreate = {},
): ProofreaderCreate => {
  const normalized: ProofreaderCreate = {
    ...options,
    expectedInputLanguages: normalizeExpectedInputLanguages(
      options.expectedInputLanguages,
    ),
    includeCorrectionTypes: Boolean(options.includeCorrectionTypes),
    includeCorrectionExplanations: Boolean(
      options.includeCorrectionExplanations,
    ),
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
    expectedInputLanguages: normalizeExpectedInputLanguages(
      normalized.expectedInputLanguages,
    )
      .map((item) => item.toLowerCase())
      .sort(),
    includeCorrectionTypes: normalized.includeCorrectionTypes,
    includeCorrectionExplanations: normalized.includeCorrectionExplanations,
    correctionExplanationLanguage:
      normalized.correctionExplanationLanguage?.toLowerCase() ?? "",
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
  options: ProofreaderRunOptions | ProofreaderBatchOptions = {},
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
  } = options as ProofreaderRunOptions & { continueOnError?: boolean };
  return nativeOptions;
};

const getInputQuota = (instance?: Proofreader | null) => {
  const quota = (instance as ProofreaderWithOptionalQuota | null | undefined)
    ?.inputQuota;
  return typeof quota === "number" ? quota : null;
};

const normalizeCorrectionTypes = (types?: CorrectionType[]) => {
  return Array.isArray(types) ? types.filter(Boolean) : [];
};

const normalizeCorrections = (
  input: string,
  corrections: ProofreadCorrection[],
  offset = 0,
  startIndex = 0,
): NormalizedProofreadCorrection[] => {
  return corrections.map((correction, index) => {
    const start = Math.max(correction.startIndex + offset, 0);
    const end = Math.max(correction.endIndex + offset, start);
    return {
      index: startIndex + index,
      startIndex: start,
      endIndex: end,
      original: input.slice(correction.startIndex, correction.endIndex),
      correction: correction.correction,
      types: normalizeCorrectionTypes(correction.types),
      explanation: correction.explanation ?? "",
    };
  });
};

const createProofreadTextSegments = (
  input: string,
  corrections: NormalizedProofreadCorrection[],
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
      correction,
    });
    cursor = correction.endIndex;
  }

  if (cursor < input.length) {
    segments.push({ text: input.slice(cursor) });
  }

  return segments;
};

const buildCharacterChunks = (
  input: string,
  maxCharacters: number,
): TextChunk[] => {
  if (input.length <= maxCharacters) {
    return [{ text: input, index: 0, start: 0, end: input.length }];
  }

  const chunks: TextChunk[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    let end = Math.min(cursor + maxCharacters, input.length);

    if (end < input.length) {
      const paragraphBreak = input.lastIndexOf("\n\n", end);
      const sentenceBreak = Math.max(
        input.lastIndexOf(". ", end),
        input.lastIndexOf("! ", end),
        input.lastIndexOf("? ", end),
      );
      const wordBreak = input.lastIndexOf(" ", end);
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
      end,
    });
    cursor = end;
  }

  return chunks;
};

export function useProofreader(defaultCreateOptions: ProofreaderCreate = {}) {
  const proofreader = shallowRef<Proofreader | null>(null);
  const availability = ref<Availability | null>(null);
  const createOptions = ref<ProofreaderCreate>(
    normalizeCreateOptions(defaultCreateOptions),
  );
  const processing = ref<ProofreaderProcessingState>("");
  const downloadProgress = ref(0);
  const inputUsage = ref<number | null>(null);
  const inputQuota = ref<number | null>(null);
  const output = ref("");
  const corrections = ref<NormalizedProofreadCorrection[]>([]);
  const error = ref<unknown>(null);
  const progressState = ref<ProofreaderProgressState>(
    createEmptyProgressState(),
  );
  const lastResult = ref<ProofreaderResult | null>(null);

  const operation = useAbortableOperation();

  const isReady = computed(() => {
    return proofreader.value !== null && availability.value === "available";
  });

  const isProcessing = computed(() => processing.value !== "");

  const hasCorrections = computed(() => corrections.value.length > 0);

  const inputQuotaAvailable = computed(() => {
    if (inputQuota.value == null || inputUsage.value == null) {
      return null;
    }

    return Math.max(inputQuota.value - inputUsage.value, 0);
  });

  const updateModelProps = (instance?: Proofreader | null) => {
    inputQuota.value = getInputQuota(instance);
  };

  const setProgressState = (
    patch: Partial<ProofreaderProgressState>,
    onProgress?: ProofreaderRunOptions["onProgress"],
  ) => {
    progressState.value = {
      ...progressState.value,
      ...patch,
    };
    onProgress?.({ ...progressState.value });
  };

  const checkAvailability = async (
    options: ProofreaderCreateCoreOptions = createOptions.value,
  ) => {
    return safeCheckAvailability(
      getProofreader(),
      normalizeCreateOptions(options),
    );
  };

  const requestAvailability = async (
    options: ProofreaderCreateCoreOptions = createOptions.value,
  ) => {
    processing.value = "availability";
    setProgressState({ phase: "checking" });
    try {
      availability.value = await checkAvailability(options);
      return availability.value;
    } finally {
      processing.value = "";
    }
  };

  const init = async (
    options: ProofreaderCreateCoreOptions = createOptions.value,
  ) => {
    destroy();
    createOptions.value = normalizeCreateOptions(options);
    const status = await requestAvailability(options);

    if (status === "unavailable") {
      throw new Error("Proofreader is unavailable with the provided options.");
    }

    return status;
  };

  const create = async (options: ProofreaderCreate = createOptions.value) => {
    const ProofreaderConstructor = getProofreader();
    if (typeof ProofreaderConstructor?.create !== "function") {
      throw new Error("Proofreader is not available in this browser context.");
    }

    const normalizedOptions = normalizeCreateOptions(options);
    createOptions.value = normalizedOptions;

    availability.value = await checkAvailability(normalizedOptions);
    if (availability.value === "unavailable") {
      throw new Error("Proofreader is unavailable with the provided options.");
    }

    processing.value = "create";
    setProgressState({ phase: "creating" });
    const signal = operation.begin();
    destroy();
    downloadProgress.value = 0;

    const monitor = createDownloadMonitor((progress) => {
      downloadProgress.value = progress;
    });

    try {
      proofreader.value = await ProofreaderConstructor.create({
        ...normalizedOptions,
        signal,
        monitor,
      });
      availability.value = "available";
      downloadProgress.value = 100;
      updateModelProps(proofreader.value);
      return proofreader.value;
    } finally {
      operation.end(signal);
      processing.value = "";
    }
  };

  const destroy = () => {
    proofreader.value?.destroy();
    proofreader.value = null;
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
    output.value = "";
    corrections.value = [];
    error.value = null;
    lastResult.value = null;
    progressState.value = createEmptyProgressState();
    processing.value = "";
  };

  const ensureProofreader = async (
    options?: ProofreaderCreate,
    autoCreate = true,
  ) => {
    const nextOptions = normalizeCreateOptions(options ?? createOptions.value);

    if (
      proofreader.value &&
      getCreateOptionsKey(nextOptions) ===
        getCreateOptionsKey(createOptions.value)
    ) {
      return proofreader.value;
    }

    if (!autoCreate) {
      throw new Error(
        "Proofreader is not initialized. Call create() first or enable autoCreate.",
      );
    }

    return create(nextOptions);
  };

  const measureInputUsageInternal = async (
    instance: Proofreader,
    input: string,
    options: ProofreaderRunNativeOptions | undefined,
    signal: AbortSignal,
  ) => {
    const measure = (instance as ProofreaderWithOptionalQuota)
      .measureInputUsage;
    if (typeof measure !== "function") {
      inputUsage.value = null;
      return null;
    }

    const usage = await measure.call(instance, input, {
      ...options,
      signal,
    });
    inputUsage.value = usage;
    return usage;
  };

  const measureWithSignal = async (
    instance: Proofreader,
    input: string,
    options: ProofreaderRunNativeOptions | undefined,
    signal: AbortSignal,
  ) => {
    try {
      return await measureInputUsageInternal(instance, input, options, signal);
    } catch (caughtError) {
      if (isAbortError(caughtError)) {
        throw caughtError;
      }

      return null;
    }
  };

  const measureInputUsage = async (
    input: string,
    options: ProofreaderRunOptions = {},
  ) => {
    const instance = await ensureProofreader(
      options.createOptions,
      options.autoCreate !== false,
    );
    const normalized = normalizeProofreaderInput(input, options.stripHtml);
    const nativeOptions = getNativeProofreadOptions(options);

    processing.value = "measure";
    setProgressState(
      { phase: "measuring", inputQuota: getInputQuota(instance) },
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
          inputQuota: getInputQuota(instance),
        },
        options.onProgress,
      );
      return usage;
    } finally {
      operation.end(signal);
      processing.value = "";
    }
  };

  const proofreadChunk = async (
    instance: Proofreader,
    chunk: TextChunk,
    nativeOptions: ProofreaderRunNativeOptions,
    signal: AbortSignal,
    correctionStartIndex: number,
  ): Promise<ProofreaderChunkResult> => {
    const usage = await measureWithSignal(
      instance,
      chunk.text,
      nativeOptions,
      signal,
    );
    const result = await instance.proofread(chunk.text, {
      ...nativeOptions,
      signal,
    });
    const normalizedCorrections = normalizeCorrections(
      chunk.text,
      result.corrections,
      chunk.start,
      correctionStartIndex,
    );

    return {
      index: chunk.index,
      input: chunk.text,
      correctedInput: result.correctedInput,
      corrections: normalizedCorrections,
      inputUsage: usage,
      start: chunk.start,
      end: chunk.end,
    };
  };

  const proofreadWithDetails = async (
    input: string,
    options: ProofreaderRunOptions = {},
  ): Promise<ProofreaderResult> => {
    error.value = null;
    output.value = "";
    corrections.value = [];
    lastResult.value = null;

    const instance = await ensureProofreader(
      options.createOptions,
      options.autoCreate !== false,
    );
    const normalized = normalizeProofreaderInput(input, options.stripHtml);
    const nativeOptions = getNativeProofreadOptions(options);
    const signal = operation.begin();
    const chunkBudgetRatio = clampRatio(
      options.chunkBudgetRatio,
      DEFAULT_CHUNK_BUDGET_RATIO,
    );
    const maxChunkCharacters = clampChunkCharacters(options.maxChunkCharacters);
    const largeInputStrategy = options.largeInputStrategy ?? "auto";

    processing.value = "proofread";

    try {
      setProgressState(
        {
          phase: "measuring",
          inputUsage: null,
          inputQuota: getInputQuota(instance),
          processedChunks: 0,
          totalChunks: 0,
          currentChunk: 0,
          chunked: false,
          corrections: 0,
        },
        options.onProgress,
      );

      const usage = await measureWithSignal(
        instance,
        normalized,
        nativeOptions,
        signal,
      );
      inputUsage.value = usage;
      inputQuota.value = getInputQuota(instance);

      const measuredBudget =
        inputQuota.value && Number.isFinite(inputQuota.value)
          ? Math.floor(inputQuota.value * chunkBudgetRatio)
          : null;
      const shouldChunkByUsage =
        largeInputStrategy !== "never" &&
        measuredBudget != null &&
        usage != null &&
        usage > measuredBudget;
      const shouldChunkByLength =
        largeInputStrategy !== "never" &&
        normalized.length > maxChunkCharacters;
      const shouldChunk = shouldChunkByUsage || shouldChunkByLength;

      if (!shouldChunk) {
        setProgressState(
          {
            phase: "proofreading",
            inputUsage: usage,
            inputQuota: inputQuota.value,
            totalChunks: 1,
            currentChunk: 1,
          },
          options.onProgress,
        );

        const proofreadResult = await instance.proofread(normalized, {
          ...nativeOptions,
          signal,
        });
        const normalizedCorrections = normalizeCorrections(
          normalized,
          proofreadResult.corrections,
        );

        output.value = proofreadResult.correctedInput;
        corrections.value = normalizedCorrections;
        const result: ProofreaderResult = {
          input: normalized,
          correctedInput: proofreadResult.correctedInput,
          corrections: normalizedCorrections,
          chunks: [],
          inputUsage: usage,
          inputQuota: inputQuota.value,
          chunked: false,
          hasCorrections: normalizedCorrections.length > 0,
          expectedInputLanguages: normalizeExpectedInputLanguages(
            instance.expectedInputLanguages,
          ),
          includeCorrectionTypes: instance.includeCorrectionTypes,
          includeCorrectionExplanations: instance.includeCorrectionExplanations,
          correctionExplanationLanguage: instance.correctionExplanationLanguage,
        };
        lastResult.value = result;
        setProgressState(
          {
            phase: "ready",
            processedChunks: 1,
            corrections: normalizedCorrections.length,
          },
          options.onProgress,
        );
        return result;
      }

      setProgressState(
        { phase: "chunking", chunked: true },
        options.onProgress,
      );
      const chunks = buildCharacterChunks(normalized, maxChunkCharacters);
      const chunkResults: ProofreaderChunkResult[] = [];

      for (const chunk of chunks) {
        setProgressState(
          {
            phase: "proofreading",
            totalChunks: chunks.length,
            currentChunk: chunk.index + 1,
            processedChunks: chunkResults.length,
            chunked: true,
          },
          options.onProgress,
        );

        const result = await proofreadChunk(
          instance,
          chunk,
          nativeOptions,
          signal,
          chunkResults.reduce(
            (total, item) => total + item.corrections.length,
            0,
          ),
        );
        chunkResults.push(result);
        output.value = chunkResults.map((item) => item.correctedInput).join("");
        corrections.value = chunkResults.flatMap((item) => item.corrections);
        setProgressState(
          {
            processedChunks: chunkResults.length,
            corrections: corrections.value.length,
          },
          options.onProgress,
        );
      }

      const correctedInput = output.value;
      const result: ProofreaderResult = {
        input: normalized,
        correctedInput,
        corrections: corrections.value,
        chunks: chunkResults,
        inputUsage: inputUsage.value,
        inputQuota: inputQuota.value,
        chunked: true,
        hasCorrections: corrections.value.length > 0,
        expectedInputLanguages: normalizeExpectedInputLanguages(
          instance.expectedInputLanguages,
        ),
        includeCorrectionTypes: instance.includeCorrectionTypes,
        includeCorrectionExplanations: instance.includeCorrectionExplanations,
        correctionExplanationLanguage: instance.correctionExplanationLanguage,
      };
      lastResult.value = result;
      setProgressState(
        {
          phase: "ready",
          processedChunks: chunkResults.length,
          totalChunks: chunkResults.length,
          corrections: corrections.value.length,
        },
        options.onProgress,
      );
      return result;
    } catch (caughtError) {
      error.value = caughtError;
      setProgressState({ phase: "error" }, options.onProgress);
      throw caughtError;
    } finally {
      operation.end(signal);
      processing.value = "";
    }
  };

  const proofread = async (
    input: string,
    options: ProofreaderRunOptions = {},
  ) => {
    const result = await proofreadWithDetails(input, options);
    return result.correctedInput;
  };

  const proofreadMany = async (
    items: ProofreaderBatchItem[],
    options: ProofreaderBatchOptions = {},
  ) => {
    const batchResults: Array<ProofreaderResult | null> = [];
    const failures: unknown[] = [];
    const { continueOnError, ...runOptions } = options;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const baseCreateOptions = runOptions.createOptions ?? createOptions.value;
      setProgressState(
        {
          phase: "proofreading",
          currentChunk: index + 1,
          totalChunks: items.length,
        },
        runOptions.onProgress,
      );

      try {
        batchResults.push(
          await proofreadWithDetails(item.input, {
            ...runOptions,
            createOptions: {
              ...baseCreateOptions,
              expectedInputLanguages:
                item.expectedInputLanguages ??
                baseCreateOptions.expectedInputLanguages,
            },
            stripHtml: item.stripHtml,
          }),
        );
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
    proofreader: computed(() => proofreader.value),
    processing: computed(() => processing.value),
    availability: computed(() => availability.value),
    downloadProgress: computed(() => downloadProgress.value),
    inputUsage: computed(() => inputUsage.value),
    inputQuota: computed(() => inputQuota.value),
    inputQuotaAvailable,
    output: computed(() => output.value),
    corrections: computed(() => corrections.value),
    hasCorrections,
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
    proofread,
    proofreadWithDetails,
    proofreadMany,
    createProofreadTextSegments,
    interrupt,
  };
}
