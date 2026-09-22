/// <reference types="@types/dom-chromium-ai" preserve="true" />
import { buildPrompt, mergeExpectedInputs, type BrowserAiAttachment } from './attachments.js';
import { createAiChats, type AiChatMessage, type AiChatRecord } from './chats.js';
import { equalOptions, snapshotOptions } from './model.js';
import { collectTextStream, createAbortManager, createBrowserAiId, observeTextStream } from './platform.js';
import { createBrowserAiStore } from './store.js';
import {
  createPromptWorkflow,
  type LLMContextStrategy,
  type LLMContextSummaryMode,
  type LLMPromptOptions,
  type LLMRestoreSessionOptions,
  type LLMProcessingState
} from './workflows/prompt.js';

export interface ConversationMessage extends AiChatMessage {
  /** Available only while this controller lives. Attachment bytes are never persisted. */
  attachments?: readonly BrowserAiAttachment[];
}

export interface ConversationPromptContext {
  text: string;
  attachments: readonly BrowserAiAttachment[];
  messages: readonly ConversationMessage[];
  streaming: boolean;
}

export interface ConversationOptions {
  onInitStart?: () => void;
  onInitComplete?: () => void;
  onCreateStart?: () => void;
  onCreateComplete?: () => void;
  onContextStateChange?: LLMRestoreSessionOptions['onStateChange'];
  onSummaryCacheError?: (error: unknown) => void;
  onContextOverflow?: () => void;
  onPromptStart?: (event: { streaming: boolean; input: LanguageModelPrompt }) => void;
  onStreamChunk?: (event: { chunk: string; accumulated: string }) => void;
  onPromptComplete?: (event: { response: string; streaming: boolean }) => void;
  chatKey?: string;
  modelOptions?: LanguageModelCreateCoreOptions;
  systemPrompt?: string;
  initialMessages?: readonly ConversationMessage[];
  autoInit?: boolean;
  autoCreate?: boolean;
  streaming?: boolean;
  promptOptions?: LLMPromptOptions | ((context: ConversationPromptContext) => LLMPromptOptions);
  maxMessages?: number;
  contextStrategy?: LLMContextStrategy;
  contextSummaryMode?: LLMContextSummaryMode;
  contextBudgetRatio?: number;
  contextSummaryChunkBudgetRatio?: number;
  contextSummaryMaxCharacters?: number;
  contextSummaryTimeoutMs?: number;
  contextSummaryBackgroundTimeoutMs?: number;
  autoCompactContext?: boolean;
  contextCompactionThresholdRatio?: number;
  contextCompactionSummaryMode?: LLMContextSummaryMode;
}

type PromptState = ReturnType<ReturnType<typeof createPromptWorkflow>['state']['getSnapshot']>;
export interface ConversationState extends Pick<
  PromptState,
  | 'availability'
  | 'downloadProgress'
  | 'contextWindow'
  | 'contextUsage'
  | 'contextWindowAvailable'
  | 'contextRestoreState'
  | 'isReady'
> {
  modelProcessing: LLMProcessingState;
  messages: readonly ConversationMessage[];
  chats: readonly AiChatRecord[];
  activeChatId: string | null;
  loaded: boolean;
  processing: 'load' | 'restore' | 'send' | 'save' | '';
  isProcessing: boolean;
  error: unknown;
  /** Reloading restores text history; image/audio attachments survive same-page chat switches only. */
  persistence: 'text-only';
}

const copyMessages = (messages: readonly ConversationMessage[]): ConversationMessage[] =>
  messages.map((message) => ({
    ...message,
    ...(message.attachments ? { attachments: message.attachments.map((attachment) => ({ ...attachment })) } : {})
  }));

/** Optional chat orchestration. It owns model/storage lifecycles, but creates no preview URLs. */
export const createConversation = (initialOptions: ConversationOptions = {}) => {
  let options = { ...initialOptions, modelOptions: snapshotOptions(initialOptions.modelOptions) };
  let overflow = false;
  const prompt = createPromptWorkflow({
    onContextOverflow: () => {
      overflow = true;
      options.onContextOverflow?.();
    }
  });
  const chats = createAiChats(options.chatKey ?? 'prompt-api');
  const operation = createAbortManager();
  const runtime = new Map<string, ConversationMessage[]>();
  const inputs = new Map<string, LanguageModelMessage>();
  let sessionOptions: LanguageModelCreateCoreOptions | null = null;
  let sessionDirty = true;
  let revision = 0;
  let pendingTurn: { signal: AbortSignal; messages: readonly ConversationMessage[] } | null = null;
  let subscriptions: Array<() => void> = [];

  const metrics = () => {
    const {
      availability,
      processing: modelProcessing,
      downloadProgress,
      contextWindow,
      contextUsage,
      contextWindowAvailable,
      contextRestoreState,
      isReady
    } = prompt.state.getSnapshot();
    return {
      modelProcessing,
      availability,
      downloadProgress,
      contextWindow,
      contextUsage,
      contextWindowAvailable,
      contextRestoreState,
      isReady
    };
  };
  const store = createBrowserAiStore<ConversationState>({
    ...metrics(),
    messages: [],
    chats: [],
    activeChatId: null,
    loaded: false,
    processing: '',
    isProcessing: false,
    error: null,
    persistence: 'text-only'
  });
  const publish = (patch: Partial<ConversationState> = {}) => {
    const processing = patch.processing ?? store.getSnapshot().processing;
    store.update({
      ...metrics(),
      chats: chats.state.getSnapshot().chats,
      ...patch,
      processing,
      isProcessing: processing !== ''
    });
  };
  const activate = () => {
    if (subscriptions.length) return;
    subscriptions = [prompt.state.subscribe(() => publish()), chats.state.subscribe(() => publish())];
  };
  activate();

  const wait = <T>(pending: Promise<T>, signal: AbortSignal): Promise<T> =>
    new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });

  const interrupt = () => {
    revision += 1;
    operation.interrupt();
    prompt.interrupt();
    sessionDirty = true;
    if (pendingTurn) {
      publish({ messages: pendingTurn.messages });
      pendingTurn = null;
    }
    publish({ processing: '' });
  };

  const run = async <T>(
    processing: ConversationState['processing'],
    action: (signal: AbortSignal) => Promise<T>,
    supersede = true
  ): Promise<T | null> => {
    if (!supersede && operation.signal) return null;
    if (operation.signal) interrupt();
    activate();
    const signal = operation.begin();
    publish({ processing, error: null });
    try {
      const result = await action(signal);
      signal.throwIfAborted();
      return result;
    } catch (error) {
      if (signal.aborted) return null;
      sessionDirty = true;
      if (pendingTurn?.signal === signal) {
        publish({ messages: pendingTurn.messages });
        pendingTurn = null;
      }
      publish({ error });
      throw error;
    } finally {
      if (operation.end(signal)) publish({ processing: '' });
    }
  };

  const remember = () => {
    const { activeChatId, messages } = store.getSnapshot();
    if (activeChatId) runtime.set(activeChatId, copyMessages(messages));
  };
  const release = (id: string) => {
    runtime.get(id)?.forEach((message) => inputs.delete(message.id));
    runtime.delete(id);
  };
  const select = (chat: AiChatRecord | null, signal: AbortSignal) => {
    signal.throwIfAborted();
    remember();
    revision += 1;
    sessionDirty = true;
    prompt.destroy();
    signal.throwIfAborted();
    if (chat) chats.selectChat(chat.id);
    else chats.clearActiveChat();
    signal.throwIfAborted();
    publish({
      activeChatId: chat?.id ?? null,
      messages: chat ? copyMessages(runtime.get(chat.id) ?? chat.messages) : []
    });
  };
  const ensureLoaded = async (signal: AbortSignal) => {
    signal.throwIfAborted();
    if (store.getSnapshot().loaded) return;
    await wait(chats.loadChats(), signal);
    signal.throwIfAborted();
    let chat = chats.state.getSnapshot().activeChat;
    if (!chat && options.initialMessages?.length) {
      const messages = copyMessages(options.initialMessages);
      chat = await wait(chats.createChat('New chat', messages), signal);
      signal.throwIfAborted();
      runtime.set(chat.id, messages);
    }
    select(chat, signal);
    signal.throwIfAborted();
    publish({ loaded: true });
  };
  const modelOptions = (attachments: readonly BrowserAiAttachment[] = []) => ({
    ...options.modelOptions,
    expectedInputs: mergeExpectedInputs(options.modelOptions?.expectedInputs, [
      ...store.getSnapshot().messages.flatMap((message) => message.attachments ?? []),
      ...attachments
    ])
  });
  const compact = () => {
    if (options.autoCompactContext === false) return false;
    const { contextWindow, contextWindowAvailable } = prompt.state.getSnapshot();
    return (
      overflow ||
      (contextWindow !== null &&
        contextWindow > 0 &&
        contextWindowAvailable !== null &&
        contextWindowAvailable / contextWindow <= (options.contextCompactionThresholdRatio ?? 0.22))
    );
  };
  const restore = async (
    signal: AbortSignal,
    model = modelOptions(),
    summaryMode = options.contextSummaryMode,
    creation: Pick<LLMRestoreSessionOptions, 'autoCreate' | 'allowDownloadCreate'> = {}
  ) => {
    signal.throwIfAborted();
    const { messages, activeChatId } = store.getSnapshot();
    const owner = revision;
    const history: Array<LanguageModelSystemMessage | LanguageModelMessage> = [];
    if (options.systemPrompt?.trim()) history.push({ role: 'system', content: options.systemPrompt });
    for (const message of messages) {
      let input = inputs.get(message.id);
      if (!input && message.attachments?.length) {
        const built = await wait(buildPrompt(message.content, message.attachments), signal);
        signal.throwIfAborted();
        input = (built as LanguageModelMessage[])[0];
        inputs.set(message.id, input);
      }
      history.push(input ?? { role: message.role, content: message.content });
    }
    const current = () => owner === revision && !signal.aborted;
    const restored = await wait(
      prompt.restoreSession(history, {
        modelOptions: model,
        autoCreate: options.autoCreate ?? true,
        allowDownloadCreate: options.autoCreate ?? true,
        ...creation,
        strategy: options.contextStrategy ?? 'summarize',
        summaryMode,
        budgetRatio: options.contextBudgetRatio,
        summaryChunkBudgetRatio: options.contextSummaryChunkBudgetRatio,
        summaryMaxCharacters: options.contextSummaryMaxCharacters,
        summaryTimeoutMs: options.contextSummaryTimeoutMs,
        summaryBackgroundTimeoutMs: options.contextSummaryBackgroundTimeoutMs,
        messageMetadata: messages.map(({ id, timestamp }) => ({ id, timestamp })),
        summaryCache: activeChatId ? chats.getChatById(activeChatId)?.summaries : [],
        shouldContinue: current,
        onSummaryCacheUpdate: async (summaries) => {
          if (activeChatId && current()) await chats.updateSummaries(activeChatId, summaries);
        },
        onSummaryCacheError: (error) => {
          if (current()) {
            publish({ error });
            options.onSummaryCacheError?.(error);
          }
        },
        onInitStart: options.onInitStart,
        onInitComplete: options.onInitComplete,
        onCreateStart: options.onCreateStart,
        onCreateComplete: options.onCreateComplete,
        onStateChange: options.onContextStateChange
      }),
      signal
    );
    signal.throwIfAborted();
    sessionDirty = !restored.ready;
    sessionOptions = model;
    overflow = false;
    return restored.ready;
  };
  const restoreIfEnabled = (signal: AbortSignal) =>
    options.autoInit === false
      ? Promise.resolve(false)
      : restore(signal, undefined, undefined, { allowDownloadCreate: false });
  const load = () =>
    run('load', async (signal) => {
      await ensureLoaded(signal);
      signal.throwIfAborted();
      if (sessionDirty) await restoreIfEnabled(signal);
    });

  const send = (text: string, attachments: readonly BrowserAiAttachment[] = []) => {
    if (!text.trim() && !attachments.length) return Promise.resolve(null);
    // The lock is acquired synchronously, before storage or file reads can yield.
    return run(
      'send',
      async (signal) => {
        await ensureLoaded(signal);
        signal.throwIfAborted();
        const selected = attachments.map((attachment) => ({ ...attachment }));
        const input = await wait(buildPrompt(text, selected), signal);
        signal.throwIfAborted();
        if (!store.getSnapshot().activeChatId) {
          const chat = await wait(chats.createChat(text.trim().slice(0, 80) || 'New chat'), signal);
          signal.throwIfAborted();
          // Naming the first empty chat does not change an already prepared model's context.
          publish({ activeChatId: chat.id });
          signal.throwIfAborted();
        }
        const model = modelOptions(selected);
        const shouldCompact = compact();
        if (
          sessionDirty ||
          !prompt.state.getSnapshot().isReady ||
          !equalOptions(sessionOptions, model) ||
          shouldCompact
        ) {
          const ready = await restore(
            signal,
            model,
            shouldCompact ? (options.contextCompactionSummaryMode ?? 'eager') : options.contextSummaryMode
          );
          if (!ready) throw new Error('The conversation model is not ready. Enable autoCreate to create a session.');
        }
        const before = store.getSnapshot().messages;
        const user: ConversationMessage = {
          id: createBrowserAiId(),
          role: 'user',
          content: text,
          timestamp: Date.now(),
          ...(selected.length ? { attachments: selected } : {})
        };
        const assistant: ConversationMessage = {
          id: createBrowserAiId(),
          role: 'assistant',
          content: '',
          timestamp: Date.now()
        };
        const streaming = options.streaming ?? true;
        const promptOptions =
          typeof options.promptOptions === 'function'
            ? options.promptOptions({ text, attachments: selected, messages: before, streaming })
            : options.promptOptions;
        pendingTurn = { signal, messages: before };
        const show = (content: string) => publish({ messages: [...before, user, { ...assistant, content }] });
        show('');
        signal.throwIfAborted();
        options.onPromptStart?.({ streaming, input });
        signal.throwIfAborted();
        let streamed = '';
        const output = streaming
          ? await collectTextStream(
              observeTextStream(prompt.promptStreaming(input, promptOptions), signal, {
                onChunk: (accumulated) => {
                  const chunk = accumulated.slice(streamed.length);
                  streamed = accumulated;
                  show(accumulated);
                  if (!signal.aborted) options.onStreamChunk?.({ chunk, accumulated });
                },
                onComplete: () => {},
                onError: () => {},
                onFinally: () => {}
              })
            )
          : await wait(prompt.prompt(input, promptOptions), signal);
        signal.throwIfAborted();
        show(output);
        signal.throwIfAborted();
        pendingTurn = null;
        inputs.set(
          user.id,
          typeof input === 'string' ? { role: 'user', content: input } : (input as LanguageModelMessage[])[0]
        );
        const limit = options.maxMessages;
        if (limit !== undefined && Number.isFinite(limit) && limit > 0 && store.getSnapshot().messages.length > limit) {
          const count = Math.max(1, Math.floor(limit));
          const messages = store.getSnapshot().messages;
          messages.slice(0, -count).forEach((message) => inputs.delete(message.id));
          publish({ messages: messages.slice(-count) });
          signal.throwIfAborted();
          sessionDirty = true;
        }
        remember();
        const snapshot = store.getSnapshot();
        // Persist only completed turns. File text remains usable after a reload; binary data does not.
        const persisted = snapshot.messages.map(({ id, role, content, timestamp }) => {
          const raw = inputs.get(id)?.content;
          return {
            id,
            role,
            timestamp,
            content: Array.isArray(raw)
              ? raw
                  .filter((part) => part.type === 'text')
                  .map((part) => part.value)
                  .join('\n\n')
              : content
          };
        });
        await wait(chats.updateMessages(snapshot.activeChatId!, persisted), signal);
        signal.throwIfAborted();
        options.onPromptComplete?.({ response: output, streaming });
        return output;
      },
      false
    );
  };
  const init = () =>
    run('restore', async (signal) => {
      options.onInitStart?.();
      signal.throwIfAborted();
      const availability = await wait(prompt.init(modelOptions()), signal);
      signal.throwIfAborted();
      options.onInitComplete?.();
      return availability;
    });
  const create = () =>
    run('restore', async (signal) => {
      await ensureLoaded(signal);
      signal.throwIfAborted();
      const model = modelOptions();
      if (store.getSnapshot().messages.length || options.systemPrompt?.trim()) {
        await restore(signal, model, undefined, { autoCreate: true, allowDownloadCreate: true });
        signal.throwIfAborted();
        return prompt.state.getSnapshot().session;
      }
      options.onCreateStart?.();
      signal.throwIfAborted();
      const instance = await wait(prompt.create(model), signal);
      signal.throwIfAborted();
      sessionOptions = model;
      sessionDirty = false;
      options.onCreateComplete?.();
      return instance;
    });
  const selectChat = (id: string) =>
    run('restore', async (signal) => {
      await ensureLoaded(signal);
      signal.throwIfAborted();
      const chat = chats.getChatById(id);
      if (!chat || store.getSnapshot().activeChatId === id) return;
      select(chat, signal);
      await restoreIfEnabled(signal);
    });
  const createChat = (title = 'New chat') =>
    run('save', async (signal) => {
      await ensureLoaded(signal);
      signal.throwIfAborted();
      const chat = await wait(chats.createChat(title), signal);
      signal.throwIfAborted();
      select(chat, signal);
      await restoreIfEnabled(signal);
      return chat;
    });
  const renameChat = (id: string, title: string) =>
    run('save', async (signal) => {
      await ensureLoaded(signal);
      signal.throwIfAborted();
      await wait(chats.renameChat(id, title), signal);
    });
  const deleteChat = (id: string) =>
    run('save', async (signal) => {
      await ensureLoaded(signal);
      signal.throwIfAborted();
      await wait(chats.deleteChat(id), signal);
      signal.throwIfAborted();
      if (store.getSnapshot().activeChatId === id) {
        select(chats.state.getSnapshot().chats[0] ?? null, signal);
        await restoreIfEnabled(signal);
      }
      release(id);
    });
  const clear = () =>
    run('save', async (signal) => {
      await ensureLoaded(signal);
      signal.throwIfAborted();
      const id = store.getSnapshot().activeChatId;
      if (id) {
        await wait(chats.updateMessages(id, []), signal);
        signal.throwIfAborted();
        await wait(chats.updateSummaries(id, []), signal);
        signal.throwIfAborted();
        release(id);
      }
      publish({ messages: [] });
      signal.throwIfAborted();
      sessionDirty = true;
      prompt.destroy();
      await restoreIfEnabled(signal);
    });
  const configure = (next: Partial<Omit<ConversationOptions, 'chatKey' | 'initialMessages'>>) => {
    const merged = {
      ...options,
      ...next,
      modelOptions: snapshotOptions(
        Object.prototype.hasOwnProperty.call(next, 'modelOptions') ? next.modelOptions : options.modelOptions
      )
    };
    if (!equalOptions(merged.modelOptions, options.modelOptions) || merged.systemPrompt !== options.systemPrompt) {
      interrupt();
      prompt.destroy();
    }
    options = merged;
  };
  const dispose = () => {
    interrupt();
    subscriptions.forEach((unsubscribe) => unsubscribe());
    subscriptions = [];
    prompt.dispose();
    chats.dispose();
    runtime.clear();
    inputs.clear();
    sessionOptions = null;
    publish({ messages: [], activeChatId: null, loaded: false, error: null });
  };
  return {
    state: {
      getSnapshot: store.getSnapshot,
      subscribe(listener: () => void) {
        activate();
        return store.subscribe(listener);
      }
    },
    load,
    init,
    create,
    send,
    selectChat,
    createChat,
    deleteChat,
    renameChat,
    clear,
    configure,
    interrupt,
    dispose
  };
};

export {
  conversationAttachments,
  conversationMessages,
  createConversationView,
  createChatViewport,
  formatRelativeTime,
  toDateTime
} from './conversation-view.js';
export type { ConversationAttachmentView, ConversationMessageView } from './conversation-view.js';
