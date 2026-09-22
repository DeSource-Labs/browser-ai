import { TestBed, type ComponentFixture } from '@angular/core/testing';
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
import { BrowserAiChatHistoryComponent } from '../../src/lib/chat-history.component';
import { BrowserAiChatSidebarComponent } from '../../src/lib/chat-sidebar.component';
import { BrowserAiLanguageDetectorComponent } from '../../src/lib/language-detector.component';
import { BrowserAiMarkdownRendererComponent } from '../../src/lib/markdown-renderer.component';
import { BrowserAiPromptApiComponent } from '../../src/lib/prompt-api.component';
import { BrowserAiPromptInputComponent } from '../../src/lib/prompt-input.component';
import { BrowserAiProofreaderComponent } from '../../src/lib/proofreader.component';
import { BrowserAiRewriterComponent } from '../../src/lib/rewriter.component';
import { BrowserAiSummarizerComponent } from '../../src/lib/summarizer.component';
import { BrowserAiTranslatorComponent } from '../../src/lib/translator.component';
import { BrowserAiWriterComponent } from '../../src/lib/writer.component';

const fixtures = new Set<ComponentFixture<unknown>>();

const render = async <T>(component: new (...args: any[]) => T, inputs: Record<string, unknown> = {}) => {
  const fixture = TestBed.createComponent(component);
  fixtures.add(fixture as ComponentFixture<unknown>);
  for (const [name, value] of Object.entries(inputs)) {
    if (value !== undefined) fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const actions: ContractActions = {
    async click(element) {
      (element as HTMLElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    },
    flush,
    async keyDown(element, init) {
      const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      fixture.detectChanges();
      await fixture.whenStable();
      return event;
    },
    async selectFiles(input, files) {
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
    },
    async setValue(element, value) {
      element.value = value;
      element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };

  return {
    fixture,
    instance: fixture.componentInstance,
    container: fixture.nativeElement as HTMLElement,
    actions,
    cleanup() {
      if (fixtures.delete(fixture as ComponentFixture<unknown>)) fixture.destroy();
    }
  };
};

afterEach(() => {
  fixtures.forEach((fixture) => fixture.destroy());
  fixtures.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

export const setupMarkdownRenderer: MarkdownRendererSetup = (content) =>
  render(BrowserAiMarkdownRendererComponent, { content });

export const setupChatHistory: ChatHistorySetup = async (options) => {
  const rendered = await render(BrowserAiChatHistoryComponent, { ...options });
  return {
    ...rendered,
    async update(next) {
      for (const [key, value] of Object.entries(next)) rendered.fixture.componentRef.setInput(key, value);
      await rendered.actions.flush();
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
  const rendered = await render(BrowserAiChatSidebarComponent, { chats, activeChatId, disabled });
  rendered.instance.create.subscribe(onCreate);
  rendered.instance.select.subscribe(onSelect);
  rendered.instance.rename.subscribe(({ id, title }) => onRename(id, title));
  rendered.instance.delete.subscribe(onDelete);
  return { ...rendered, onCreate, onSelect, onRename, onDelete };
};

export const setupPromptInput: PromptInputSetup = async (options = {}) => {
  const onValueChange = vi.fn();
  const onAttachmentsChange = vi.fn();
  const onSend = vi.fn();
  const onVoice = vi.fn();
  const rendered = await render(BrowserAiPromptInputComponent, {
    value: options.value,
    attachments: options.attachments,
    disabled: options.disabled,
    busy: options.busy,
    sendOnEnter: options.sendOnEnter,
    allowAttachments: options.allowAttachments,
    allowVoice: options.allowVoice,
    maxAttachments: options.maxAttachments
  });
  rendered.instance.send.subscribe(onSend);
  rendered.instance.voice.subscribe(onVoice);
  const base = rendered.actions;
  rendered.actions = {
    ...base,
    async click(element) {
      await base.click(element);
      if (element.matches('.prompt-input__remove')) onAttachmentsChange(rendered.instance.attachments());
    },
    async selectFiles(input, files) {
      await base.selectFiles(input, files);
      onAttachmentsChange(rendered.instance.attachments());
    },
    async setValue(element, value) {
      await base.setValue(element, value);
      if (element.matches('textarea')) onValueChange(rendered.instance.value());
    }
  };
  return { ...rendered, onValueChange, onAttachmentsChange, onSend, onVoice };
};

export const setupPromptApi: PromptApiSetup = async (options = {}) => {
  const onMessagesChange = vi.fn();
  const onError = vi.fn();
  const rendered = await render(BrowserAiPromptApiComponent, {
    autoInit: false,
    chatKey: `shared-contract-${crypto.randomUUID()}`,
    ...options
  });
  rendered.instance.requestError.subscribe(onError);
  rendered.instance.messages.subscribe(onMessagesChange);
  await rendered.actions.flush();
  return {
    ...rendered,
    onMessagesChange,
    onError,
    async update(next) {
      for (const [key, value] of Object.entries(next)) rendered.fixture.componentRef.setInput(key, value);
      await rendered.actions.flush();
    }
  };
};

type TextComponent =
  | typeof BrowserAiSummarizerComponent
  | typeof BrowserAiWriterComponent
  | typeof BrowserAiRewriterComponent
  | typeof BrowserAiTranslatorComponent
  | typeof BrowserAiLanguageDetectorComponent
  | typeof BrowserAiProofreaderComponent;

const setupTool = async (
  component: TextComponent,
  options: TextToolOptions = {},
  extra: Record<string, unknown> = {}
): Promise<TextToolResult> => {
  const onValueChange = vi.fn();
  const onResult = vi.fn();
  const onError = vi.fn();
  const onProgress = vi.fn();
  const rendered = await render(component as new (...args: any[]) => any, {
    ...options,
    value: options.value,
    disabled: options.disabled,
    ...extra
  });
  rendered.instance.result.subscribe(onResult);
  rendered.instance.progress.subscribe(onProgress);
  rendered.instance.requestError.subscribe(onError);
  rendered.instance.value.subscribe(onValueChange);
  await rendered.actions.flush();
  return { ...rendered, onValueChange, onResult, onError, onProgress };
};

export const setupSummarizer = (options?: TextToolOptions) => setupTool(BrowserAiSummarizerComponent, options);
export const setupWriter = (options?: TextToolOptions) => setupTool(BrowserAiWriterComponent, options);
export const setupRewriter = (options?: TextToolOptions) => setupTool(BrowserAiRewriterComponent, options);
export const setupTranslator = (options?: TextToolOptions) =>
  setupTool(BrowserAiTranslatorComponent, options, { sourceLanguage: 'en', targetLanguage: 'fr' });
export const setupLanguageDetector = (options?: TextToolOptions) =>
  setupTool(BrowserAiLanguageDetectorComponent, options);
export const setupProofreader = (options?: TextToolOptions) => setupTool(BrowserAiProofreaderComponent, options);
