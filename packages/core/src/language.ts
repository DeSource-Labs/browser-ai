import { createAbortManager, getBrowserGlobal } from './platform.js';
import { createModelController, type BrowserAiModelState } from './model.js';
import { createBrowserAiStore } from './store.js';

type WithoutLifecycle<Value> = Omit<Value, 'monitor' | 'signal'>;
type WithoutSignal<Value> = Omit<Value, 'signal'>;

export interface LanguageDetectorState extends BrowserAiModelState<LanguageDetector> {
  results: LanguageDetectionResult[];
  inputUsage: number | null;
  inputQuota: number | null;
}

export const createLanguageDetector = (defaultOptions: WithoutLifecycle<LanguageDetectorCreateOptions> = {}) => {
  const base = createModelController<
    LanguageDetectorCreateCoreOptions,
    WithoutLifecycle<LanguageDetectorCreateOptions>,
    LanguageDetectorCreateOptions,
    LanguageDetector
  >({
    getConstructor: () => getBrowserGlobal<typeof LanguageDetector>('LanguageDetector'),
    getCoreOptions: (options) => options,
    getNativeCreateOptions: (options, signal, monitor) => ({ ...options, signal, monitor }),
    defaultCreateOptions: defaultOptions,
    unsupportedMessage: 'LanguageDetector is not available in this browser context.',
    unavailableMessage: 'LanguageDetector is unavailable with the provided options.'
  });
  const state = createBrowserAiStore<LanguageDetectorState>({
    ...base.state.getSnapshot(),
    results: [],
    inputUsage: null,
    inputQuota: null
  });
  const operation = createAbortManager();
  base.state.subscribe(() =>
    state.update((current) => ({
      ...current,
      ...base.state.getSnapshot(),
      processing: operation.signal ? current.processing : base.state.getSnapshot().processing
    }))
  );

  const create = async (options?: WithoutLifecycle<LanguageDetectorCreateOptions>) => {
    operation.interrupt();
    const instance = await base.create(options);
    if (instance !== base.state.getSnapshot().instance)
      throw new DOMException('The operation was aborted.', 'AbortError');
    state.update({ inputQuota: instance.inputQuota });
    return instance;
  };
  const ensure = async (options?: WithoutLifecycle<LanguageDetectorCreateOptions>) => {
    const instance = await base.ensure(options);
    if (instance !== base.state.getSnapshot().instance)
      throw new DOMException('The operation was aborted.', 'AbortError');
    state.update({ inputQuota: instance.inputQuota });
    return instance;
  };
  const detect = async (
    input: string,
    options: WithoutSignal<LanguageDetectorDetectOptions> = {},
    createOptions?: WithoutLifecycle<LanguageDetectorCreateOptions>
  ) => {
    const signal = operation.begin();
    state.update({ processing: 'detect', error: null, results: [] });
    try {
      const instance = await ensure(createOptions);
      signal.throwIfAborted();
      const results = await instance.detect(input, { ...options, signal });
      if (operation.isCurrent(signal)) state.update({ results, inputQuota: instance.inputQuota });
      return results;
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };
  const measureInputUsage = async (
    input: string,
    options: WithoutSignal<LanguageDetectorDetectOptions> = {},
    createOptions?: WithoutLifecycle<LanguageDetectorCreateOptions>
  ) => {
    const signal = operation.begin();
    state.update({ processing: 'measure', error: null });
    try {
      const instance = await ensure(createOptions);
      signal.throwIfAborted();
      const inputUsage = await instance.measureInputUsage(input, { ...options, signal });
      if (operation.isCurrent(signal)) state.update({ inputUsage, inputQuota: instance.inputQuota });
      return inputUsage;
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };
  const interrupt = (reason?: unknown) => {
    operation.interrupt(reason);
    base.interrupt(reason);
    state.update({ processing: '' });
  };
  const destroy = () => {
    operation.interrupt();
    base.destroy();
    state.update({ instance: null, processing: '', inputUsage: null, inputQuota: null });
  };
  const dispose = () => {
    interrupt();
    base.dispose();
    state.update({ ...base.state.getSnapshot(), results: [], inputUsage: null, inputQuota: null });
  };

  return {
    ...base,
    state,
    create,
    ensure,
    detect,
    measureInputUsage,
    destroy,
    interrupt,
    dispose
  };
};

export interface ProofreaderState extends BrowserAiModelState<Proofreader> {
  result: ProofreadResult | null;
}

export const createProofreader = (defaultOptions: WithoutLifecycle<ProofreaderCreateOptions> = {}) => {
  const base = createModelController<
    ProofreaderCreateCoreOptions,
    WithoutLifecycle<ProofreaderCreateOptions>,
    ProofreaderCreateOptions,
    Proofreader
  >({
    getConstructor: () => getBrowserGlobal<typeof Proofreader>('Proofreader'),
    getCoreOptions: (options) => options,
    getNativeCreateOptions: (options, signal, monitor) => ({ ...options, signal, monitor }),
    defaultCreateOptions: defaultOptions,
    unsupportedMessage: 'Proofreader is not available in this browser context.',
    unavailableMessage: 'Proofreader is unavailable with the provided options.'
  });
  const state = createBrowserAiStore<ProofreaderState>({ ...base.state.getSnapshot(), result: null });
  const operation = createAbortManager();
  base.state.subscribe(() =>
    state.update((current) => ({
      ...current,
      ...base.state.getSnapshot(),
      processing: operation.signal ? current.processing : base.state.getSnapshot().processing
    }))
  );

  const create = async (options?: WithoutLifecycle<ProofreaderCreateOptions>) => {
    operation.interrupt();
    const instance = await base.create(options);
    if (instance !== base.state.getSnapshot().instance)
      throw new DOMException('The operation was aborted.', 'AbortError');
    return instance;
  };
  const ensure = async (options?: WithoutLifecycle<ProofreaderCreateOptions>) => {
    const instance = await base.ensure(options);
    if (instance !== base.state.getSnapshot().instance)
      throw new DOMException('The operation was aborted.', 'AbortError');
    return instance;
  };
  const proofread = async (
    input: string,
    options: WithoutSignal<ProofreaderProofreadOptions> = {},
    createOptions?: WithoutLifecycle<ProofreaderCreateOptions>
  ) => {
    const signal = operation.begin();
    state.update({ processing: 'proofread', error: null, result: null });
    try {
      const instance = await ensure(createOptions);
      signal.throwIfAborted();
      const result = await instance.proofread(input, { ...options, signal });
      if (operation.isCurrent(signal)) state.update({ result });
      return result;
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };
  const interrupt = (reason?: unknown) => {
    operation.interrupt(reason);
    base.interrupt(reason);
    state.update({ processing: '' });
  };
  const destroy = () => {
    operation.interrupt();
    base.destroy();
    state.update({ instance: null, processing: '', result: null });
  };
  const dispose = () => {
    interrupt();
    base.dispose();
    state.update({ ...base.state.getSnapshot(), result: null });
  };

  return { ...base, state, create, ensure, proofread, destroy, interrupt, dispose };
};
