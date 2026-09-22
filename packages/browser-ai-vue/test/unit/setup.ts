import { createApp, h, nextTick, reactive, type Component } from 'vue';
import { afterEach, beforeEach, vi } from 'vitest';
import type {
  ChatHistorySetup,
  ChatSidebarSetup,
  ContractActions,
  MarkdownRendererSetup,
  PromptApiSetup,
  PromptInputSetup,
  TextToolOptions,
  TextToolResult
} from '../../../../common/tests/unit/index';
import ChatHistory from '../../src/components/ChatHistory.vue';
import ChatSidebar from '../../src/components/ChatSidebar.vue';
import LanguageDetector from '../../src/components/LanguageDetector.vue';
import MarkdownRenderer from '../../src/components/MarkdownRenderer.vue';
import PromptApi from '../../src/components/PromptApi.vue';
import PromptInput from '../../src/components/PromptInput.vue';
import Proofreader from '../../src/components/Proofreader.vue';
import Rewriter from '../../src/components/Rewriter.vue';
import Summarizer from '../../src/components/Summarizer.vue';
import Translator from '../../src/components/Translator.vue';
import Writer from '../../src/components/Writer.vue';

const apps = new Set<ReturnType<typeof createApp>>();

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await nextTick();
};

const baseActions: ContractActions = {
  async click(element) {
    (element as HTMLElement).click();
    await nextTick();
  },
  flush,
  async keyDown(element, init) {
    const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    await nextTick();
    return event;
  },
  async selectFiles(input, files) {
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
  },
  async setValue(element, value) {
    element.value = value;
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    await nextTick();
  }
};

const render = async (component: Component, initialProps: Record<string, unknown> = {}) => {
  const props = reactive({ ...initialProps });
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp({ render: () => h(component, props) });
  apps.add(app);
  app.mount(container);
  await nextTick();
  return {
    props,
    container,
    actions: baseActions,
    async cleanup() {
      if (apps.delete(app)) app.unmount();
      container.remove();
      await nextTick();
    }
  };
};

beforeEach(() => {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      callback(1);
      return 1;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  apps.forEach((app) => app.unmount());
  apps.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

export const setupMarkdownRenderer: MarkdownRendererSetup = (content) => render(MarkdownRenderer, { content });

export const setupChatHistory: ChatHistorySetup = async (options) => {
  const rendered = await render(ChatHistory, { ...options });
  return {
    ...rendered,
    async update(next) {
      Object.assign(rendered.props, next);
      await flush();
    }
  };
};

export const setupChatSidebar: ChatSidebarSetup = async ({
  chats = [],
  activeChatId = null,
  disabled = false
} = {}) => {
  const onCreate = vi.fn();
  const onSelect = vi.fn();
  const onRename = vi.fn();
  const onDelete = vi.fn();
  return {
    ...(await render(ChatSidebar, {
      chats,
      activeChatId,
      disabled,
      onCreate,
      onSelect,
      onRename,
      onDelete
    })),
    onCreate,
    onSelect,
    onRename,
    onDelete
  };
};

export const setupPromptInput: PromptInputSetup = async (options = {}) => {
  const onValueChange = vi.fn();
  const onAttachmentsChange = vi.fn();
  const onSend = vi.fn();
  const onVoice = vi.fn();
  const rendered = await render(PromptInput, {
    ...options,
    modelValue: options.value ?? '',
    attachments: options.attachments ?? [],
    disabled: options.disabled,
    busy: options.busy,
    sendOnEnter: options.sendOnEnter,
    allowAttachments: options.allowAttachments,
    allowVoice: options.allowVoice,
    maxAttachments: options.maxAttachments,
    'onUpdate:modelValue': (value: string) => {
      onValueChange(value);
      rendered.props.modelValue = value;
    },
    'onUpdate:attachments': (attachments: unknown[]) => {
      onAttachmentsChange(attachments);
      rendered.props.attachments = attachments;
    },
    onSend,
    onVoice
  });
  return { ...rendered, onValueChange, onAttachmentsChange, onSend, onVoice };
};

export const setupPromptApi: PromptApiSetup = async (options = {}) => {
  const onMessagesChange = vi.fn();
  const onError = vi.fn();
  const rendered = await render(PromptApi, {
    autoInit: false,
    chatKey: `shared-contract-${crypto.randomUUID()}`,
    ...options,
    'onUpdate:messages': onMessagesChange,
    onError
  });
  await rendered.actions.flush();
  return {
    ...rendered,
    onMessagesChange,
    onError,
    async update(next) {
      Object.assign(rendered.props, next);
      await rendered.actions.flush();
    }
  };
};

const setupTool = async (
  component: Component,
  options: TextToolOptions = {},
  extra: Record<string, unknown> = {}
): Promise<TextToolResult> => {
  const onValueChange = vi.fn();
  const onResult = vi.fn();
  const onError = vi.fn();
  const onProgress = vi.fn();
  const rendered = await render(component, {
    ...options,
    modelValue: options.value ?? '',
    disabled: options.disabled,
    autoInit: true,
    autoCreate: true,
    'onUpdate:modelValue': (value: string) => {
      onValueChange(value);
      rendered.props.modelValue = value;
    },
    onError,
    onProgress,
    onSummary: onResult,
    onWrite: onResult,
    onRewrite: onResult,
    onTranslate: onResult,
    onDetect: onResult,
    onProofread: onResult,
    ...extra
  });
  await rendered.actions.flush();
  return { ...rendered, onValueChange, onResult, onError, onProgress };
};

export const setupSummarizer = (options?: TextToolOptions) => setupTool(Summarizer, options);
export const setupWriter = (options?: TextToolOptions) => setupTool(Writer, options);
export const setupRewriter = (options?: TextToolOptions) => setupTool(Rewriter, options);
export const setupTranslator = (options?: TextToolOptions) =>
  setupTool(Translator, options, {
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    autoTranslate: options?.autoTranslate ?? false
  });
export const setupLanguageDetector = (options?: TextToolOptions) => setupTool(LanguageDetector, options);
export const setupProofreader = (options?: TextToolOptions) => setupTool(Proofreader, options);
