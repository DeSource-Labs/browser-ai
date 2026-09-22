import { buildPrompt, mergeExpectedInputs, type BrowserAiAttachment, type BuildPromptOptions } from './attachments.js';
import { createModelController, type BrowserAiModelState } from './model.js';
import { collectTextStream, observeTextStream, createAbortManager, getBrowserGlobal } from './platform.js';
import { createBrowserAiStore } from './store.js';

type WithoutLifecycle<Value> = Omit<Value, 'monitor' | 'signal'>;
type WithoutSignal<Value> = Omit<Value, 'signal'>;

export interface PromptState extends BrowserAiModelState<LanguageModel> {
  output: string;
  contextUsage: number | null;
  contextWindow: number | null;
  contextOverflowCount: number;
  lastContextOverflowAt: number | null;
}

export interface PromptWithAttachmentsOptions extends BuildPromptOptions {
  prompt?: WithoutSignal<LanguageModelPromptOptions>;
}

export interface PromptHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const withPromptHistory = (
  options: WithoutLifecycle<LanguageModelCreateOptions>,
  history: readonly PromptHistoryMessage[]
): WithoutLifecycle<LanguageModelCreateOptions> => {
  if (history.length === 0) return options;
  return {
    ...options,
    initialPrompts: [
      ...(options.initialPrompts ?? []),
      ...history.map(({ role, content }) => ({ role, content }) satisfies LanguageModelMessage)
    ]
  };
};

const getCoreOptions = (options: WithoutLifecycle<LanguageModelCreateOptions>): LanguageModelCreateCoreOptions => {
  const common = {
    expectedInputs: options.expectedInputs,
    expectedOutputs: options.expectedOutputs,
    tools: options.tools
  };
  if (options.samplingMode !== undefined) return { ...common, samplingMode: options.samplingMode };
  return { ...common, topK: options.topK, temperature: options.temperature };
};

const getNativeCreateOptions = (
  options: WithoutLifecycle<LanguageModelCreateOptions>,
  signal: AbortSignal,
  monitor: CreateMonitorCallback
): LanguageModelCreateOptions => ({
  ...getCoreOptions(options),
  initialPrompts: options.initialPrompts,
  signal,
  monitor
});

export const createPromptApi = (defaultOptions: WithoutLifecycle<LanguageModelCreateOptions> = {}) => {
  const base = createModelController<
    LanguageModelCreateCoreOptions,
    WithoutLifecycle<LanguageModelCreateOptions>,
    LanguageModelCreateOptions,
    LanguageModel
  >({
    getConstructor: () => getBrowserGlobal<typeof LanguageModel>('LanguageModel'),
    getCoreOptions,
    getNativeCreateOptions,
    defaultCreateOptions: defaultOptions,
    getSessionOptions: (options) => ({
      ...getCoreOptions(options),
      expectedInputs: options.expectedInputs ?? [{ type: 'text' }]
    }),
    unsupportedMessage: 'LanguageModel is not available in this browser context.',
    unavailableMessage: 'LanguageModel is unavailable with the provided options.'
  });
  const state = createBrowserAiStore<PromptState>({
    ...base.state.getSnapshot(),
    output: '',
    contextUsage: null,
    contextWindow: null,
    contextOverflowCount: 0,
    lastContextOverflowAt: null
  });
  const operation = createAbortManager();
  base.state.subscribe(() =>
    state.update((current) => ({
      ...current,
      ...base.state.getSnapshot(),
      processing: operation.signal ? current.processing : base.state.getSnapshot().processing
    }))
  );
  let activeCreateOptions = defaultOptions;
  let observedSession: LanguageModel | null = null;

  const updateContext = (instance = state.getSnapshot().instance) => {
    state.update({
      contextUsage: instance?.contextUsage ?? null,
      contextWindow: instance?.contextWindow ?? null
    });
  };
  const handleContextOverflow = () => {
    updateContext(observedSession);
    state.update((current) => ({
      ...current,
      contextOverflowCount: current.contextOverflowCount + 1,
      lastContextOverflowAt: Date.now()
    }));
  };
  const observeSession = (instance: LanguageModel | null) => {
    observedSession?.removeEventListener('contextoverflow', handleContextOverflow);
    observedSession = instance;
    observedSession?.addEventListener('contextoverflow', handleContextOverflow);
  };
  const create = async (options?: WithoutLifecycle<LanguageModelCreateOptions>) => {
    operation.interrupt();
    const instance = await base.create(options);
    activeCreateOptions = options ?? defaultOptions;
    observeSession(instance);
    updateContext(instance);
    return instance;
  };
  const ensure = async (options?: WithoutLifecycle<LanguageModelCreateOptions>) => {
    const instance = await base.ensure(options);
    if (instance !== base.state.getSnapshot().instance)
      throw new DOMException('The operation was aborted.', 'AbortError');
    if (instance !== observedSession) {
      activeCreateOptions = options ?? activeCreateOptions;
      observeSession(instance);
      updateContext(instance);
    }
    return instance;
  };

  const prompt = async (
    input: LanguageModelPrompt,
    options: WithoutSignal<LanguageModelPromptOptions> = {},
    createOptions?: WithoutLifecycle<LanguageModelCreateOptions>
  ) => {
    const signal = operation.begin();
    state.update({ processing: 'prompt', output: '', error: null });
    try {
      const instance = await ensure(createOptions);
      signal.throwIfAborted();
      const output = await instance.prompt(input, { ...options, signal });
      if (operation.isCurrent(signal)) {
        state.update({ output });
        updateContext(instance);
      }
      return output;
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };

  const promptStreaming = async (
    input: LanguageModelPrompt,
    options: WithoutSignal<LanguageModelPromptOptions> = {},
    createOptions?: WithoutLifecycle<LanguageModelCreateOptions>
  ) => {
    const signal = operation.begin();
    state.update({ processing: 'prompt', output: '', error: null });
    let stream: ReadableStream<string>;
    let instance: LanguageModel;
    try {
      instance = await ensure(createOptions);
      signal.throwIfAborted();
      stream = instance.promptStreaming(input, { ...options, signal });
    } catch (error) {
      if (operation.end(signal)) state.update({ processing: '', error });
      throw error;
    }
    return observeTextStream(stream, signal, {
      onChunk: (output) => {
        if (operation.isCurrent(signal)) state.update({ output });
      },
      onComplete: () => {
        if (operation.isCurrent(signal)) updateContext(instance);
      },
      onError: (error) => {
        if (operation.isCurrent(signal) && !signal.aborted) state.update({ error });
      },
      onFinally: () => {
        if (operation.end(signal)) state.update({ processing: '' });
      }
    });
  };

  const promptStreamingToText = async (
    input: LanguageModelPrompt,
    options: WithoutSignal<LanguageModelPromptOptions> = {},
    onChunk?: (chunk: string, accumulated: string) => void,
    createOptions?: WithoutLifecycle<LanguageModelCreateOptions>
  ) => collectTextStream(await promptStreaming(input, options, createOptions), onChunk);

  const promptWithAttachments = async (
    text: string,
    attachments: readonly BrowserAiAttachment[],
    options: PromptWithAttachmentsOptions = {},
    createOptions: WithoutLifecycle<LanguageModelCreateOptions> = activeCreateOptions
  ) => {
    const signal = operation.begin();
    state.update({ processing: 'prepare', error: null });
    try {
      const input = await buildPrompt(text, attachments, options);
      signal.throwIfAborted();
      const expectedInputs = mergeExpectedInputs(
        createOptions.expectedInputs ?? activeCreateOptions.expectedInputs,
        attachments
      );
      return await prompt(input, options.prompt, { ...createOptions, expectedInputs });
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };

  const promptStreamingWithAttachments = async (
    text: string,
    attachments: readonly BrowserAiAttachment[],
    options: PromptWithAttachmentsOptions = {},
    onChunk?: (chunk: string, accumulated: string) => void,
    createOptions: WithoutLifecycle<LanguageModelCreateOptions> = activeCreateOptions
  ) => {
    const signal = operation.begin();
    state.update({ processing: 'prepare', error: null });
    try {
      const input = await buildPrompt(text, attachments, options);
      signal.throwIfAborted();
      const expectedInputs = mergeExpectedInputs(
        createOptions.expectedInputs ?? activeCreateOptions.expectedInputs,
        attachments
      );
      return await promptStreamingToText(input, options.prompt, onChunk, { ...createOptions, expectedInputs });
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };

  const append = async (input: LanguageModelPrompt, createOptions?: WithoutLifecycle<LanguageModelCreateOptions>) => {
    const signal = operation.begin();
    state.update({ processing: 'append', error: null });
    try {
      const instance = await ensure(createOptions);
      signal.throwIfAborted();
      await instance.append(input, { signal });
      if (operation.isCurrent(signal)) updateContext(instance);
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };

  const measureContextUsage = async (
    input: LanguageModelPrompt,
    options: WithoutSignal<LanguageModelPromptOptions> = {},
    createOptions?: WithoutLifecycle<LanguageModelCreateOptions>
  ) => {
    const signal = operation.begin();
    state.update({ processing: 'measure', error: null });
    try {
      const instance = await ensure(createOptions);
      signal.throwIfAborted();
      return await instance.measureContextUsage(input, { ...options, signal });
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };

  const clone = async (
    options: WithoutSignal<LanguageModelCloneOptions> = {},
    createOptions?: WithoutLifecycle<LanguageModelCreateOptions>
  ) => {
    const signal = operation.begin();
    state.update({ processing: 'clone', error: null });
    try {
      const instance = await ensure(createOptions);
      signal.throwIfAborted();
      return await instance.clone({ ...options, signal });
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };
  const promptJson = async <Value = unknown>(
    input: LanguageModelPrompt,
    responseConstraint: Record<string, unknown>,
    options: WithoutSignal<LanguageModelPromptOptions> = {},
    createOptions?: WithoutLifecycle<LanguageModelCreateOptions>
  ) => JSON.parse(await prompt(input, { ...options, responseConstraint }, createOptions)) as Value;

  const interrupt = (reason?: unknown) => {
    operation.interrupt(reason);
    base.interrupt(reason);
    state.update({ processing: '' });
  };
  const destroy = () => {
    operation.interrupt();
    observeSession(null);
    base.destroy();
    state.update({ instance: null, processing: '', contextUsage: null, contextWindow: null });
  };
  const dispose = () => {
    interrupt();
    observeSession(null);
    base.dispose();
    activeCreateOptions = defaultOptions;
    state.update({
      ...base.state.getSnapshot(),
      output: '',
      contextUsage: null,
      contextWindow: null,
      contextOverflowCount: 0,
      lastContextOverflowAt: null
    });
  };

  return {
    ...base,
    state,
    create,
    ensure,
    prompt,
    promptJson,
    promptStreaming,
    promptStreamingToText,
    promptWithAttachments,
    promptStreamingWithAttachments,
    append,
    measureContextUsage,
    clone,
    destroy,
    dispose,
    interrupt
  };
};
