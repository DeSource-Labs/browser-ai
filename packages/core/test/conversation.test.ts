import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConversation, type ConversationOptions } from '../src/conversation';
import { createAiChats, type AiChatMessage, type AiChatSummaryRecord } from '../src/chats';
import { createPromptWorkflow, type LLMProcessingState, type LLMRestoreSessionOptions } from '../src/workflows/prompt';
import { createBrowserAiStore } from '../src/store';
import { deferred, failingTextStream, flushPromises, pendingTextStream, textStream } from './helpers';

vi.mock('../src/workflows/prompt', () => ({ createPromptWorkflow: vi.fn() }));
vi.mock('../src/chats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/chats')>();
  return { ...actual, createAiChats: vi.fn(actual.createAiChats) };
});

const restored = {
  ready: true,
  selectedMessages: [],
  selectedConversationCount: 0,
  totalConversationCount: 0,
  summarizedMessages: 0,
  partiallyLoaded: false
};
const message = (id: string, role: AiChatMessage['role'] = 'user'): AiChatMessage => ({
  id,
  role,
  content: id,
  timestamp: 1
});
const summary: AiChatSummaryRecord = {
  id: 'summary',
  startIndex: 0,
  endIndex: 2,
  messageIds: ['first', 'second'],
  hash: 'hash',
  summary: 'Earlier discussion',
  tokenUsage: 10,
  level: 0,
  createdAt: 1,
  updatedAt: 1
};

const createWorkflow = () => {
  const state = createBrowserAiStore({
    availability: null as Availability | null,
    processing: '' as LLMProcessingState,
    session: null as LanguageModel | null,
    isReady: false,
    downloadProgress: 0,
    contextWindow: null as number | null,
    contextUsage: null as number | null,
    contextWindowAvailable: null as number | null,
    contextRestoreState: { phase: 'idle' }
  });
  return {
    state,
    init: vi.fn(async (_options: LanguageModelCreateCoreOptions) => {
      state.update({ availability: 'available' });
      return 'available' as Availability;
    }),
    create: vi.fn(async (_options: LanguageModelCreateCoreOptions) => {
      const session = { destroy: vi.fn() } as unknown as LanguageModel;
      state.update({ isReady: true, availability: 'available', session });
      return session;
    }),
    restoreSession: vi.fn(async (_history: unknown[], _options: LLMRestoreSessionOptions) => {
      state.update({ isReady: true, availability: 'available' });
      return restored;
    }),
    prompt: vi.fn(async () => 'Complete response'),
    promptStreaming: vi.fn(() => textStream('Hello', ' world')),
    interrupt: vi.fn(),
    destroy: vi.fn(() => state.update({ isReady: false })),
    dispose: vi.fn(() => state.update({ isReady: false, availability: null }))
  };
};

describe('createConversation', () => {
  let workflow: ReturnType<typeof createWorkflow>;
  let overflow: () => void;
  let key = 0;
  const active: Array<ReturnType<typeof createConversation>> = [];
  const create = (options: ConversationOptions = {}) => {
    const conversation = createConversation({ chatKey: `conversation-${++key}`, ...options });
    active.push(conversation);
    const chats = vi.mocked(createAiChats).mock.results.at(-1)!.value;
    return { conversation, chats, snapshot: conversation.state.getSnapshot };
  };
  const useNativeWorkflow = async (status: Availability = 'available') => {
    const actual = await vi.importActual<typeof import('../src/workflows/prompt')>('../src/workflows/prompt');
    vi.mocked(createPromptWorkflow).mockImplementation(actual.createPromptWorkflow);
    class Session extends EventTarget {
      readonly contextWindow = 10000;
      readonly contextUsage = 20;
      destroy = vi.fn();
      measureContextUsage = vi.fn(async () => 20);
      promptStreaming = vi.fn(() => textStream('Native ', 'response'));
    }
    const nativeCreate = vi.fn(async (_options: LanguageModelCreateOptions) => new Session());
    const availability = vi.fn(async () => status);
    vi.stubGlobal('LanguageModel', { availability, create: nativeCreate });
    return { nativeCreate, availability };
  };

  beforeEach(() => {
    vi.stubGlobal('indexedDB', undefined);
    const preferences = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => preferences.get(key) ?? null,
      setItem: (key: string, value: string) => preferences.set(key, value),
      removeItem: (key: string) => preferences.delete(key)
    });
    workflow = createWorkflow();
    vi.mocked(createPromptWorkflow).mockImplementation((options) => {
      overflow = () => options?.onContextOverflow?.(new Event('contextoverflow'));
      return workflow as unknown as ReturnType<typeof createPromptWorkflow>;
    });
  });
  afterEach(() => {
    active.splice(0).forEach((conversation) => conversation.dispose());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('publishes stable immutable snapshots, initializes once, and exposes model progress', async () => {
    const { conversation, snapshot } = create();
    const listener = vi.fn();
    const unsubscribe = conversation.state.subscribe(listener);
    const initial = snapshot();
    expect(snapshot()).toBe(initial);
    expect(initial).toMatchObject({ loaded: false, messages: [], persistence: 'text-only' });
    await conversation.load();
    expect(snapshot()).toMatchObject({ loaded: true, isReady: true, processing: '', isProcessing: false });
    workflow.state.update({ downloadProgress: 50, contextWindow: 100, contextUsage: 20, contextWindowAvailable: 80 });
    expect(snapshot()).toMatchObject({ downloadProgress: 50, contextWindowAvailable: 80 });
    expect(initial.loaded).toBe(false);
    await conversation.load();
    expect(workflow.restoreSession).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    workflow.state.update({ downloadProgress: 100 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns manual initialization/native creation results and publishes native processing separately', async () => {
    const events: string[] = [];
    const modelOptions = { expectedInputs: [{ type: 'text' as const, languages: ['fr'] }] };
    const { conversation, snapshot } = create({
      autoInit: false,
      modelOptions,
      onInitStart: () => events.push('init:start'),
      onInitComplete: () => events.push('init:complete'),
      onCreateStart: () => events.push('create:start'),
      onCreateComplete: () => events.push('create:complete')
    });
    await conversation.createChat();
    expect(await conversation.init()).toBe('available');
    expect(workflow.init).toHaveBeenCalledExactlyOnceWith(modelOptions);
    const instance = await conversation.create();
    expect(instance).toBe(await workflow.create.mock.results[0]!.value);
    expect(workflow.create).toHaveBeenCalledExactlyOnceWith(modelOptions);
    expect(events).toEqual(['init:start', 'init:complete', 'create:start', 'create:complete']);
    workflow.state.update({ processing: 'measure' });
    expect(snapshot()).toMatchObject({ modelProcessing: 'measure', processing: '', isProcessing: false });
    await conversation.send('Uses manually created session');
    expect(workflow.restoreSession).not.toHaveBeenCalled();
  });

  it.each(['init', 'create'] as const)(
    'cancels %s from its start callback without entering native code',
    async (method) => {
      const complete = vi.fn();
      const { conversation, snapshot } = create({
        [method === 'init' ? 'onInitStart' : 'onCreateStart']: () => conversation.interrupt(),
        [method === 'init' ? 'onInitComplete' : 'onCreateComplete']: complete
      });
      expect(await conversation[method]()).toBeNull();
      expect(workflow[method]).not.toHaveBeenCalled();
      expect(complete).not.toHaveBeenCalled();
      expect(snapshot()).toMatchObject({ processing: '', error: null });
    }
  );

  it('does not let an initialization finalizer clear creation started by its completion callback', async () => {
    const pending = deferred<LanguageModel>();
    workflow.create.mockReturnValueOnce(pending.promise);
    let creating!: ReturnType<ReturnType<typeof createConversation>['create']>;
    const { conversation, snapshot } = create({
      onInitComplete: () => {
        creating = conversation.create();
      }
    });
    expect(await conversation.init()).toBeNull();
    expect(snapshot()).toMatchObject({ processing: 'restore', isProcessing: true });
    const instance = { destroy: vi.fn() } as unknown as LanguageModel;
    pending.resolve(instance);
    expect(await creating).toBe(instance);
    expect(snapshot().processing).toBe('');
  });

  it.each(['init', 'create'] as const)(
    'suppresses late %s completion after disposal and preserves subsequent work',
    async (method) => {
      const pending = deferred<never>();
      workflow[method].mockReturnValueOnce(pending.promise);
      const complete = vi.fn();
      const { conversation, snapshot } = create({
        [method === 'init' ? 'onInitComplete' : 'onCreateComplete']: complete
      });
      const old = conversation[method]();
      await flushPromises();
      conversation.dispose();
      expect(await old).toBeNull();
      await conversation[method]();
      expect(complete).toHaveBeenCalledOnce();
      pending.resolve(undefined as never);
      await flushPromises();
      expect(complete).toHaveBeenCalledOnce();
      expect(snapshot()).toMatchObject({ processing: '', error: null });
    }
  );

  it('passes restore lifecycle observers and reports only current cache errors', async () => {
    const onInitStart = vi.fn();
    const onInitComplete = vi.fn();
    const onCreateStart = vi.fn();
    const onCreateComplete = vi.fn();
    const onContextStateChange = vi.fn();
    const onSummaryCacheError = vi.fn();
    const onContextOverflow = vi.fn();
    const { conversation, snapshot } = create({
      onInitStart,
      onInitComplete,
      onCreateStart,
      onCreateComplete,
      onContextStateChange,
      onSummaryCacheError,
      onContextOverflow
    });
    await conversation.load();
    expect(workflow.restoreSession.mock.lastCall![1]).toMatchObject({
      onInitStart,
      onInitComplete,
      onCreateStart,
      onCreateComplete,
      onStateChange: onContextStateChange
    });
    const restoreOptions = workflow.restoreSession.mock.lastCall![1];
    const failure = new Error('Cannot persist summary');
    restoreOptions.onSummaryCacheError!(failure);
    expect(snapshot().error).toBe(failure);
    expect(onSummaryCacheError).toHaveBeenCalledExactlyOnceWith(failure);
    overflow();
    expect(onContextOverflow).toHaveBeenCalledOnce();
    conversation.interrupt();
    restoreOptions.onSummaryCacheError!(new Error('Stale summary failure'));
    expect(onSummaryCacheError).toHaveBeenCalledOnce();
    const updatedOverflow = vi.fn();
    conversation.configure({ onContextOverflow: updatedOverflow });
    overflow();
    expect(updatedOverflow).toHaveBeenCalledOnce();
  });

  it('reports streaming deltas and completion only after the turn is persisted', async () => {
    const onPromptStart = vi.fn();
    const onStreamChunk = vi.fn();
    const onPromptComplete = vi.fn(({ response }: { response: string }) =>
      expect(chats.state.getSnapshot().activeChat?.messages.at(-1)?.content).toBe(response)
    );
    const { conversation, chats } = create({ onPromptStart, onStreamChunk, onPromptComplete });
    expect(await conversation.send('Hello')).toBe('Hello world');
    expect(onPromptStart).toHaveBeenCalledExactlyOnceWith({ input: 'Hello', streaming: true });
    expect(onStreamChunk.mock.calls).toEqual([
      [{ chunk: 'Hello', accumulated: 'Hello' }],
      [{ chunk: ' world', accumulated: 'Hello world' }]
    ]);
    expect(onPromptComplete).toHaveBeenCalledExactlyOnceWith({ response: 'Hello world', streaming: true });
    conversation.configure({ streaming: false });
    await conversation.send('Without streaming');
    expect(onStreamChunk).toHaveBeenCalledTimes(2);
    expect(onPromptComplete).toHaveBeenLastCalledWith({ response: 'Complete response', streaming: false });
  });

  it('cancels from prompt-start and stream callbacks before completing or persisting the turn', async () => {
    const onPromptComplete = vi.fn();
    const { conversation, chats, snapshot } = create({
      onPromptStart: () => conversation.interrupt(),
      onPromptComplete
    });
    const persist = vi.spyOn(chats, 'updateMessages');
    expect(await conversation.send('Cancelled at start')).toBeNull();
    expect(workflow.promptStreaming).not.toHaveBeenCalled();
    expect(snapshot().messages).toEqual([]);
    conversation.configure({ onPromptStart: undefined, onStreamChunk: () => conversation.interrupt() });
    expect(await conversation.send('Cancelled on first chunk')).toBeNull();
    expect(snapshot().messages).toEqual([]);
    expect(onPromptComplete).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('preserves observer errors while cancelling and releasing native stream readers', async () => {
    const failure = new Error('Chunk observer failed');
    const cancel = vi.fn();
    const stream = new ReadableStream<string>({ start: (controller) => controller.enqueue('First'), cancel });
    workflow.promptStreaming.mockReturnValueOnce(stream);
    const onPromptComplete = vi.fn();
    const { conversation, chats, snapshot } = create({
      onStreamChunk: () => {
        throw failure;
      },
      onPromptComplete
    });
    const persist = vi.spyOn(chats, 'updateMessages');
    await expect(conversation.send('Observe')).rejects.toBe(failure);
    expect(cancel).toHaveBeenCalledExactlyOnceWith(failure);
    expect(stream.locked).toBe(false);
    expect(snapshot()).toMatchObject({ messages: [], error: failure, isProcessing: false });
    expect(persist).not.toHaveBeenCalled();
    expect(onPromptComplete).not.toHaveBeenCalled();
  });

  it.each(['start', 'complete'] as const)(
    'does not continue after subscriber disposal at %s publication',
    async (phase) => {
      const onPromptStart = vi.fn();
      const onPromptComplete = vi.fn();
      const { conversation, chats, snapshot } = create({ streaming: false, onPromptStart, onPromptComplete });
      const persist = vi.spyOn(chats, 'updateMessages');
      const unsubscribe = conversation.state.subscribe(() => {
        const last = snapshot().messages.at(-1);
        if (last?.role === 'assistant' && last.content === (phase === 'start' ? '' : 'Complete response'))
          conversation.dispose();
      });
      expect(await conversation.send('Dispose during publication')).toBeNull();
      expect(persist).not.toHaveBeenCalled();
      expect(onPromptComplete).not.toHaveBeenCalled();
      if (phase === 'start') expect(onPromptStart).not.toHaveBeenCalled();
      expect(snapshot()).toMatchObject({ loaded: false, messages: [], error: null });
      unsubscribe();
    }
  );

  it('locks before asynchronous storage, ignores empty/double sends, and persists one completed streamed turn', async () => {
    const { conversation, chats, snapshot } = create();
    const loaded = deferred<void>();
    const load = chats.loadChats.bind(chats);
    vi.spyOn(chats, 'loadChats').mockImplementationOnce(() => loaded.promise.then(load));
    const persist = vi.spyOn(chats, 'updateMessages');
    expect(await conversation.send('  ')).toBeNull();
    const first = conversation.send('First');
    expect(snapshot().isProcessing).toBe(true);
    expect(await conversation.send('Duplicate')).toBeNull();
    expect(persist).not.toHaveBeenCalled();
    loaded.resolve();
    expect(await first).toBe('Hello world');
    expect(snapshot().messages.map((item) => item.content)).toEqual(['First', 'Hello world']);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(chats.state.getSnapshot().activeChat?.messages).toHaveLength(2);
    await conversation.send('Second');
    expect(workflow.restoreSession).toHaveBeenCalledTimes(1);
    expect(snapshot().messages).toHaveLength(4);
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('loads persisted history and cached summaries, ignores initial messages when storage already exists', async () => {
    const { conversation, chats, snapshot } = create({ systemPrompt: 'Helpful', initialMessages: [message('unused')] });
    const chat = await chats.createChat('Saved', [message('first'), message('second', 'assistant')]);
    await chats.updateSummaries(chat.id, [summary]);
    await conversation.load();
    expect(snapshot().activeChatId).toBe(chat.id);
    expect(workflow.restoreSession).toHaveBeenCalledWith(
      [
        { role: 'system', content: 'Helpful' },
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' }
      ],
      expect.objectContaining({
        summaryCache: [summary],
        messageMetadata: [
          { id: 'first', timestamp: 1 },
          { id: 'second', timestamp: 1 }
        ]
      })
    );
    const restoreOptions = workflow.restoreSession.mock.lastCall![1];
    const update = vi.spyOn(chats, 'updateSummaries');
    await restoreOptions.onSummaryCacheUpdate!([{ ...summary, summary: 'Updated' }]);
    expect(update).toHaveBeenCalledWith(chat.id, [expect.objectContaining({ summary: 'Updated' })]);
    const quota = new Error('summary quota');
    restoreOptions.onSummaryCacheError!(quota);
    expect(snapshot().error).toBe(quota);
    expect(restoreOptions.shouldContinue!()).toBe(true);
    await conversation.createChat();
    update.mockClear();
    await restoreOptions.onSummaryCacheUpdate!([summary]);
    restoreOptions.onSummaryCacheError!(new Error('stale'));
    expect(update).not.toHaveBeenCalled();
    expect(snapshot().error).toBeNull();
    expect(restoreOptions.shouldContinue!()).toBe(false);
  });

  it('keeps attachment bytes across modality changes and chat switches, but persists only their text', async () => {
    const { conversation, chats, snapshot } = create({ streaming: false });
    const image = { kind: 'image' as const, value: new Blob(['pixels'], { type: 'image/png' }), name: 'photo.png' };
    const audio = { kind: 'audio' as const, value: new Blob(['sound'], { type: 'audio/wav' }) };
    const file = { kind: 'text' as const, name: 'notes.txt', value: 'File contents' };
    await conversation.send('Describe', [image, file]);
    const firstId = snapshot().activeChatId!;
    expect(chats.getChatById(firstId)?.messages[0]?.content).toBe('Describe\n\nFile: notes.txt\n\nFile contents');
    expect(chats.getChatById(firstId)?.messages[0]).not.toHaveProperty('attachments');
    const before = workflow.restoreSession.mock.calls.length;
    await conversation.send('Listen', [audio]);
    expect(workflow.restoreSession).toHaveBeenCalledTimes(before + 1);
    expect(workflow.restoreSession.mock.lastCall![0][0]).toMatchObject({
      role: 'user',
      content: [
        { type: 'text', value: 'Describe' },
        { type: 'image', value: image.value },
        { type: 'text', value: 'File: notes.txt\n\nFile contents' }
      ]
    });
    expect(workflow.restoreSession.mock.lastCall![1].modelOptions?.expectedInputs).toEqual([
      { type: 'text' },
      { type: 'image' },
      { type: 'audio' }
    ]);
    const second = await conversation.createChat('Other');
    await conversation.selectChat(firstId);
    expect(snapshot().messages[0]?.attachments?.[0]?.value).toBe(image.value);
    expect(workflow.restoreSession.mock.lastCall![0][2]).toMatchObject({
      content: [
        { type: 'text', value: 'Listen' },
        { type: 'audio', value: audio.value }
      ]
    });
    await conversation.deleteChat(second!.id);
    expect(snapshot().activeChatId).toBe(firstId);
    expect(workflow.prompt).toHaveBeenCalledTimes(2);
    expect(snapshot().persistence).toBe('text-only');
  });

  it('creates initial history once and restores attachment input without mutating caller messages', async () => {
    const attachment = { kind: 'image' as const, value: new Blob(['image'], { type: 'image/png' }) };
    const initial = [{ ...message('image'), attachments: [attachment] }];
    const { conversation, snapshot } = create({ initialMessages: initial, autoInit: false });
    await conversation.load();
    initial[0]!.content = 'changed';
    expect(snapshot().messages[0]?.content).toBe('image');
    expect(workflow.restoreSession).not.toHaveBeenCalled();
    await conversation.send('Follow up');
    expect(workflow.restoreSession.mock.lastCall![0][0]).toMatchObject({
      content: [
        { type: 'text', value: 'image' },
        { type: 'image', value: attachment.value }
      ]
    });
    expect(snapshot().messages).toHaveLength(3);
  });

  it('uses current prompt options and reuses equal model settings; changed settings restore history', async () => {
    const promptOptions = vi.fn(() => ({ omitResponseConstraintInput: true }));
    const modelOptions = { expectedInputs: [{ type: 'text' as const, languages: ['en'] }] };
    const { conversation } = create({ streaming: false, modelOptions, promptOptions });
    await conversation.send('First');
    expect(promptOptions).toHaveBeenCalledWith({ text: 'First', attachments: [], messages: [], streaming: false });
    expect(workflow.prompt).toHaveBeenCalledWith('First', { omitResponseConstraintInput: true });
    conversation.configure({
      modelOptions: { expectedInputs: [{ type: 'text', languages: ['en'] }] },
      streaming: true,
      promptOptions: {}
    });
    await conversation.send('Second');
    expect(workflow.restoreSession).toHaveBeenCalledTimes(1);
    conversation.configure({
      systemPrompt: 'New system prompt',
      modelOptions: { expectedInputs: [{ type: 'text', languages: ['fr'] }] }
    });
    await conversation.send('Third');
    expect(workflow.restoreSession).toHaveBeenCalledTimes(2);
    expect(workflow.restoreSession.mock.lastCall![0]).toHaveLength(5);
    expect(workflow.restoreSession.mock.lastCall![0][0]).toEqual({ role: 'system', content: 'New system prompt' });
  });

  it('snapshots nested model settings and detects mutations when the same object is configured again', async () => {
    const modelOptions = { expectedInputs: [{ type: 'text' as const, languages: ['en'] }] };
    const { conversation } = create({ modelOptions, streaming: false });
    modelOptions.expectedInputs[0]!.languages[0] = 'fr';
    await conversation.send('Initial snapshot');
    expect(workflow.restoreSession.mock.lastCall![1].modelOptions?.expectedInputs).toEqual([
      { type: 'text', languages: ['en'] }
    ]);
    const firstRestore = workflow.restoreSession.mock.lastCall!;
    conversation.configure({ modelOptions });
    modelOptions.expectedInputs[0]!.languages[0] = 'de';
    await conversation.send('Configured snapshot');
    expect(workflow.restoreSession).toHaveBeenCalledTimes(2);
    expect(firstRestore[1].modelOptions?.expectedInputs).toEqual([{ type: 'text', languages: ['en'] }]);
    expect(workflow.restoreSession.mock.lastCall![1].modelOptions?.expectedInputs).toEqual([
      { type: 'text', languages: ['fr'] }
    ]);
    conversation.configure({ modelOptions });
    await conversation.send('Mutated configuration');
    expect(workflow.restoreSession).toHaveBeenCalledTimes(3);
    expect(workflow.restoreSession.mock.lastCall![1].modelOptions?.expectedInputs).toEqual([
      { type: 'text', languages: ['de'] }
    ]);
    conversation.configure({ modelOptions: { expectedInputs: [{ languages: ['de'], type: 'text' }] } });
    await conversation.send('Equivalent configuration');
    expect(workflow.restoreSession).toHaveBeenCalledTimes(3);
    conversation.configure({ modelOptions: undefined });
    await conversation.send('Cleared configuration');
    expect(workflow.restoreSession).toHaveBeenCalledTimes(4);
    expect(workflow.restoreSession.mock.lastCall![1].modelOptions?.expectedInputs).toEqual([{ type: 'text' }]);
  });

  it('creates distinct chat and message identifiers without crypto.randomUUID', async () => {
    vi.stubGlobal('crypto', undefined);
    const { conversation, snapshot } = create({ streaming: false });
    await conversation.send('First fallback');
    await conversation.send('Second fallback');
    const ids = [snapshot().activeChatId!, ...snapshot().messages.map(({ id }) => id)];
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(5);
    expect(snapshot().messages.map(({ content }) => content)).toEqual([
      'First fallback',
      'Complete response',
      'Second fallback',
      'Complete response'
    ]);
    vi.stubGlobal('crypto', {});
    await conversation.send('Crypto without randomUUID');
    expect(new Set(snapshot().messages.map(({ id }) => id)).size).toBe(6);
  });

  it('delegates compaction and all context settings, including overflow and remaining quota', async () => {
    const { conversation } = create({
      contextStrategy: 'recent',
      contextSummaryMode: 'eager',
      contextBudgetRatio: 0.7,
      contextSummaryChunkBudgetRatio: 0.1,
      contextSummaryMaxCharacters: 500,
      contextSummaryTimeoutMs: 20,
      contextSummaryBackgroundTimeoutMs: 30,
      contextCompactionSummaryMode: 'cache-first'
    });
    await conversation.send('First');
    expect(workflow.restoreSession.mock.lastCall![1]).toMatchObject({
      strategy: 'recent',
      summaryMode: 'eager',
      budgetRatio: 0.7,
      summaryChunkBudgetRatio: 0.1,
      summaryMaxCharacters: 500,
      summaryTimeoutMs: 20,
      summaryBackgroundTimeoutMs: 30
    });
    overflow();
    await conversation.send('Overflow');
    expect(workflow.restoreSession.mock.lastCall![1].summaryMode).toBe('cache-first');
    workflow.state.update({ contextWindow: 100, contextWindowAvailable: 10 });
    conversation.configure({ contextCompactionSummaryMode: undefined });
    await conversation.send('Nearly full');
    expect(workflow.restoreSession).toHaveBeenCalledTimes(3);
    expect(workflow.restoreSession.mock.lastCall![1].summaryMode).toBe('eager');
    conversation.configure({ autoCompactContext: false });
    overflow();
    await conversation.send('Compaction disabled');
    expect(workflow.restoreSession).toHaveBeenCalledTimes(3);
  });

  it('supports manual initialization policy and reports a model that was not created', async () => {
    const { conversation, snapshot } = create({ autoCreate: false, autoInit: false });
    await conversation.load();
    workflow.restoreSession.mockResolvedValueOnce({ ...restored, ready: false });
    await expect(conversation.send('Hello')).rejects.toThrow('Enable autoCreate');
    expect(workflow.restoreSession.mock.lastCall![1]).toMatchObject({ autoCreate: false, allowDownloadCreate: false });
    expect(snapshot()).toMatchObject({ isProcessing: false, messages: [] });
    conversation.configure({ autoCreate: true });
    expect(await conversation.send('Try again')).toBe('Hello world');
  });

  it('renames, selects, deletes and clears persisted chats without retaining deleted attachment history', async () => {
    const { conversation, chats, snapshot } = create({ autoInit: false });
    await conversation.clear();
    expect(snapshot().messages).toEqual([]);
    await conversation.send('', [{ kind: 'image', value: new Blob(['image'], { type: 'image/png' }) }]);
    const first = snapshot().activeChatId!;
    expect(chats.getChatById(first)?.title).toBe('New chat');
    await conversation.renameChat(first, 'Renamed');
    expect(snapshot().chats[0]?.title).toBe('Renamed');
    await conversation.selectChat('missing');
    await conversation.selectChat(first);
    expect(snapshot().activeChatId).toBe(first);
    const second = await conversation.createChat('Second');
    await conversation.deleteChat(second!.id);
    expect(snapshot().activeChatId).toBe(first);
    await conversation.clear();
    expect(chats.getChatById(first)?.messages).toEqual([]);
    expect(chats.getChatById(first)?.summaries).toEqual([]);
    expect(snapshot().messages).toEqual([]);
    await conversation.deleteChat(first);
    await conversation.deleteChat('missing');
    expect(snapshot()).toMatchObject({ activeChatId: null, messages: [], chats: [] });
  });

  it('limits retained history and rebuilds the session after pruning', async () => {
    const { conversation, snapshot } = create({ maxMessages: 2 });
    await conversation.send('First', [{ kind: 'image', value: new Blob(['pixels'], { type: 'image/png' }) }]);
    await conversation.send('Second');
    expect(snapshot().messages.map((item) => item.content)).toEqual(['Second', 'Hello world']);
    await conversation.send('Third');
    expect(workflow.restoreSession).toHaveBeenCalledTimes(2);
    expect(workflow.restoreSession.mock.lastCall![0]).toEqual([
      { role: 'user', content: 'Second' },
      { role: 'assistant', content: 'Hello world' }
    ]);
    expect(workflow.restoreSession.mock.lastCall![1].modelOptions?.expectedInputs).toEqual([{ type: 'text' }]);
  });

  it('interrupts native streams immediately, rolls back unfinished turns and releases the reader', async () => {
    const { conversation, chats, snapshot } = create();
    const pending = pendingTextStream();
    workflow.promptStreaming.mockReturnValueOnce(pending.stream);
    const send = conversation.send('Interrupted');
    await flushPromises();
    expect(snapshot().messages).toHaveLength(2);
    conversation.interrupt();
    expect(await send).toBeNull();
    expect(pending.cancel).toHaveBeenCalledOnce();
    expect(pending.stream.locked).toBe(false);
    expect(snapshot()).toMatchObject({ messages: [], error: null, isProcessing: false });
    expect(chats.state.getSnapshot().activeChat?.messages).toEqual([]);
    expect(await conversation.send('Retry')).toBe('Hello world');
  });

  it('ignores late nonstream responses and stale finalizers after chat switching', async () => {
    const { conversation, snapshot } = create({ streaming: false });
    const pending = deferred<string>();
    workflow.prompt.mockReturnValueOnce(pending.promise);
    const old = conversation.send('Old');
    await flushPromises();
    const restoredLater = deferred<typeof restored>();
    workflow.restoreSession.mockReturnValueOnce(restoredLater.promise);
    const next = conversation.createChat('New');
    expect(await old).toBeNull();
    await flushPromises();
    expect(snapshot()).toMatchObject({ processing: 'save', messages: [] });
    pending.resolve('Late');
    await flushPromises();
    expect(snapshot()).toMatchObject({ processing: 'save', messages: [] });
    restoredLater.resolve(restored);
    await next;
    expect(snapshot().processing).toBe('');
  });

  it('does not recreate state after disposal during loading and remains reusable for StrictMode', async () => {
    const { conversation, chats, snapshot } = create();
    const loading = deferred<void>();
    vi.spyOn(chats, 'loadChats').mockReturnValueOnce(loading.promise);
    const old = conversation.load();
    conversation.dispose();
    expect(await old).toBeNull();
    loading.resolve();
    await flushPromises();
    expect(snapshot()).toMatchObject({ loaded: false, chats: [], messages: [], isReady: false });
    const listener = vi.fn();
    const unsubscribe = conversation.state.subscribe(listener);
    await conversation.send('Reused');
    expect(snapshot().loaded).toBe(true);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('cancels queued chat mutations before their first asynchronous continuation', async () => {
    const { conversation, chats, snapshot } = create({ autoInit: false });
    const existing = await conversation.createChat('Existing');
    const createChat = vi.spyOn(chats, 'createChat');
    const renameChat = vi.spyOn(chats, 'renameChat');
    const deleteChat = vi.spyOn(chats, 'deleteChat');
    const updateMessages = vi.spyOn(chats, 'updateMessages');
    for (const action of [
      () => conversation.createChat('Cancelled'),
      () => conversation.renameChat(existing!.id, 'Cancelled'),
      () => conversation.deleteChat(existing!.id),
      () => conversation.clear(),
      () => conversation.send('Cancelled'),
      () => conversation.selectChat('missing'),
      () => conversation.load()
    ]) {
      const pending = action();
      conversation.interrupt();
      expect(await pending).toBeNull();
    }
    expect(createChat).not.toHaveBeenCalled();
    expect(renameChat).not.toHaveBeenCalled();
    expect(deleteChat).not.toHaveBeenCalled();
    expect(updateMessages).not.toHaveBeenCalled();
    expect(snapshot().chats.map((chat) => chat.title)).toEqual(['Existing']);
  });

  it('restores text file contents after disposal without implying binary attachments were persisted', async () => {
    const { conversation, snapshot } = create();
    await conversation.send('Read', [
      { kind: 'text', name: 'notes.txt', value: 'Remember this' },
      { kind: 'image', value: new Blob(['image'], { type: 'image/png' }) }
    ]);
    conversation.dispose();
    await conversation.load();
    expect(snapshot().messages[0]?.content).toBe('Read\n\nFile: notes.txt\n\nRemember this');
    expect(snapshot().messages[0]).not.toHaveProperty('attachments');
    expect(workflow.restoreSession.mock.lastCall![0][0]).toEqual({
      role: 'user',
      content: 'Read\n\nFile: notes.txt\n\nRemember this'
    });
    expect(snapshot().persistence).toBe('text-only');
  });

  it('shows storage failures and keeps successful generated text available for recovery', async () => {
    const { conversation, chats, snapshot } = create();
    const quota = new DOMException('Storage full', 'QuotaExceededError');
    vi.spyOn(chats, 'updateMessages').mockRejectedValueOnce(quota);
    await expect(conversation.send('Hello')).rejects.toBe(quota);
    expect(snapshot()).toMatchObject({ error: quota, isProcessing: false });
    expect(snapshot().messages.map((item) => item.content)).toEqual(['Hello', 'Hello world']);
    await conversation.send('Recovery');
    expect(chats.state.getSnapshot().activeChat?.messages).toHaveLength(4);
    expect(snapshot().error).toBeNull();
  });

  it('reports stream and preparation failures without persisting incomplete turns', async () => {
    const { conversation, chats, snapshot } = create();
    const error = new Error('native failure');
    workflow.promptStreaming.mockReturnValueOnce(failingTextStream(error));
    const persist = vi.spyOn(chats, 'updateMessages');
    await expect(conversation.send('Fail')).rejects.toBe(error);
    expect(snapshot()).toMatchObject({ messages: [], error, isProcessing: false });
    expect(persist).not.toHaveBeenCalled();
    await expect(
      conversation.send('Unsupported', [{ value: new Blob(['binary'], { type: 'application/zip' }) }])
    ).rejects.toThrow('Unsupported attachment type');
    expect(snapshot().messages).toEqual([]);
  });

  it('checks availability without downloading during automatic load and chat changes', async () => {
    const { nativeCreate, availability } = await useNativeWorkflow('downloadable');
    const { conversation, snapshot } = create({ initialMessages: [message('Saved question')] });
    await conversation.load();
    const first = snapshot().activeChatId!;
    await conversation.createChat('Another chat');
    await conversation.selectChat(first);
    await conversation.clear();
    await conversation.deleteChat(first);
    expect(availability).toHaveBeenCalledTimes(5);
    expect(nativeCreate).not.toHaveBeenCalled();
    expect(snapshot()).toMatchObject({ availability: 'downloadable', isReady: false, error: null });
    expect(await conversation.send('Start download')).toBe('Native response');
    expect(nativeCreate).toHaveBeenCalledOnce();
  });

  it('reuses an automatically prepared available model when the first message creates a chat', async () => {
    const { nativeCreate } = await useNativeWorkflow();
    const { conversation, snapshot } = create();
    await conversation.load();
    expect(nativeCreate).toHaveBeenCalledOnce();
    expect(snapshot().activeChatId).toBeNull();
    const session = await nativeCreate.mock.results[0]!.value;
    expect(await conversation.send('First message')).toBe('Native response');
    expect(nativeCreate).toHaveBeenCalledOnce();
    expect(session.destroy).not.toHaveBeenCalled();
    expect(snapshot().activeChatId).not.toBeNull();
  });

  it('loads storage before explicit creation and reuses that native session with autoCreate disabled', async () => {
    const { nativeCreate } = await useNativeWorkflow('downloadable');
    const onCreateStart = vi.fn();
    const onCreateComplete = vi.fn();
    const { conversation, snapshot } = create({
      autoInit: false,
      autoCreate: false,
      systemPrompt: '  ',
      onCreateStart,
      onCreateComplete
    });
    const instance = await conversation.create();
    expect(instance).toBe(await nativeCreate.mock.results[0]!.value);
    expect(snapshot()).toMatchObject({ loaded: true, isReady: true });
    expect(onCreateStart).toHaveBeenCalledOnce();
    expect(onCreateComplete).toHaveBeenCalledOnce();
    expect(await conversation.send('Use explicit session')).toBe('Native response');
    expect(nativeCreate).toHaveBeenCalledOnce();
    expect(instance!.destroy).not.toHaveBeenCalled();
  });

  it('explicitly restores stored history and system instructions before returning the owned native session', async () => {
    const { nativeCreate } = await useNativeWorkflow('downloadable');
    const onInitComplete = vi.fn();
    const onCreateComplete = vi.fn();
    const { conversation, chats } = create({
      autoInit: false,
      autoCreate: false,
      systemPrompt: 'Keep answers brief',
      onInitComplete,
      onCreateComplete
    });
    await chats.createChat('Existing history', [message('Earlier question'), message('Earlier answer', 'assistant')]);
    const instance = await conversation.create();
    expect(nativeCreate).toHaveBeenCalledTimes(2);
    expect(instance).toBe(await nativeCreate.mock.results[1]!.value);
    expect(nativeCreate.mock.lastCall![0].initialPrompts).toEqual([
      { role: 'system', content: 'Keep answers brief' },
      { role: 'user', content: 'Earlier question' },
      { role: 'assistant', content: 'Earlier answer' }
    ]);
    expect((await nativeCreate.mock.results[0]!.value).destroy).toHaveBeenCalledOnce();
    expect(onInitComplete).toHaveBeenCalledOnce();
    expect(onCreateComplete).toHaveBeenCalledTimes(2);
    expect(await conversation.send('Continue')).toBe('Native response');
    expect(nativeCreate).toHaveBeenCalledTimes(2);
    expect(instance!.destroy).not.toHaveBeenCalled();
  });

  it('propagates explicit history creation failures without reporting creation completion', async () => {
    const { nativeCreate } = await useNativeWorkflow();
    const failure = new Error('Native create failed');
    nativeCreate.mockRejectedValueOnce(failure);
    const complete = vi.fn();
    const { conversation, snapshot } = create({ systemPrompt: 'Instructions', onCreateComplete: complete });
    await expect(conversation.create()).rejects.toBe(failure);
    expect(snapshot()).toMatchObject({ error: failure, isProcessing: false, isReady: false });
    expect(nativeCreate).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
  });

  it('stops explicit creation when a loaded-state observer disposes the conversation', async () => {
    const { nativeCreate } = await useNativeWorkflow();
    const { conversation, snapshot } = create();
    const unsubscribe = conversation.state.subscribe(() => {
      if (snapshot().loaded) {
        unsubscribe();
        conversation.dispose();
      }
    });
    expect(await conversation.create()).toBeNull();
    expect(nativeCreate).not.toHaveBeenCalled();
    expect(snapshot()).toMatchObject({ loaded: false, isReady: false, error: null });
    unsubscribe();
  });

  it('does not publish a selected chat or start restoration after session destruction triggers disposal', async () => {
    const { conversation, snapshot } = create();
    const first = await conversation.createChat('First');
    await conversation.createChat('Second');
    workflow.restoreSession.mockClear();
    let disposed = false;
    const unsubscribe = conversation.state.subscribe(() => {
      if (!snapshot().isReady && !disposed) {
        disposed = true;
        conversation.dispose();
      }
    });
    expect(await conversation.selectChat(first!.id)).toBeNull();
    expect(workflow.restoreSession).not.toHaveBeenCalled();
    expect(snapshot()).toMatchObject({ loaded: false, activeChatId: null, messages: [], error: null });
    unsubscribe();
  });

  it('honors reentrant cancellation before explicit history restoration enters native creation', async () => {
    const { nativeCreate } = await useNativeWorkflow();
    const complete = vi.fn();
    const { conversation, snapshot } = create({
      systemPrompt: 'Instructions',
      onCreateStart: () => conversation.interrupt(),
      onCreateComplete: complete
    });
    expect(await conversation.create()).toBeNull();
    expect(nativeCreate).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect(snapshot()).toMatchObject({ error: null, isProcessing: false, isReady: false });
  });

  it('integrates the real prompt workflow without recreating a model between ordinary turns', async () => {
    const { nativeCreate } = await useNativeWorkflow();
    const { conversation, snapshot } = create({ systemPrompt: 'Helpful' });
    await conversation.send('First');
    const created = nativeCreate.mock.calls.length;
    await conversation.send('Second');
    expect(nativeCreate).toHaveBeenCalledTimes(created);
    expect(snapshot().messages.map((item) => item.content)).toEqual([
      'First',
      'Native response',
      'Second',
      'Native response'
    ]);
    conversation.configure({ systemPrompt: 'New instructions' });
    await conversation.send('Third');
    expect(nativeCreate.mock.lastCall![0].initialPrompts).toEqual([
      { role: 'system', content: 'New instructions' },
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Native response' },
      { role: 'user', content: 'Second' },
      { role: 'assistant', content: 'Native response' }
    ]);
    expect(snapshot()).toMatchObject({
      isReady: true,
      contextWindow: 10000,
      contextUsage: 20,
      contextWindowAvailable: 9980
    });
  });
});
