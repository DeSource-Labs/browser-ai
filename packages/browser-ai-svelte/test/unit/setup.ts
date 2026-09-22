import { tick, type Component } from 'svelte';
import { createClassComponent } from 'svelte/legacy';
import { afterEach, vi } from 'vitest';
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
import ChatHistory from '../../src/lib/ChatHistory.svelte';
import ChatSidebar from '../../src/lib/ChatSidebar.svelte';
import LanguageDetector from '../../src/lib/LanguageDetector.svelte';
import MarkdownRenderer from '../../src/lib/MarkdownRenderer.svelte';
import PromptApi from '../../src/lib/PromptApi.svelte';
import PromptInput from '../../src/lib/PromptInput.svelte';
import Proofreader from '../../src/lib/Proofreader.svelte';
import Rewriter from '../../src/lib/Rewriter.svelte';
import Summarizer from '../../src/lib/Summarizer.svelte';
import Translator from '../../src/lib/Translator.svelte';
import Writer from '../../src/lib/Writer.svelte';

const mounted = new Set<{ $destroy(): void }>();

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await tick();
};

const actions: ContractActions = {
  async click(element) {
    (element as HTMLElement).click();
    await tick();
  },
  flush,
  async keyDown(element, init) {
    const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    await tick();
    return event;
  },
  async selectFiles(input, files) {
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
  },
  async setValue(element, value) {
    element.value = value;
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    await tick();
  }
};

const render = async (component: Component<any>, props: Record<string, unknown> = {}) => {
  const container = document.createElement('div');
  document.body.append(container);
  const instance = createClassComponent({ component, target: container, props });
  mounted.add(instance);
  await tick();
  return {
    container,
    actions,
    async update(next: Record<string, unknown>) {
      instance.$set(next);
      await flush();
    },
    async cleanup() {
      if (mounted.delete(instance)) instance.$destroy();
      container.remove();
    }
  };
};

afterEach(async () => {
  for (const instance of mounted) instance.$destroy();
  mounted.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

export const setupMarkdownRenderer: MarkdownRendererSetup = (content) => render(MarkdownRenderer, { content });

export const setupChatHistory: ChatHistorySetup = (options) => render(ChatHistory, { ...options });

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
    ...(await render(ChatSidebar, { chats, activeChatId, disabled, onCreate, onSelect, onRename, onDelete })),
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
  return {
    ...(await render(PromptInput, {
      value: options.value,
      attachments: options.attachments,
      disabled: options.disabled,
      busy: options.busy,
      sendOnEnter: options.sendOnEnter,
      allowAttachments: options.allowAttachments,
      allowVoice: options.allowVoice,
      maxAttachments: options.maxAttachments,
      onValueChange,
      onAttachmentsChange,
      onSend,
      onVoice
    })),
    onValueChange,
    onAttachmentsChange,
    onSend,
    onVoice
  };
};

export const setupPromptApi: PromptApiSetup = async (options = {}) => {
  const onMessagesChange = vi.fn();
  const onError = vi.fn();
  const rendered = await render(PromptApi, {
    autoInit: false,
    chatKey: `shared-contract-${crypto.randomUUID()}`,
    ...options,
    onMessagesChange,
    onError
  });
  await rendered.actions.flush();
  return { ...rendered, onMessagesChange, onError };
};

const setupTool = async (
  component: Component<any>,
  options: TextToolOptions = {},
  extra: Record<string, unknown> = {}
): Promise<TextToolResult> => {
  const onValueChange = vi.fn();
  const onResult = vi.fn();
  const onError = vi.fn();
  const onProgress = vi.fn();
  return {
    ...(await render(component, {
      ...options,
      value: options.value,
      disabled: options.disabled,
      onValueChange,
      onResult,
      onError,
      onProgress,
      ...extra
    })),
    onValueChange,
    onResult,
    onProgress,
    onError
  };
};

export const setupSummarizer = (options?: TextToolOptions) => setupTool(Summarizer, options);
export const setupWriter = (options?: TextToolOptions) => setupTool(Writer, options);
export const setupRewriter = (options?: TextToolOptions) => setupTool(Rewriter, options);
export const setupTranslator = (options?: TextToolOptions) =>
  setupTool(Translator, options, { sourceLanguage: 'en', targetLanguage: 'fr' });
export const setupLanguageDetector = (options?: TextToolOptions) => setupTool(LanguageDetector, options);
export const setupProofreader = (options?: TextToolOptions) => setupTool(Proofreader, options);
