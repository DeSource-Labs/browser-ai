import { createApp, h, nextTick, reactive, ref, type ComponentPublicInstance } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserAiAttachment } from '@desource/browser-ai';
import type { ConversationOptions, ConversationState } from '@desource/browser-ai/conversation';
import { createBrowserAiStore } from '../../core/src/store';
import { deferred } from '../../../common/tests/helpers/streams';

const mocks = vi.hoisted(() => ({
  controller: null as unknown as ReturnType<typeof makeController>,
  options: {} as ConversationOptions,
  response: 'Local answer'
}));
vi.mock('@desource/browser-ai/conversation', async () => {
  const view = await import('../../core/src/conversation-view');
  return {
    ...view,
    createConversation: vi.fn((options: ConversationOptions) => {
      mocks.options = options;
      return mocks.controller;
    })
  };
});
import PromptApi from '../src/components/PromptApi.vue';

const makeController = () => {
  const state = createBrowserAiStore<ConversationState>({
    messages: [],
    chats: [],
    activeChatId: null,
    loaded: false,
    processing: '',
    modelProcessing: '',
    isProcessing: false,
    isReady: false,
    error: null,
    persistence: 'text-only',
    availability: null,
    downloadProgress: 0,
    contextWindow: null,
    contextUsage: null,
    contextWindowAvailable: null,
    contextRestoreState: {
      phase: 'idle',
      loadedMessages: 0,
      totalMessages: 0,
      summarizedMessages: 0,
      includedMessages: 0,
      measuredTokens: null
    }
  });
  return {
    state,
    load: vi.fn(async () => {
      state.update({ loaded: true, messages: [...(mocks.options.initialMessages ?? [])] });
    }),
    configure: vi.fn((next: Partial<ConversationOptions>) => {
      mocks.options = { ...mocks.options, ...next };
    }),
    init: vi.fn(async () => 'available' as Availability),
    create: vi.fn(async () => ({ destroy: vi.fn() })),
    send: vi.fn(async (text: string, attachments: readonly BrowserAiAttachment[]) => {
      const before = state.getSnapshot().messages;
      const streaming = mocks.options.streaming ?? true;
      if (typeof mocks.options.promptOptions === 'function')
        mocks.options.promptOptions({ text, attachments, messages: before, streaming });
      const user = { id: `user-${before.length}`, role: 'user' as const, content: text, timestamp: 1, attachments };
      const assistant = { id: `assistant-${before.length}`, role: 'assistant' as const, content: '', timestamp: 2 };
      state.update({
        messages: [...before, user, assistant],
        processing: 'send',
        modelProcessing: 'prompt',
        isProcessing: true,
        isReady: true
      });
      mocks.options.onPromptStart?.({ streaming, input: text });
      await Promise.resolve();
      if (streaming) mocks.options.onStreamChunk?.({ chunk: mocks.response, accumulated: mocks.response });
      state.update({
        messages: [...before, user, { ...assistant, content: mocks.response }],
        processing: '',
        modelProcessing: '',
        isProcessing: false
      });
      mocks.options.onPromptComplete?.({ response: mocks.response, streaming });
      return mocks.response;
    }),
    clear: vi.fn(async (): Promise<void | null> => {
      state.update({ messages: [] });
    }),
    selectChat: vi.fn(async (_id: string) => undefined),
    createChat: vi.fn(async () => undefined),
    renameChat: vi.fn(async (_id: string, _title: string) => undefined),
    deleteChat: vi.fn(async (_id: string) => undefined),
    interrupt: vi.fn(() => state.update({ processing: '', modelProcessing: '', isProcessing: false })),
    dispose: vi.fn(() => state.update({ messages: [], isReady: false, isProcessing: false }))
  };
};
interface PromptApiExpose extends ComponentPublicInstance {
  clear(): Promise<void>;
  create(): Promise<unknown>;
  createChat(): Promise<unknown>;
  init(): Promise<Availability | null>;
  interrupt(): void;
  dispose(): void;
  selectChat(id: string): Promise<unknown>;
  send(): Promise<void>;
}
const apps = new Set<ReturnType<typeof createApp>>();
const flush = async () => {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await nextTick();
};
const mount = async (initial: Record<string, unknown> = {}) => {
  const events = {
    availability: vi.fn(),
    cacheError: vi.fn(),
    clear: vi.fn(),
    contextComplete: vi.fn(),
    contextOverflow: vi.fn(),
    contextProgress: vi.fn(),
    contextStart: vi.fn(),
    createComplete: vi.fn(),
    createStart: vi.fn(),
    download: vi.fn(),
    error: vi.fn(),
    initComplete: vi.fn(),
    initStart: vi.fn(),
    interrupt: vi.fn(),
    messages: vi.fn(),
    processing: vi.fn(),
    promptComplete: vi.fn(),
    promptStart: vi.fn(),
    ready: vi.fn(),
    send: vi.fn(),
    stream: vi.fn(),
    usage: vi.fn(),
    added: vi.fn(),
    draft: vi.fn(),
    attachments: vi.fn(),
    voice: vi.fn()
  };
  const props = reactive({ autoInit: false, ...initial });
  const component = ref<PromptApiExpose>();
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(PromptApi, {
        ...props,
        ref: component,
        onAvailabilityChange: events.availability,
        onSummaryCacheError: events.cacheError,
        onClear: events.clear,
        onContextLoadComplete: events.contextComplete,
        onContextLoadProgress: events.contextProgress,
        onContextLoadStart: events.contextStart,
        onContextOverflow: events.contextOverflow,
        onCreateComplete: events.createComplete,
        onCreateStart: events.createStart,
        onDownloadProgress: events.download,
        onError: events.error,
        onInitComplete: events.initComplete,
        onInitStart: events.initStart,
        onInterrupt: events.interrupt,
        'onUpdate:messages': events.messages,
        onProcessingChange: events.processing,
        onPromptComplete: events.promptComplete,
        onPromptStart: events.promptStart,
        onReadyChange: events.ready,
        onSend: events.send,
        onStreamChunk: events.stream,
        onUsageChange: events.usage,
        onMessageAdded: events.added,
        'onUpdate:draft': events.draft,
        'onUpdate:attachments': events.attachments,
        onVoice: events.voice
      })
  });
  apps.add(app);
  app.mount(container);
  await flush();
  return {
    app,
    container,
    events,
    vm: component.value!,
    update: async (next: Record<string, unknown>) => {
      Object.assign(props, next);
      await flush();
    }
  };
};
const setValue = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
};
const click = async (element: Element) => {
  (element as HTMLElement).click();
  await flush();
};
const setFiles = async (container: HTMLElement, files: File[]) => {
  const input = container.querySelector('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await nextTick();
};
const chat = (id: string, title: string, messages: ConversationState['messages'] = []) => ({
  id,
  title,
  tool: 'test',
  createdAt: 1,
  updatedAt: 2,
  messages: [...messages],
  summaries: []
});

beforeEach(() => {
  mocks.controller = makeController();
  mocks.options = {};
  mocks.response = 'Local answer';
  let url = 0;
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => `blob:prompt-${++url}`), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});
afterEach(() => {
  apps.forEach((app) => app.unmount());
  apps.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PromptApi shared conversation binding', () => {
  it('forwards configuration and lifecycle events while preserving initial preview-only attachments', async () => {
    const view = await mount({
      autoInit: true,
      allowVoice: true,
      systemPrompt: 'Stay concise.',
      initialMessages: [
        {
          id: 'initial',
          role: 'user',
          content: 'Earlier question',
          attachments: [
            { id: 'image', name: 'existing.png', type: 'image/png', url: 'https://example.com/existing.png' }
          ]
        }
      ],
      maxMessages: 4,
      contextBudgetRatio: 0.7
    });
    expect(mocks.options).toMatchObject({
      autoInit: true,
      systemPrompt: 'Stay concise.',
      maxMessages: 4,
      contextBudgetRatio: 0.7,
      initialMessages: [{ id: 'initial', role: 'user', content: 'Earlier question', timestamp: expect.any(Number) }]
    });
    expect(view.container.querySelector('.chat-message__attachment img')?.getAttribute('src')).toBe(
      'https://example.com/existing.png'
    );
    expect(mocks.controller.load).toHaveBeenCalledOnce();
    const state = mocks.controller.state.getSnapshot().contextRestoreState;
    mocks.options.onInitStart!();
    mocks.options.onInitComplete!();
    mocks.options.onCreateStart!();
    mocks.options.onCreateComplete!();
    mocks.options.onContextOverflow!();
    mocks.options.onSummaryCacheError!(new Error('cache failed'));
    mocks.options.onContextStateChange!(state, 'start');
    mocks.options.onContextStateChange!(state, 'progress');
    mocks.options.onContextStateChange!(state, 'complete');
    expect(view.events.initStart).toHaveBeenCalledOnce();
    expect(view.events.initComplete).toHaveBeenCalledOnce();
    expect(view.events.createStart).toHaveBeenCalledOnce();
    expect(view.events.createComplete).toHaveBeenCalledOnce();
    expect(view.events.contextOverflow).toHaveBeenCalledOnce();
    expect(view.events.cacheError).toHaveBeenCalledWith(new Error('cache failed'));
    expect(view.events.contextStart).toHaveBeenCalledWith(state);
    expect(view.events.contextProgress).toHaveBeenCalledWith(state);
    expect(view.events.contextComplete).toHaveBeenCalledWith(state);
    await click(view.container.querySelector('[aria-label="Start voice input"]')!);
    expect(view.events.voice).toHaveBeenCalledOnce();
    await expect(view.vm.init()).resolves.toBe('available');
    await expect(view.vm.create()).resolves.toEqual(expect.objectContaining({ destroy: expect.any(Function) }));
    await view.update({
      modelOptions: { expectedInputs: [{ type: 'text', languages: ['fr'] }] },
      systemPrompt: 'Updated',
      streaming: false
    });
    expect(mocks.controller.configure).toHaveBeenLastCalledWith(
      expect.objectContaining({
        systemPrompt: 'Updated',
        streaming: false,
        modelOptions: { expectedInputs: [{ type: 'text', languages: ['fr'] }] }
      })
    );
  });

  it('sends files through the shared controller, forwards streaming events and owns only generated preview URLs', async () => {
    const promptOptions = vi.fn(() => ({ responseConstraint: { type: 'string' } }));
    const view = await mount({ promptOptions });
    const file = new File(['pixels'], 'scene.png', { type: 'image/png' });
    await setFiles(view.container, [file]);
    await setValue(view.container.querySelector('textarea')!, '  Describe this  ');
    await click(view.container.querySelector('.prompt-input__send')!);
    expect(mocks.controller.send).toHaveBeenCalledWith('Describe this', [
      { id: expect.any(String), name: 'scene.png', type: 'image/png', value: file }
    ]);
    expect(promptOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Describe this',
        attachments: [expect.objectContaining({ file })],
        messages: [],
        streaming: true
      })
    );
    expect(view.events.send).toHaveBeenCalledWith({
      text: 'Describe this',
      attachments: [expect.objectContaining({ file })]
    });
    expect(view.events.added).toHaveBeenCalledTimes(2);
    expect(view.events.promptStart).toHaveBeenCalledWith({ input: 'Describe this', streaming: true });
    expect(view.events.stream).toHaveBeenCalledWith({ chunk: 'Local answer', accumulated: 'Local answer' });
    expect(view.events.promptComplete).toHaveBeenCalledWith({ response: 'Local answer', streaming: true });
    expect(view.events.messages.mock.lastCall![0][1].content).toBe('Local answer');
    expect(view.container.textContent).toContain('Local answer');
    expect((view.container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
    expect(view.events.draft).toHaveBeenCalledWith('');
    expect(view.events.attachments).toHaveBeenLastCalledWith([]);
    expect(view.container.querySelector('.chat-message__attachment img')?.getAttribute('src')).toMatch(/^blob:prompt-/);
    view.vm.dispose();
    expect(mocks.controller.dispose).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('keeps drafts when requested and maps empty responses without mutating stored messages', async () => {
    mocks.response = '';
    const view = await mount({
      streaming: false,
      clearOnSend: false,
      emptyResponseMessage: 'Try a different question.',
      promptOptions: {}
    });
    await setValue(view.container.querySelector('textarea')!, 'Question');
    await view.vm.send();
    await flush();
    expect(view.container.textContent).toContain('Try a different question.');
    expect(mocks.controller.state.getSnapshot().messages[1]?.content).toBe('');
    expect(view.events.promptComplete).toHaveBeenCalledWith({
      response: 'Try a different question.',
      streaming: false
    });
    expect((view.container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Question');
    expect(view.events.stream).not.toHaveBeenCalled();
    await setValue(view.container.querySelector('textarea')!, '');
    await view.vm.send();
    expect(mocks.controller.send).toHaveBeenCalledOnce();
  });

  it('renders progress and context state, guards busy sends, and exposes a visible stop control', async () => {
    const view = await mount({ contextLoadingMessage: 'Loading local context' });
    mocks.controller.state.update({
      availability: 'downloadable',
      downloadProgress: 35,
      modelProcessing: 'create',
      processing: 'load',
      isProcessing: true,
      contextWindow: 128,
      contextUsage: 110,
      contextWindowAvailable: 18,
      contextRestoreState: { ...mocks.controller.state.getSnapshot().contextRestoreState, phase: 'summarizing' }
    });
    await nextTick();
    expect(view.events.availability).toHaveBeenCalledWith('downloadable');
    expect(view.events.download).toHaveBeenCalledWith(35);
    expect(view.events.processing).toHaveBeenCalledWith('create');
    expect(view.events.usage).toHaveBeenCalledWith({
      contextWindow: 128,
      contextUsage: 110,
      contextWindowAvailable: 18
    });
    expect(view.container.textContent).toContain('Compressing earlier messages locally');
    expect(view.container.querySelector('progress')?.value).toBe(35);
    expect(view.container.querySelector('textarea')?.placeholder).toBe('Loading local context');
    await setValue(view.container.querySelector('textarea')!, 'Pending');
    await view.vm.send();
    expect(mocks.controller.send).not.toHaveBeenCalled();
    await click(view.container.querySelector('[data-browser-ai-action="stop"]')!);
    expect(mocks.controller.interrupt).toHaveBeenCalledOnce();
    expect(view.events.interrupt).toHaveBeenCalledOnce();
    mocks.controller.state.update({
      processing: 'restore',
      isProcessing: true,
      modelProcessing: 'measure',
      availability: null
    });
    await nextTick();
    expect(view.container.querySelector('textarea')?.placeholder).toBe('Loading local context');
    mocks.controller.state.update({
      processing: '',
      isProcessing: false,
      modelProcessing: '',
      isReady: true,
      downloadProgress: 100
    });
    await nextTick();
    expect(view.events.ready).toHaveBeenCalledWith(true);
    expect(view.container.querySelector('progress')).toBeNull();
    expect(view.container.querySelector('[data-browser-ai-action="stop"]')).toBeNull();
    await view.update({ disabled: true });
    await view.vm.send();
    expect(mocks.controller.send).not.toHaveBeenCalled();
  });

  it('routes sidebar create/select/rename/delete through the controller and confirms deletion', async () => {
    mocks.controller.state.update({
      chats: [
        chat('one', 'Planning', [{ id: 'm1', role: 'user', content: 'Preview', timestamp: 1 }]),
        chat('two', 'Research')
      ],
      activeChatId: 'one'
    });
    const view = await mount();
    expect(view.container.querySelector('.prompt-api__title')?.textContent).toBe('Planning');
    await view.vm.selectChat('two');
    expect(mocks.controller.selectChat).toHaveBeenCalledWith('two');
    await click(view.container.querySelector('[aria-label="Rename Research"]')!);
    await setValue(view.container.querySelector('.chat-sidebar__rename input')!, 'Evidence');
    await click(view.container.querySelector('[data-browser-ai-action="save-rename"]')!);
    expect(mocks.controller.renameChat).toHaveBeenCalledWith('two', 'Evidence');
    await click(view.container.querySelector('[aria-label="Delete Research"]')!);
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    await click(view.container.querySelectorAll('.prompt-api__dialog button')[0]!);
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    await click(view.container.querySelector('[aria-label="Delete Research"]')!);
    await click(view.container.querySelectorAll('.prompt-api__dialog button')[1]!);
    expect(mocks.controller.deleteChat).toHaveBeenCalledWith('two');
    await click(view.container.querySelector('[data-browser-ai-action="create"]')!);
    expect(mocks.controller.createChat).toHaveBeenCalledOnce();
    await click(view.container.querySelector('[data-browser-ai-action="clear"]')!);
    expect(mocks.controller.clear).toHaveBeenCalledOnce();
    expect(view.events.clear).toHaveBeenCalledOnce();
    mocks.controller.clear.mockResolvedValueOnce(null);
    await view.vm.clear();
    expect(view.events.clear).toHaveBeenCalledOnce();
  });

  it('reports initialization, request and CRUD failures without unhandled UI rejections', async () => {
    mocks.controller.load.mockRejectedValueOnce(new Error('load failed'));
    const view = await mount();
    expect(view.events.error).toHaveBeenCalledWith(new Error('load failed'));
    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe('load failed');
    mocks.controller.init.mockRejectedValueOnce(new Error('init failed'));
    mocks.controller.create.mockRejectedValueOnce(new Error('create failed'));
    await expect(view.vm.init()).rejects.toThrow('init failed');
    await expect(view.vm.create()).rejects.toThrow('create failed');
    mocks.controller.clear.mockRejectedValueOnce(new Error('clear failed'));
    await view.vm.clear();
    expect(view.events.error).toHaveBeenCalledWith(new Error('clear failed'));
    mocks.controller.send.mockRejectedValueOnce('Plain failure');
    await setValue(view.container.querySelector('textarea')!, 'Fail');
    await view.vm.send();
    await flush();
    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe('Browser AI request failed.');
    await view.update({ errorMessage: 'Friendly error' });
    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe('Friendly error');
    await view.update({ errorMessage: () => 'Customized error' });
    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe('Customized error');
    await view.update({ errorMessage: undefined });
    mocks.controller.state.update({ availability: 'unavailable' });
    await nextTick();
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain('unavailable or not ready');
    mocks.controller.selectChat.mockRejectedValueOnce(new Error('select failed'));
    await view.vm.selectChat('missing');
    expect(view.events.error).toHaveBeenCalledWith(new Error('select failed'));
    mocks.controller.createChat.mockRejectedValueOnce(new Error('create chat failed'));
    await view.vm.createChat();
    expect(view.events.error).toHaveBeenCalledWith(new Error('create chat failed'));
  });

  it('interrupts and unsubscribes on unmount while respecting manual session ownership', async () => {
    const view = await mount({ disposeOnUnmount: false });
    mocks.controller.state.update({ processing: 'send', isProcessing: true });
    await nextTick();
    view.app.unmount();
    apps.delete(view.app);
    expect(mocks.controller.interrupt).toHaveBeenCalledOnce();
    expect(mocks.controller.dispose).not.toHaveBeenCalled();
    const emitted = view.events.messages.mock.calls.length;
    mocks.controller.state.update({ messages: [{ id: 'late', role: 'assistant', content: 'Late', timestamp: 1 }] });
    await nextTick();
    expect(view.events.messages).toHaveBeenCalledTimes(emitted);
    const automatic = await mount();
    automatic.app.unmount();
    apps.delete(automatic.app);
    expect(mocks.controller.dispose).toHaveBeenCalledOnce();
  });

  it('keeps an attachment-only request valid and guards a second send during its preparation', async () => {
    const view = await mount();
    const pending = deferred<string>();
    mocks.controller.send.mockImplementationOnce(() => {
      mocks.controller.state.update({ processing: 'send', isProcessing: true });
      return pending.promise;
    });
    const file = new File(['sound'], 'voice.wav', { type: 'audio/wav' });
    await setFiles(view.container, [file]);
    const sent = view.vm.send();
    await view.vm.send();
    expect(mocks.controller.send).toHaveBeenCalledOnce();
    expect(mocks.controller.send).toHaveBeenCalledWith('', [expect.objectContaining({ value: file })]);
    pending.resolve('Done');
    await sent;
  });

  it('keeps newer attachment metadata when an interrupted send settles later', async () => {
    const promptOptions = vi.fn(() => ({}));
    const view = await mount({ promptOptions });
    const old = deferred<string | null>();
    const latest = deferred<string>();
    mocks.controller.send
      .mockImplementationOnce(() => {
        mocks.controller.state.update({ processing: 'send', isProcessing: true });
        return old.promise;
      })
      .mockImplementationOnce(async (text, attachments) => {
        mocks.controller.state.update({ processing: 'send', isProcessing: true });
        await latest.promise;
        const options = mocks.options.promptOptions;
        if (typeof options === 'function') options({ text, attachments, messages: [], streaming: true });
        return 'New response';
      });
    await setFiles(view.container, [new File(['first'], 'first.png', { type: 'image/png' })]);
    const first = view.vm.send();
    view.vm.interrupt();
    await nextTick();
    const file = new File(['second'], 'second.png', { type: 'image/png' });
    await setFiles(view.container, [file]);
    const second = view.vm.send();
    old.resolve(null);
    await first;
    latest.resolve('Ready');
    await second;
    expect(promptOptions).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: expect.arrayContaining([expect.objectContaining({ file })]) })
    );
  });
});
