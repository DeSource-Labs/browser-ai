import { computed, ref, watch } from 'vue';
import {
  buildMeasuredTextChunks,
  joinTextBlocks,
  normalizeTextInput,
  stripHtmlForText,
  type TextChunk
} from '../utils/text';
import {
  collectTextStream,
  createDownloadMonitor,
  isAbortError,
  useAbortableOperation
} from '../utils/browserAi';

export type TranslatorAvailability = Availability;
export type TranslatorProcessingState = 'availability' | 'create' | 'measure' | 'translate' | '';
export type TranslatorCreateCore = TranslatorCreateCoreOptions;
export type TranslatorCreate = Omit<TranslatorCreateOptions, 'signal' | 'monitor'>;
export type TranslatorRunNativeOptions = Omit<TranslatorTranslateOptions, 'signal'>;
export type TranslatorChunking = 'auto' | 'never';

export type TranslatorProgressPhase =
  | 'idle'
  | 'checking'
  | 'creating'
  | 'measuring'
  | 'chunking'
  | 'translating'
  | 'ready'
  | 'error';

export interface TranslatorLanguageOption {
  code: string;
  name: string;
}

export interface TranslatorProgressState {
  phase: TranslatorProgressPhase;
  inputUsage: number | null;
  inputQuota: number | null;
  processedChunks: number;
  totalChunks: number;
  currentChunk: number;
  outputLength: number;
  chunked: boolean;
  bypassed: boolean;
}

export interface TranslatorChunkResult {
  index: number;
  input: string;
  translation: string;
  usage: number | null;
  start: number;
  end: number;
}

export interface TranslatorResult {
  translation: string;
  input: string;
  sourceLanguage: string;
  targetLanguage: string;
  inputUsage: number | null;
  inputQuota: number | null;
  chunked: boolean;
  bypassed: boolean;
  chunks: TranslatorChunkResult[];
}

export interface TranslatorRunOptions extends TranslatorRunNativeOptions {
  createOptions?: TranslatorCreate;
  autoCreate?: boolean;
  stripHtml?: boolean;
  chunking?: TranslatorChunking;
  chunkBudgetRatio?: number;
  onProgress?: (state: TranslatorProgressState) => void;
}

export interface TranslatorBatchItem {
  input: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  stripHtml?: boolean;
}

export interface TranslatorBatchOptions extends Omit<TranslatorRunOptions, 'stripHtml'> {
  continueOnError?: boolean;
}

type GlobalWithTranslator = typeof globalThis & {
  Translator?: typeof Translator;
};

const DEFAULT_CHUNK_BUDGET_RATIO = 0.78;
const DEFAULT_TRANSLATOR_OPTIONS: TranslatorCreate = {
  sourceLanguage: 'en',
  targetLanguage: 'es'
};

export const TRANSLATOR_LANGUAGE_OPTIONS: TranslatorLanguageOption[] = [
  { code: 'ar', name: 'Arabic' },
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
  { code: 'iw', name: 'Hebrew' },
  { code: 'ja', name: 'Japanese' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ko', name: 'Korean' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'mr', name: 'Marathi' },
  { code: 'nl', name: 'Dutch' },
  { code: 'no', name: 'Norwegian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'sv', name: 'Swedish' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'zh-Hant', name: 'Chinese Traditional' }
];

export const getTranslatorLanguageName = (code: string) => {
  return TRANSLATOR_LANGUAGE_OPTIONS.find((item) => item.code === code)?.name ?? code;
};

const getTranslator = () => {
  return (globalThis as GlobalWithTranslator).Translator;
};

const createEmptyProgressState = (): TranslatorProgressState => ({
  phase: 'idle',
  inputUsage: null,
  inputQuota: null,
  processedChunks: 0,
  totalChunks: 0,
  currentChunk: 0,
  outputLength: 0,
  chunked: false,
  bypassed: false
});

const normalizeLanguageCode = (code: string) => {
  return code.trim();
};

const isSameLanguagePair = (options: TranslatorCreateCoreOptions) => {
  return normalizeLanguageCode(options.sourceLanguage).toLowerCase()
    === normalizeLanguageCode(options.targetLanguage).toLowerCase();
};

const normalizeTranslatorInput = (value: string, stripHtml?: boolean) => {
  return stripHtml ? stripHtmlForText(value) : normalizeTextInput(value);
};

const clampRatio = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value as number, 0.2), 0.95);
};

const getNativeTranslateOptions = (
  options: TranslatorRunOptions | TranslatorBatchOptions = {}
): TranslatorRunNativeOptions => {
  const {
    createOptions: _createOptions,
    autoCreate: _autoCreate,
    stripHtml: _stripHtml,
    chunking: _chunking,
    chunkBudgetRatio: _chunkBudgetRatio,
    onProgress: _onProgress,
    continueOnError: _continueOnError,
    ...nativeOptions
  } = options as TranslatorRunOptions & { continueOnError?: boolean };
  return nativeOptions;
};

export function useTranslator(defaultCreateOptions: TranslatorCreate = DEFAULT_TRANSLATOR_OPTIONS) {
  const translator = ref<Translator | null>(null);
  const availability = ref<Availability | null>(null);
  const createOptions = ref<TranslatorCreate>(defaultCreateOptions);
  const processing = ref<TranslatorProcessingState>('');
  const downloadProgress = ref(0);
  const inputUsage = ref<number | null>(null);
  const inputQuota = ref<number | null>(null);
  const output = ref('');
  const error = ref<unknown>(null);
  const progressState = ref<TranslatorProgressState>(createEmptyProgressState());
  const lastResult = ref<TranslatorResult | null>(null);

  const operation = useAbortableOperation();

  const isReady = computed(() => {
    return translator.value !== null && availability.value === 'available';
  });

  const isProcessing = computed(() => processing.value !== '');

  const inputQuotaAvailable = computed(() => {
    if (inputQuota.value == null || inputUsage.value == null) {
      return null;
    }

    return Math.max(inputQuota.value - inputUsage.value, 0);
  });

  const updateModelProps = (instance?: Translator | null) => {
    inputQuota.value = instance?.inputQuota ?? null;
  };

  const setProgressState = (
    patch: Partial<TranslatorProgressState>,
    onProgress?: TranslatorRunOptions['onProgress']
  ) => {
    progressState.value = {
      ...progressState.value,
      ...patch
    };
    onProgress?.({ ...progressState.value });
  };

  watch(
    translator,
    (next) => updateModelProps(next),
    { deep: true }
  );

  const checkAvailability = async (options: TranslatorCreateCoreOptions = createOptions.value) => {
    if (isSameLanguagePair(options)) {
      return 'available' as Availability;
    }

    const TranslatorConstructor = getTranslator();
    if (typeof TranslatorConstructor?.availability !== 'function') {
      return 'unavailable' as Availability;
    }

    try {
      return await TranslatorConstructor.availability(options);
    } catch {
      return 'unavailable' as Availability;
    }
  };

  const requestAvailability = async (options: TranslatorCreateCoreOptions = createOptions.value) => {
    processing.value = 'availability';
    setProgressState({ phase: 'checking' });
    try {
      availability.value = await checkAvailability(options);
      return availability.value;
    } finally {
      processing.value = '';
    }
  };

  const init = async (options: TranslatorCreateCoreOptions = createOptions.value) => {
    destroy();
    createOptions.value = options;
    const status = await requestAvailability(options);

    if (status === 'unavailable') {
      throw new Error('Translator is unavailable for the provided language pair.');
    }

    return status;
  };

  const create = async (options: TranslatorCreate = createOptions.value) => {
    if (isSameLanguagePair(options)) {
      throw new Error('Translator is not needed when source and target languages match.');
    }

    const TranslatorConstructor = getTranslator();
    if (typeof TranslatorConstructor?.create !== 'function') {
      throw new Error('Translator is not available in this browser context.');
    }

    createOptions.value = options;
    availability.value = await checkAvailability(options);
    if (availability.value === 'unavailable') {
      throw new Error('Translator is unavailable for the provided language pair.');
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
      translator.value = await TranslatorConstructor.create({
        ...options,
        signal,
        monitor
      });
      availability.value = 'available';
      downloadProgress.value = 100;
      updateModelProps(translator.value);
      return translator.value;
    } finally {
      operation.end(signal);
      processing.value = '';
    }
  };

  const destroy = () => {
    translator.value?.destroy();
    translator.value = null;
    updateModelProps(null);
  };

  const dispose = () => {
    interrupt();
    destroy();
    availability.value = null;
    createOptions.value = defaultCreateOptions;
    downloadProgress.value = 0;
    inputUsage.value = null;
    output.value = '';
    error.value = null;
    lastResult.value = null;
    progressState.value = createEmptyProgressState();
    processing.value = '';
  };

  const interrupt = () => {
    operation.interrupt();
  };

  const ensureTranslator = async (options?: TranslatorCreate, autoCreate = true) => {
    if (options) {
      if (
        translator.value
        && translator.value.sourceLanguage === options.sourceLanguage
        && translator.value.targetLanguage === options.targetLanguage
      ) {
        return translator.value;
      }

      return create(options);
    }

    if (translator.value) {
      return translator.value;
    }

    if (!autoCreate) {
      throw new Error('Translator is not initialized. Call create() first or enable autoCreate.');
    }

    return create(createOptions.value);
  };

  const measureInputUsageInternal = async (
    instance: Translator,
    input: string,
    options: TranslatorRunNativeOptions | undefined,
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
    instance: Translator,
    input: string,
    options: TranslatorRunNativeOptions | undefined,
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
    options: TranslatorRunOptions = {}
  ) => {
    const nextCreateOptions = options.createOptions ?? createOptions.value;
    if (isSameLanguagePair(nextCreateOptions)) {
      inputUsage.value = 0;
      inputQuota.value = null;
      return 0;
    }

    const instance = await ensureTranslator(options.createOptions, options.autoCreate !== false);
    const normalized = normalizeTranslatorInput(input, options.stripHtml);
    const nativeOptions = getNativeTranslateOptions(options);

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
    instance: Translator,
    nativeOptions: TranslatorRunNativeOptions,
    signal: AbortSignal,
    onProgress?: TranslatorRunOptions['onProgress']
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

  const createBypassResult = (
    input: string,
    options: TranslatorCreateCoreOptions,
    onProgress?: TranslatorRunOptions['onProgress']
  ): TranslatorResult => {
    output.value = input;
    inputUsage.value = 0;
    inputQuota.value = null;
    const result: TranslatorResult = {
      translation: input,
      input,
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      inputUsage: 0,
      inputQuota: null,
      chunked: false,
      bypassed: true,
      chunks: []
    };
    lastResult.value = result;
    setProgressState({
      phase: 'ready',
      inputUsage: 0,
      inputQuota: null,
      outputLength: input.length,
      processedChunks: 1,
      totalChunks: 1,
      currentChunk: 1,
      chunked: false,
      bypassed: true
    }, onProgress);
    return result;
  };

  const translateChunk = async (
    instance: Translator,
    chunk: TextChunk,
    nativeOptions: TranslatorRunNativeOptions,
    signal: AbortSignal
  ): Promise<TranslatorChunkResult> => {
    const usage = await measureWithSignal(instance, chunk.text, nativeOptions, signal);
    const translation = await instance.translate(chunk.text, {
      ...nativeOptions,
      signal
    });

    return {
      index: chunk.index,
      input: chunk.text,
      translation,
      usage: Number.isFinite(usage) ? usage : null,
      start: chunk.start,
      end: chunk.end
    };
  };

  const translateWithDetails = async (
    input: string,
    options: TranslatorRunOptions = {}
  ): Promise<TranslatorResult> => {
    error.value = null;
    output.value = '';
    lastResult.value = null;

    const nextCreateOptions = options.createOptions ?? createOptions.value;
    const normalized = normalizeTranslatorInput(input, options.stripHtml);
    if (isSameLanguagePair(nextCreateOptions)) {
      return createBypassResult(normalized, nextCreateOptions, options.onProgress);
    }

    const instance = await ensureTranslator(options.createOptions, options.autoCreate !== false);
    const nativeOptions = getNativeTranslateOptions(options);
    const signal = operation.begin();
    const chunkBudgetRatio = clampRatio(options.chunkBudgetRatio, DEFAULT_CHUNK_BUDGET_RATIO);
    const chunking = options.chunking ?? 'auto';

    processing.value = 'translate';

    try {
      setProgressState({
        phase: 'measuring',
        inputUsage: null,
        inputQuota: instance.inputQuota,
        processedChunks: 0,
        totalChunks: 0,
        currentChunk: 0,
        outputLength: 0,
        chunked: false,
        bypassed: false
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
          phase: 'translating',
          inputUsage: inputUsage.value,
          inputQuota: instance.inputQuota,
          totalChunks: 1,
          currentChunk: 1
        }, options.onProgress);

        const translation = await instance.translate(normalized, {
          ...nativeOptions,
          signal
        });

        output.value = translation;
        const result: TranslatorResult = {
          translation,
          input: normalized,
          sourceLanguage: instance.sourceLanguage,
          targetLanguage: instance.targetLanguage,
          inputUsage: inputUsage.value,
          inputQuota: instance.inputQuota,
          chunked: false,
          bypassed: false,
          chunks: []
        };
        lastResult.value = result;
        setProgressState({
          phase: 'ready',
          outputLength: translation.length,
          processedChunks: 1
        }, options.onProgress);
        return result;
      }

      const chunks = await buildChunks(
        normalized,
        budget,
        instance,
        nativeOptions,
        signal,
        options.onProgress
      );
      const chunkResults: TranslatorChunkResult[] = [];

      for (const chunk of chunks) {
        setProgressState({
          phase: 'translating',
          totalChunks: chunks.length,
          currentChunk: chunk.index + 1,
          processedChunks: chunkResults.length,
          chunked: true
        }, options.onProgress);

        const result = await translateChunk(instance, chunk, nativeOptions, signal);
        chunkResults.push(result);
        output.value = chunkResults
          .map((item) => item.translation.trim())
          .filter(Boolean)
          .join('\n\n');
        setProgressState({
          outputLength: output.value.length,
          processedChunks: chunkResults.length
        }, options.onProgress);
      }

      const translation = output.value;
      const result: TranslatorResult = {
        translation,
        input: normalized,
        sourceLanguage: instance.sourceLanguage,
        targetLanguage: instance.targetLanguage,
        inputUsage: inputUsage.value,
        inputQuota: instance.inputQuota,
        chunked: true,
        bypassed: false,
        chunks: chunkResults
      };
      lastResult.value = result;
      setProgressState({
        phase: 'ready',
        outputLength: translation.length,
        processedChunks: chunkResults.length,
        totalChunks: chunkResults.length
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

  const translate = async (input: string, options: TranslatorRunOptions = {}) => {
    const result = await translateWithDetails(input, options);
    return result.translation;
  };

  const translateStreaming = async (
    input: string,
    options: TranslatorRunOptions = {}
  ): Promise<ReadableStream<string>> => {
    error.value = null;
    output.value = '';
    lastResult.value = null;

    const nextCreateOptions = options.createOptions ?? createOptions.value;
    const normalized = normalizeTranslatorInput(input, options.stripHtml);
    if (isSameLanguagePair(nextCreateOptions)) {
      const result = createBypassResult(normalized, nextCreateOptions, options.onProgress);
      return new ReadableStream<string>({
        start(controller) {
          controller.enqueue(result.translation);
          controller.close();
        }
      });
    }

    const instance = await ensureTranslator(options.createOptions, options.autoCreate !== false);
    const nativeOptions = getNativeTranslateOptions(options);
    const signal = operation.begin();
    const chunkBudgetRatio = clampRatio(options.chunkBudgetRatio, DEFAULT_CHUNK_BUDGET_RATIO);
    const chunking = options.chunking ?? 'auto';
    processing.value = 'translate';

    try {
      setProgressState({
        phase: 'measuring',
        inputUsage: null,
        inputQuota: instance.inputQuota,
        processedChunks: 0,
        totalChunks: 0,
        currentChunk: 0,
        outputLength: 0,
        chunked: false,
        bypassed: false
      }, options.onProgress);
      const usage = await measureWithSignal(instance, normalized, nativeOptions, signal);
      inputUsage.value = Number.isFinite(usage) ? usage : null;
      inputQuota.value = instance.inputQuota;

      const budget = Math.floor(instance.inputQuota * chunkBudgetRatio);
      const shouldChunk = chunking !== 'never'
        && Number.isFinite(usage)
        && usage > budget
        && budget > 0;
      const chunks = shouldChunk
        ? await buildChunks(normalized, budget, instance, nativeOptions, signal, options.onProgress)
        : [{ text: normalized, index: 0, start: 0, end: normalized.length }];
      const chunkResults: TranslatorChunkResult[] = [];

      return new ReadableStream<string>({
        async start(controller) {
          try {
            for (const chunk of chunks) {
              setProgressState({
                phase: 'translating',
                totalChunks: chunks.length,
                currentChunk: chunk.index + 1,
                processedChunks: chunkResults.length,
                chunked: shouldChunk
              }, options.onProgress);

              const stream = instance.translateStreaming(chunk.text, {
                ...nativeOptions,
                signal
              });
              const reader = stream.getReader();
              let chunkTranslation = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunkTranslation += value;
                output.value += value;
                setProgressState({
                  outputLength: output.value.length
                }, options.onProgress);
                controller.enqueue(value);
              }

              chunkResults.push({
                index: chunk.index,
                input: chunk.text,
                translation: chunkTranslation,
                usage: null,
                start: chunk.start,
                end: chunk.end
              });
              setProgressState({
                processedChunks: chunkResults.length
              }, options.onProgress);

              if (shouldChunk && chunk.index < chunks.length - 1) {
                output.value = joinTextBlocks(output.value, '');
                controller.enqueue('\n\n');
              }
            }

            const result: TranslatorResult = {
              translation: output.value,
              input: normalized,
              sourceLanguage: instance.sourceLanguage,
              targetLanguage: instance.targetLanguage,
              inputUsage: inputUsage.value,
              inputQuota: instance.inputQuota,
              chunked: shouldChunk,
              bypassed: false,
              chunks: shouldChunk ? chunkResults : []
            };
            lastResult.value = result;
            setProgressState({
              phase: 'ready',
              outputLength: output.value.length,
              processedChunks: chunkResults.length,
              totalChunks: chunks.length
            }, options.onProgress);
            controller.close();
          } catch (streamError) {
            error.value = streamError;
            setProgressState({ phase: 'error' }, options.onProgress);
            controller.error(streamError);
          } finally {
            operation.end(signal);
            processing.value = '';
          }
        },
        cancel(reason) {
          operation.interrupt();
          operation.end(signal);
          processing.value = '';
          return Promise.resolve(reason);
        }
      });
    } catch (caughtError) {
      operation.end(signal);
      processing.value = '';
      error.value = caughtError;
      setProgressState({ phase: 'error' }, options.onProgress);
      throw caughtError;
    }
  };

  const translateStreamingToText = async (
    input: string,
    options: TranslatorRunOptions = {},
    onChunk?: (chunk: string, accumulated: string) => void
  ) => {
    output.value = '';
    const stream = await translateStreaming(input, options);
    const result = await collectTextStream(stream, onChunk);
    output.value = result;
    return result;
  };

  const translateMany = async (
    items: TranslatorBatchItem[],
    options: TranslatorBatchOptions = {}
  ) => {
    const results: Array<TranslatorResult | null> = [];
    const failures: unknown[] = [];
    const {
      continueOnError,
      ...runOptions
    } = options;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const baseCreateOptions = runOptions.createOptions ?? createOptions.value;
      setProgressState({
        phase: 'translating',
        currentChunk: index + 1,
        totalChunks: items.length
      }, runOptions.onProgress);

      try {
        results.push(await translateWithDetails(item.input, {
          ...runOptions,
          createOptions: {
            ...baseCreateOptions,
            sourceLanguage: item.sourceLanguage ?? baseCreateOptions.sourceLanguage,
            targetLanguage: item.targetLanguage ?? baseCreateOptions.targetLanguage
          },
          stripHtml: item.stripHtml
        }));
      } catch (caughtError) {
        failures.push(caughtError);
        results.push(null);
        if (!continueOnError) {
          throw caughtError;
        }
      }
    }

    return { results, failures };
  };

  return {
    translator: computed(() => translator.value),
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
    translate,
    translateWithDetails,
    translateStreaming,
    translateStreamingToText,
    translateMany,
    interrupt
  };
}
