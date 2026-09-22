import { act, createElement, useState, type ComponentType, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
import {
  ChatHistory,
  ChatSidebar,
  LanguageDetector,
  MarkdownRenderer,
  PromptApi,
  PromptInput,
  Proofreader,
  Rewriter,
  Summarizer,
  Translator,
  Writer,
  type ChatAttachment
} from '../../src/components';

const roots = new Set<Root>();

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
};

const actions: ContractActions = {
  async click(element) {
    await act(() => (element as HTMLElement).click());
  },
  flush,
  async keyDown(element, init) {
    const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
    await act(() => element.dispatchEvent(event));
    return event;
  },
  async selectFiles(input, files) {
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    await act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
  },
  async setValue(element, value) {
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    await act(() =>
      element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    );
  }
};

const render = async (element: ReactElement) => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.add(root);
  await act(() => root.render(element));
  return {
    container,
    actions,
    async update(element: ReactElement) {
      await act(() => root.render(element));
    },
    async cleanup() {
      if (roots.delete(root)) await act(() => root.unmount());
      container.remove();
    }
  };
};

afterEach(async () => {
  for (const root of roots) await act(() => root.unmount());
  roots.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

export const setupMarkdownRenderer: MarkdownRendererSetup = (content) => render(<MarkdownRenderer content={content} />);

export const setupChatHistory: ChatHistorySetup = async (options) => {
  let props = options;
  const rendered = await render(<ChatHistory {...props} />);
  return {
    ...rendered,
    async update(next) {
      props = { ...props, ...next };
      await rendered.update(<ChatHistory {...props} />);
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
    ...(await render(
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        disabled={disabled}
        onCreate={onCreate}
        onSelect={onSelect}
        onRename={onRename}
        onDelete={onDelete}
      />
    )),
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
  const Harness = () => {
    const [value, setValue] = useState(options.value ?? '');
    const [attachments, setAttachments] = useState<ChatAttachment[]>(options.attachments ?? []);
    return (
      <PromptInput
        value={value}
        attachments={attachments}
        disabled={options.disabled}
        busy={options.busy}
        sendOnEnter={options.sendOnEnter}
        allowAttachments={options.allowAttachments}
        allowVoice={options.allowVoice}
        maxAttachments={options.maxAttachments}
        onChange={(next) => {
          onValueChange(next);
          setValue(next);
        }}
        onAttachmentsChange={(next) => {
          onAttachmentsChange(next);
          setAttachments(next);
        }}
        onSend={onSend}
        onVoice={onVoice}
      />
    );
  };
  return { ...(await render(<Harness />)), onValueChange, onAttachmentsChange, onSend, onVoice };
};

export const setupPromptApi: PromptApiSetup = async (options = {}) => {
  const onMessagesChange = vi.fn();
  const onError = vi.fn();
  let props = {
    ...options,
    autoInit: options.autoInit ?? false,
    chatKey: options.chatKey ?? `shared-prompt-${crypto.randomUUID()}`
  };
  const rendered = await render(<PromptApi {...props} onMessagesChange={onMessagesChange} onError={onError} />);
  await flush();
  return {
    ...rendered,
    async update(next) {
      props = { ...props, ...next };
      await rendered.update(<PromptApi {...props} onMessagesChange={onMessagesChange} onError={onError} />);
      await flush();
    },
    onMessagesChange,
    onError
  };
};

type Tool = ComponentType<any>;

const setupTool = async (
  Component: Tool,
  options: TextToolOptions = {},
  extra: Record<string, unknown> = {}
): Promise<TextToolResult> => {
  const onValueChange = vi.fn();
  const onResult = vi.fn();
  const onError = vi.fn();
  const onProgress = vi.fn();
  const props = {
    ...options,
    value: options.value,
    disabled: options.disabled,
    onValueChange,
    onResult,
    onError,
    onProgress,
    ...extra
  };
  return {
    ...(await render(createElement(Component, props))),
    onValueChange,
    onResult,
    onError,
    onProgress
  };
};

export const setupSummarizer = (options?: TextToolOptions) => setupTool(Summarizer, options);
export const setupWriter = (options?: TextToolOptions) => setupTool(Writer, options);
export const setupRewriter = (options?: TextToolOptions) => setupTool(Rewriter, options);
export const setupTranslator = (options?: TextToolOptions) =>
  setupTool(Translator, options, { sourceLanguage: 'en', targetLanguage: 'fr' });
export const setupLanguageDetector = (options?: TextToolOptions) => setupTool(LanguageDetector, options);
export const setupProofreader = (options?: TextToolOptions) => setupTool(Proofreader, options);
