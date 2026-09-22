import { collectTextStream, observeTextStream, createAbortManager, getBrowserGlobal } from './platform.js';
import { createModelController, type BrowserAiModelState } from './model.js';
import { createBrowserAiStore, type BrowserAiStore } from './store.js';

export interface TextTaskState<Instance> extends BrowserAiModelState<Instance> {
  output: string;
  inputUsage: number | null;
  inputQuota: number | null;
}

interface TextTaskInstance<RunOptions> extends DestroyableModel {
  inputQuota: number;
  measureInputUsage(input: string, options?: RunOptions & { signal?: AbortSignal }): Promise<number>;
}

interface TextTaskConstructor<CoreOptions, NativeCreateOptions, Instance> {
  availability(options?: CoreOptions): Promise<Availability>;
  create(options?: NativeCreateOptions): Promise<Instance>;
}

export interface TextTaskController<CoreOptions, CreateOptions, RunOptions, Instance> {
  readonly state: BrowserAiStore<TextTaskState<Instance>>;
  checkAvailability(options?: CoreOptions): Promise<Availability>;
  requestAvailability(options?: CoreOptions): Promise<Availability>;
  init(options?: CoreOptions): Promise<Availability>;
  create(options?: CreateOptions): Promise<Instance>;
  ensure(options?: CreateOptions): Promise<Instance>;
  configure(options: CreateOptions): void;
  measureInputUsage(input: string, options?: RunOptions, createOptions?: CreateOptions): Promise<number>;
  run(input: string, options?: RunOptions, createOptions?: CreateOptions): Promise<string>;
  runStreaming(input: string, options?: RunOptions, createOptions?: CreateOptions): Promise<ReadableStream<string>>;
  runStreamingToText(
    input: string,
    options?: RunOptions,
    onChunk?: (chunk: string, accumulated: string) => void,
    createOptions?: CreateOptions
  ): Promise<string>;
  destroy(): void;
  dispose(): void;
  interrupt(reason?: unknown): void;
}

interface CreateTextTaskControllerOptions<CoreOptions, CreateOptions, NativeCreateOptions, RunOptions, Instance> {
  globalName: string;
  defaultCreateOptions: CreateOptions;
  getCoreOptions(options: CreateOptions): CoreOptions;
  getNativeCreateOptions(
    options: CreateOptions,
    signal: AbortSignal,
    monitor: CreateMonitorCallback
  ): NativeCreateOptions;
  run(instance: Instance, input: string, options: RunOptions & { signal: AbortSignal }): Promise<string>;
  runStreaming(
    instance: Instance,
    input: string,
    options: RunOptions & { signal: AbortSignal }
  ): ReadableStream<string>;
  operation: string;
}

const createTextTaskController = <
  CoreOptions,
  CreateOptions,
  NativeCreateOptions,
  RunOptions extends object,
  Instance extends TextTaskInstance<RunOptions>
>(
  config: CreateTextTaskControllerOptions<CoreOptions, CreateOptions, NativeCreateOptions, RunOptions, Instance>
): TextTaskController<CoreOptions, CreateOptions, RunOptions, Instance> => {
  const constructor = () =>
    getBrowserGlobal<TextTaskConstructor<CoreOptions, NativeCreateOptions, Instance>>(config.globalName);
  const base = createModelController({
    getConstructor: constructor,
    getCoreOptions: config.getCoreOptions,
    getNativeCreateOptions: config.getNativeCreateOptions,
    defaultCreateOptions: config.defaultCreateOptions,
    unsupportedMessage: `${config.globalName} is not available in this browser context.`,
    unavailableMessage: `${config.globalName} is unavailable with the provided options.`
  });
  const state = createBrowserAiStore<TextTaskState<Instance>>({
    ...base.state.getSnapshot(),
    output: '',
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

  const create = async (options?: CreateOptions) => {
    operation.interrupt();
    const instance = await base.create(options);
    state.update({ inputQuota: instance.inputQuota });
    return instance;
  };
  const ensure = async (options?: CreateOptions) => {
    const instance = await base.ensure(options);
    if (instance !== base.state.getSnapshot().instance)
      throw new DOMException('The operation was aborted.', 'AbortError');
    state.update({ inputQuota: instance.inputQuota });
    return instance;
  };

  const measureInputUsage = async (input: string, options = {} as RunOptions, createOptions?: CreateOptions) => {
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

  const run = async (input: string, options = {} as RunOptions, createOptions?: CreateOptions) => {
    const signal = operation.begin();
    state.update({ processing: config.operation, output: '', error: null });
    try {
      const instance = await ensure(createOptions);
      signal.throwIfAborted();
      const output = await config.run(instance, input, { ...options, signal });
      if (operation.isCurrent(signal)) state.update({ output, inputQuota: instance.inputQuota });
      return output;
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };

  const runStreaming = async (input: string, options = {} as RunOptions, createOptions?: CreateOptions) => {
    const signal = operation.begin();
    state.update({ processing: config.operation, output: '', error: null });
    let stream: ReadableStream<string>;
    let instance: Instance;
    try {
      instance = await ensure(createOptions);
      signal.throwIfAborted();
      stream = config.runStreaming(instance, input, { ...options, signal });
    } catch (error) {
      if (operation.end(signal)) state.update({ processing: '', error });
      throw error;
    }
    return observeTextStream(stream, signal, {
      onChunk: (output) => {
        if (operation.isCurrent(signal)) state.update({ output });
      },
      onComplete: () => {
        if (operation.isCurrent(signal)) state.update({ inputQuota: instance.inputQuota });
      },
      onError: (error) => {
        if (operation.isCurrent(signal) && !signal.aborted) state.update({ error });
      },
      onFinally: () => {
        if (operation.end(signal)) state.update({ processing: '' });
      }
    });
  };

  const runStreamingToText = async (
    input: string,
    options = {} as RunOptions,
    onChunk?: (chunk: string, accumulated: string) => void,
    createOptions?: CreateOptions
  ) => collectTextStream(await runStreaming(input, options, createOptions), onChunk);

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
    state.update({ ...base.state.getSnapshot(), output: '', inputUsage: null, inputQuota: null });
  };

  return {
    state,
    checkAvailability: base.checkAvailability,
    requestAvailability: base.requestAvailability,
    init: base.init,
    create,
    ensure,
    configure: base.configure,
    measureInputUsage,
    run,
    runStreaming,
    runStreamingToText,
    destroy,
    dispose,
    interrupt
  };
};

type WithoutLifecycle<Value> = Omit<Value, 'monitor' | 'signal'>;
type WithoutSignal<Value> = Omit<Value, 'signal'>;

const lifecycleOptions = <Options extends object>(
  options: Options,
  signal: AbortSignal,
  monitor: CreateMonitorCallback
) => ({ ...options, signal, monitor });

export const createSummarizer = (defaultOptions: WithoutLifecycle<SummarizerCreateOptions> = {}) => {
  const task = createTextTaskController<
    SummarizerCreateCoreOptions,
    WithoutLifecycle<SummarizerCreateOptions>,
    SummarizerCreateOptions,
    WithoutSignal<SummarizerSummarizeOptions>,
    Summarizer
  >({
    globalName: 'Summarizer',
    defaultCreateOptions: defaultOptions,
    getCoreOptions: ({ sharedContext: _sharedContext, ...options }) => options,
    getNativeCreateOptions: lifecycleOptions,
    run: (instance, input, options) => instance.summarize(input, options),
    runStreaming: (instance, input, options) => instance.summarizeStreaming(input, options),
    operation: 'summarize'
  });
  return {
    ...task,
    summarize: task.run,
    summarizeStreaming: task.runStreaming,
    summarizeStreamingToText: task.runStreamingToText
  };
};

export const createWriter = (defaultOptions: WithoutLifecycle<WriterCreateOptions> = {}) => {
  const task = createTextTaskController<
    WriterCreateCoreOptions,
    WithoutLifecycle<WriterCreateOptions>,
    WriterCreateOptions,
    WithoutSignal<WriterWriteOptions>,
    Writer
  >({
    globalName: 'Writer',
    defaultCreateOptions: defaultOptions,
    getCoreOptions: ({ sharedContext: _sharedContext, ...options }) => options,
    getNativeCreateOptions: lifecycleOptions,
    run: (instance, input, options) => instance.write(input, options),
    runStreaming: (instance, input, options) => instance.writeStreaming(input, options),
    operation: 'write'
  });
  return {
    ...task,
    write: task.run,
    writeStreaming: task.runStreaming,
    writeStreamingToText: task.runStreamingToText
  };
};

export const createRewriter = (defaultOptions: WithoutLifecycle<RewriterCreateOptions> = {}) => {
  const task = createTextTaskController<
    RewriterCreateCoreOptions,
    WithoutLifecycle<RewriterCreateOptions>,
    RewriterCreateOptions,
    WithoutSignal<RewriterRewriteOptions>,
    Rewriter
  >({
    globalName: 'Rewriter',
    defaultCreateOptions: defaultOptions,
    getCoreOptions: ({ sharedContext: _sharedContext, ...options }) => options,
    getNativeCreateOptions: lifecycleOptions,
    run: (instance, input, options) => instance.rewrite(input, options),
    runStreaming: (instance, input, options) => instance.rewriteStreaming(input, options),
    operation: 'rewrite'
  });
  return {
    ...task,
    rewrite: task.run,
    rewriteStreaming: task.runStreaming,
    rewriteStreamingToText: task.runStreamingToText
  };
};

export const createTranslator = (defaultOptions: WithoutLifecycle<TranslatorCreateOptions>) => {
  const task = createTextTaskController<
    TranslatorCreateCoreOptions,
    WithoutLifecycle<TranslatorCreateOptions>,
    TranslatorCreateOptions,
    WithoutSignal<TranslatorTranslateOptions>,
    Translator
  >({
    globalName: 'Translator',
    defaultCreateOptions: defaultOptions,
    getCoreOptions: (options) => options,
    getNativeCreateOptions: lifecycleOptions,
    run: (instance, input, options) => instance.translate(input, options),
    runStreaming: (instance, input, options) => instance.translateStreaming(input, options),
    operation: 'translate'
  });
  return {
    ...task,
    translate: task.run,
    translateStreaming: task.runStreaming,
    translateStreamingToText: task.runStreamingToText
  };
};
