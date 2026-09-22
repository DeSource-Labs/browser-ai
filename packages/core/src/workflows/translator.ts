import { createBrowserAiStore } from '../store.js';
import { equalOptions } from '../model.js';
import { projectWorkflow } from './state.js';
import { createWorkflowSession } from './lifecycle.js';
import { buildMeasuredTextChunks, normalizeTextInput, stripHtmlForText } from '../text.js';
import { collectTextStream, createDownloadMonitor, isAbortError, createAbortManager } from '../platform.js';
export type TranslatorAvailability = Availability;
export type TranslatorProcessingState = 'availability' | 'create' | 'measure' | 'translate' | '';
export type TranslatorCreateCore = TranslatorCreateCoreOptions;
export type TranslatorCreate = Omit<TranslatorCreateOptions, 'signal' | 'monitor'>;
export type TranslatorRunNativeOptions = Omit<TranslatorTranslateOptions, 'signal'>;
export type TranslatorChunking = 'auto' | 'never';
export type TranslatorProgressPhase =
  'idle' | 'checking' | 'creating' | 'measuring' | 'chunking' | 'translating' | 'ready' | 'error';
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
  return (
    normalizeLanguageCode(options.sourceLanguage).toLowerCase() ===
    normalizeLanguageCode(options.targetLanguage).toLowerCase()
  );
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
  } = options as TranslatorRunOptions & {
    continueOnError?: boolean;
  };
  return nativeOptions;
};
export function createTranslatorWorkflow(defaultCreateOptions: TranslatorCreate = DEFAULT_TRANSLATOR_OPTIONS) {
  let current = {
    translator: null as Translator | null,
    availability: null as Availability | null,
    createOptions: { ...defaultCreateOptions },
    processing: '' as TranslatorProcessingState,
    downloadProgress: 0,
    inputUsage: null as number | null,
    inputQuota: null as number | null,
    output: '',
    error: null as unknown,
    progressState: createEmptyProgressState(),
    lastResult: null as TranslatorResult | null
  };
  const store = createBrowserAiStore(current);
  const update = (patch: Partial<typeof current>) => {
    current = { ...current, ...patch };
    store.update(() => current);
  };
  const operation = createAbortManager();
  let activeCreateOptions: TranslatorCreate | null = null;
  const assertCurrent = (signal: AbortSignal) => {
    signal.throwIfAborted();
    if (!operation.isCurrent(signal)) throw new DOMException('Translation was interrupted.', 'AbortError');
  };
  const publish = (signal: AbortSignal, patch: Partial<typeof current>) => {
    assertCurrent(signal);
    update(patch);
    assertCurrent(signal);
  };
  const begin = (processing: TranslatorProcessingState) => {
    const signal = operation.begin();
    publish(signal, { processing, error: null });
    return signal;
  };
  const finish = (signal: AbortSignal) => {
    if (operation.end(signal)) update({ processing: '' });
  };
  const setProgressState = (
    signal: AbortSignal,
    patch: Partial<TranslatorProgressState>,
    onProgress?: TranslatorRunOptions['onProgress']
  ) => {
    publish(signal, { progressState: { ...current.progressState, ...patch } });
    onProgress?.({ ...current.progressState });
    assertCurrent(signal);
  };
  const recordError = (signal: AbortSignal, error: unknown, onProgress?: TranslatorRunOptions['onProgress']) => {
    if (!operation.isCurrent(signal) || signal.aborted) return;
    publish(signal, { error });
    setProgressState(signal, { phase: 'error' }, onProgress);
  };
  const checkAvailability = async (options: TranslatorCreateCoreOptions = current.createOptions) => {
    if (isSameLanguagePair(options)) return 'available' as Availability;
    const constructor = getTranslator();
    if (typeof constructor?.availability !== 'function') return 'unavailable' as Availability;
    try {
      return await constructor.availability(options);
    } catch {
      return 'unavailable' as Availability;
    }
  };
  const checkForOperation = async (options: TranslatorCreateCoreOptions, signal: AbortSignal) => {
    const availability = await checkAvailability(options);
    publish(signal, { availability });
    return availability;
  };
  const requestAvailability = async (options: TranslatorCreateCoreOptions = current.createOptions) => {
    const signal = begin('availability');
    try {
      setProgressState(signal, { phase: 'checking' });
      return await checkForOperation(options, signal);
    } finally {
      finish(signal);
    }
  };
  const destroyModel = () => {
    const instance = current.translator;
    activeCreateOptions = null;
    update({ translator: null, inputQuota: null });
    instance?.destroy();
  };
  const interrupt = () => {
    operation.interrupt();
    update({ processing: '' });
  };
  const destroy = () => {
    interrupt();
    destroyModel();
  };
  const dispose = () => {
    destroy();
    update({
      availability: null,
      createOptions: { ...defaultCreateOptions },
      downloadProgress: 0,
      inputUsage: null,
      output: '',
      error: null,
      lastResult: null,
      progressState: createEmptyProgressState(),
      processing: ''
    });
  };
  const init = async (options: TranslatorCreateCoreOptions = current.createOptions) => {
    const signal = begin('availability');
    try {
      destroyModel();
      publish(signal, { createOptions: { ...options } });
      setProgressState(signal, { phase: 'checking' });
      const status = await checkForOperation(options, signal);
      if (status === 'unavailable') throw new Error('Translator is unavailable for the provided language pair.');
      return status;
    } finally {
      finish(signal);
    }
  };
  const createForOperation = async (options: TranslatorCreate, signal: AbortSignal) => {
    assertCurrent(signal);
    if (isSameLanguagePair(options))
      throw new Error('Translator is not needed when source and target languages match.');
    const constructor = getTranslator();
    if (typeof constructor?.create !== 'function')
      throw new Error('Translator is not available in this browser context.');
    const nextOptions = { ...options };
    publish(signal, { createOptions: nextOptions, processing: 'create', downloadProgress: 0 });
    setProgressState(signal, { phase: 'checking' });
    const availability = await checkForOperation(nextOptions, signal);
    if (availability === 'unavailable') throw new Error('Translator is unavailable for the provided language pair.');
    setProgressState(signal, { phase: 'creating' });
    const monitor = createDownloadMonitor((downloadProgress) => {
      if (operation.isCurrent(signal) && !signal.aborted) update({ downloadProgress });
    });
    const instance = await createWorkflowSession(signal, (creationSignal) =>
      constructor.create({ ...nextOptions, signal: creationSignal, monitor })
    );
    if (!operation.isCurrent(signal) || signal.aborted) {
      instance.destroy();
      assertCurrent(signal);
    }
    const previous = current.translator;
    activeCreateOptions = nextOptions;
    previous?.destroy();
    publish(signal, {
      translator: instance,
      availability: 'available',
      downloadProgress: 100,
      inputQuota: instance.inputQuota
    });
    assertCurrent(signal);
    return instance;
  };
  const create = async (options: TranslatorCreate = current.createOptions) => {
    const signal = begin('create');
    try {
      return await createForOperation(options, signal);
    } finally {
      finish(signal);
    }
  };
  const ensureTranslator = async (signal: AbortSignal, options?: TranslatorCreate, autoCreate = true) => {
    assertCurrent(signal);
    const nextOptions = options ?? current.createOptions;
    if (current.translator && equalOptions(activeCreateOptions, nextOptions)) return current.translator;
    if (!autoCreate && !options)
      throw new Error('Translator is not initialized. Call create() first or enable autoCreate.');
    return createForOperation(nextOptions, signal);
  };
  const measureInputUsageInternal = async (
    instance: Translator,
    input: string,
    options: TranslatorRunNativeOptions | undefined,
    signal: AbortSignal
  ) => {
    assertCurrent(signal);
    const usage = await instance.measureInputUsage(input, { ...options, signal });
    publish(signal, { inputUsage: usage });
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
    } catch (error) {
      assertCurrent(signal);
      if (isAbortError(error)) throw error;
      return Number.POSITIVE_INFINITY;
    }
  };
  const measureInputUsage = async (input: string, options: TranslatorRunOptions = {}) => {
    const signal = begin('measure');
    try {
      if (isSameLanguagePair(options.createOptions ?? current.createOptions)) {
        publish(signal, { inputUsage: 0, inputQuota: null });
        return 0;
      }
      const instance = await ensureTranslator(signal, options.createOptions, options.autoCreate !== false);
      publish(signal, { processing: 'measure' });
      setProgressState(signal, { phase: 'measuring', inputQuota: instance.inputQuota }, options.onProgress);
      const usage = await measureInputUsageInternal(
        instance,
        normalizeTranslatorInput(input, options.stripHtml),
        getNativeTranslateOptions(options),
        signal
      );
      setProgressState(signal, { inputUsage: usage, inputQuota: instance.inputQuota }, options.onProgress);
      return usage;
    } finally {
      finish(signal);
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
    const chunks = await buildMeasuredTextChunks({
      input,
      budget,
      measure: (candidate) => measureWithSignal(instance, candidate, nativeOptions, signal),
      onProgress: (chunks) =>
        setProgressState(
          signal,
          {
            phase: 'chunking',
            processedChunks: chunks.length,
            totalChunks: Math.max(chunks.length + 1, 1),
            chunked: true
          },
          onProgress
        )
    });
    assertCurrent(signal);
    return chunks;
  };
  const createBypassResult = (
    signal: AbortSignal,
    input: string,
    options: TranslatorCreateCoreOptions,
    onProgress?: TranslatorRunOptions['onProgress']
  ): TranslatorResult => {
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
    publish(signal, { output: input, inputUsage: 0, inputQuota: null, lastResult: result });
    setProgressState(
      signal,
      {
        phase: 'ready',
        inputUsage: 0,
        inputQuota: null,
        outputLength: input.length,
        processedChunks: 1,
        totalChunks: 1,
        currentChunk: 1,
        chunked: false,
        bypassed: true
      },
      onProgress
    );
    return result;
  };
  const prepareTranslation = async (signal: AbortSignal, input: string, options: TranslatorRunOptions) => {
    const instance = await ensureTranslator(signal, options.createOptions, options.autoCreate !== false);
    publish(signal, { processing: 'translate' });
    setProgressState(
      signal,
      {
        phase: 'measuring',
        inputUsage: null,
        inputQuota: instance.inputQuota,
        processedChunks: 0,
        totalChunks: 0,
        currentChunk: 0,
        outputLength: 0,
        chunked: false,
        bypassed: false
      },
      options.onProgress
    );
    const nativeOptions = getNativeTranslateOptions(options);
    const usage = await measureWithSignal(instance, input, nativeOptions, signal);
    publish(signal, { inputUsage: Number.isFinite(usage) ? usage : null, inputQuota: instance.inputQuota });
    const budget = Math.floor(instance.inputQuota * clampRatio(options.chunkBudgetRatio, DEFAULT_CHUNK_BUDGET_RATIO));
    const chunked = options.chunking !== 'never' && Number.isFinite(usage) && usage > budget && budget > 0;
    const chunks = chunked
      ? await buildChunks(input, budget, instance, nativeOptions, signal, options.onProgress)
      : [{ text: input, index: 0, start: 0, end: input.length }];
    assertCurrent(signal);
    return { instance, nativeOptions, chunked, chunks, inputUsage: Number.isFinite(usage) ? usage : null };
  };
  const translateForOperation = async (
    signal: AbortSignal,
    input: string,
    options: TranslatorRunOptions
  ): Promise<TranslatorResult> => {
    publish(signal, { error: null, output: '', lastResult: null, processing: 'translate' });
    const nextOptions = options.createOptions ?? current.createOptions;
    const normalized = normalizeTranslatorInput(input, options.stripHtml);
    if (isSameLanguagePair(nextOptions)) return createBypassResult(signal, normalized, nextOptions, options.onProgress);
    const { instance, nativeOptions, chunked, chunks, inputUsage } = await prepareTranslation(
      signal,
      normalized,
      options
    );
    const chunkResults: TranslatorChunkResult[] = [];
    let translation = '';
    for (const chunk of chunks) {
      setProgressState(
        signal,
        {
          phase: 'translating',
          totalChunks: chunks.length,
          currentChunk: chunk.index + 1,
          processedChunks: chunkResults.length,
          chunked
        },
        options.onProgress
      );
      const usage = chunked ? await measureWithSignal(instance, chunk.text, nativeOptions, signal) : inputUsage;
      assertCurrent(signal);
      const translated = await instance.translate(chunk.text, { ...nativeOptions, signal });
      assertCurrent(signal);
      chunkResults.push({
        index: chunk.index,
        input: chunk.text,
        translation: translated,
        usage: usage !== null && Number.isFinite(usage) ? usage : null,
        start: chunk.start,
        end: chunk.end
      });
      translation = chunked
        ? chunkResults
            .map((item) => item.translation.trim())
            .filter(Boolean)
            .join('\n\n')
        : translated;
      publish(signal, { output: translation });
      setProgressState(
        signal,
        { outputLength: translation.length, processedChunks: chunkResults.length },
        options.onProgress
      );
    }
    const result: TranslatorResult = {
      translation,
      input: normalized,
      sourceLanguage: instance.sourceLanguage,
      targetLanguage: instance.targetLanguage,
      inputUsage,
      inputQuota: instance.inputQuota,
      chunked,
      bypassed: false,
      chunks: chunked ? chunkResults : []
    };
    publish(signal, { lastResult: result });
    setProgressState(
      signal,
      { phase: 'ready', outputLength: translation.length, processedChunks: chunks.length, totalChunks: chunks.length },
      options.onProgress
    );
    return result;
  };
  const translateWithDetails = async (input: string, options: TranslatorRunOptions = {}): Promise<TranslatorResult> => {
    const signal = begin('translate');
    try {
      return await translateForOperation(signal, input, options);
    } catch (error) {
      recordError(signal, error, options.onProgress);
      throw error;
    } finally {
      finish(signal);
    }
  };
  const translate = async (input: string, options: TranslatorRunOptions = {}) =>
    (await translateWithDetails(input, options)).translation;
  const translateStreaming = async (
    input: string,
    options: TranslatorRunOptions = {}
  ): Promise<ReadableStream<string>> => {
    const signal = begin('translate');
    try {
      publish(signal, { output: '', lastResult: null });
      const nextOptions = options.createOptions ?? current.createOptions;
      const normalized = normalizeTranslatorInput(input, options.stripHtml);
      if (isSameLanguagePair(nextOptions)) {
        const result = createBypassResult(signal, normalized, nextOptions, options.onProgress);
        finish(signal);
        return new ReadableStream<string>({
          start(controller) {
            controller.enqueue(result.translation);
            controller.close();
          }
        });
      }
      const { instance, nativeOptions, chunked, chunks, inputUsage } = await prepareTranslation(
        signal,
        normalized,
        options
      );
      const chunkResults: TranslatorChunkResult[] = [];
      let reader: ReadableStreamDefaultReader<string> | null = null;
      let chunkIndex = 0;
      let chunkTranslation = '';
      let translation = '';
      let closed = false;
      let streamController: ReadableStreamDefaultController<string>;
      const releaseReader = async (reason?: unknown) => {
        const active = reader;
        reader = null;
        if (!active) return;
        try {
          await active.cancel(reason);
        } finally {
          active.releaseLock();
        }
      };
      const closeOperation = () => {
        signal.removeEventListener('abort', onAbort);
        finish(signal);
      };
      const onAbort = () => {
        if (closed) return;
        closed = true;
        streamController.error(signal.reason);
        void releaseReader(signal.reason).catch(() => undefined);
        closeOperation();
      };
      return new ReadableStream<string>({
        start(controller) {
          streamController = controller;
          signal.addEventListener('abort', onAbort, { once: true });
        },
        async pull(controller) {
          if (closed) return;
          try {
            assertCurrent(signal);
            while (chunkIndex < chunks.length) {
              const chunk = chunks[chunkIndex];
              if (!reader) {
                setProgressState(
                  signal,
                  {
                    phase: 'translating',
                    totalChunks: chunks.length,
                    currentChunk: chunk.index + 1,
                    processedChunks: chunkResults.length,
                    chunked
                  },
                  options.onProgress
                );
                reader = instance.translateStreaming(chunk.text, { ...nativeOptions, signal }).getReader();
                assertCurrent(signal);
                chunkTranslation = '';
              }
              const active = reader;
              const { done, value } = await active.read();
              assertCurrent(signal);
              if (!done) {
                chunkTranslation += value;
                translation += value;
                publish(signal, { output: translation });
                setProgressState(signal, { outputLength: translation.length }, options.onProgress);
                controller.enqueue(value);
                return;
              }
              active.releaseLock();
              reader = null;
              chunkResults.push({
                index: chunk.index,
                input: chunk.text,
                translation: chunkTranslation,
                usage: null,
                start: chunk.start,
                end: chunk.end
              });
              chunkIndex += 1;
              setProgressState(signal, { processedChunks: chunkResults.length }, options.onProgress);
              if (chunked && chunkIndex < chunks.length) {
                translation += '\n\n';
                publish(signal, { output: translation });
                controller.enqueue('\n\n');
                return;
              }
            }
            const result: TranslatorResult = {
              translation,
              input: normalized,
              sourceLanguage: instance.sourceLanguage,
              targetLanguage: instance.targetLanguage,
              inputUsage,
              inputQuota: instance.inputQuota,
              chunked,
              bypassed: false,
              chunks: chunked ? chunkResults : []
            };
            publish(signal, { lastResult: result });
            setProgressState(
              signal,
              {
                phase: 'ready',
                outputLength: translation.length,
                processedChunks: chunks.length,
                totalChunks: chunks.length
              },
              options.onProgress
            );
            closed = true;
            controller.close();
            closeOperation();
          } catch (error) {
            try {
              if (!closed) {
                closed = true;
                try {
                  recordError(signal, error, options.onProgress);
                } finally {
                  controller.error(error);
                }
              }
            } finally {
              closeOperation();
              await releaseReader(error).catch(() => undefined);
            }
          }
        },
        async cancel(reason) {
          closed = true;
          signal.removeEventListener('abort', onAbort);
          if (operation.isCurrent(signal)) interrupt();
          await releaseReader(reason);
        }
      });
    } catch (error) {
      try {
        recordError(signal, error, options.onProgress);
      } finally {
        finish(signal);
      }
      throw error;
    }
  };
  const translateStreamingToText = async (
    input: string,
    options: TranslatorRunOptions = {},
    onChunk?: (chunk: string, accumulated: string) => void
  ) => collectTextStream(await translateStreaming(input, options), onChunk);
  const translateMany = async (items: TranslatorBatchItem[], options: TranslatorBatchOptions = {}) => {
    const signal = begin('translate');
    const results: Array<TranslatorResult | null> = [];
    const failures: unknown[] = [];
    const { continueOnError, ...runOptions } = options;
    try {
      for (let index = 0; index < items.length; index += 1) {
        assertCurrent(signal);
        const item = items[index];
        const baseOptions = runOptions.createOptions ?? current.createOptions;
        setProgressState(
          signal,
          { phase: 'translating', currentChunk: index + 1, totalChunks: items.length },
          runOptions.onProgress
        );
        try {
          results.push(
            await translateForOperation(signal, item.input, {
              ...runOptions,
              createOptions: {
                ...baseOptions,
                sourceLanguage: item.sourceLanguage ?? baseOptions.sourceLanguage,
                targetLanguage: item.targetLanguage ?? baseOptions.targetLanguage
              },
              stripHtml: item.stripHtml
            })
          );
        } catch (error) {
          assertCurrent(signal);
          recordError(signal, error, options.onProgress);
          failures.push(error);
          results.push(null);
          if (!continueOnError || isAbortError(error)) throw error;
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
      ...current,
      inputQuotaAvailable:
        current.inputQuota == null || current.inputUsage == null
          ? null
          : Math.max(current.inputQuota - current.inputUsage, 0),
      isReady: current.translator !== null && current.availability === 'available',
      isProcessing: current.processing !== ''
    }),
    {
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
    }
  );
}
