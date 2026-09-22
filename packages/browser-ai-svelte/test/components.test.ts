import { mount, tick, unmount, type Component } from 'svelte';
import { createClassComponent } from 'svelte/legacy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserAiStore } from '@desource/browser-ai';
import * as conversation from '@desource/browser-ai/conversation';
import ChatSidebar from '../src/lib/ChatSidebar.svelte';
import LanguageDetector from '../src/lib/LanguageDetector.svelte';
import MarkdownRenderer from '../src/lib/MarkdownRenderer.svelte';
import PromptApi from '../src/lib/PromptApi.svelte';
import PromptInput from '../src/lib/PromptInput.svelte';
import Proofreader from '../src/lib/Proofreader.svelte';
import Rewriter from '../src/lib/Rewriter.svelte';
import Summarizer from '../src/lib/Summarizer.svelte';
import TextTool from '../src/lib/TextTool.svelte';
import Translator from '../src/lib/Translator.svelte';
import Writer from '../src/lib/Writer.svelte';

const mounted = new Set<Record<string, unknown>>();
let promptChatKey = 0;
const mountedTools = new Set<{ $destroy(): void }>();

const renderTool = async (props: Record<string, unknown> = {}) => {
  const container = document.createElement('div');
  document.body.append(container);
  const instance = createClassComponent({
    component: TextTool,
    target: container,
    props: { title: 'Tool', action: 'Run', placeholder: 'Source text', ...props }
  });
  mountedTools.add(instance);
  await settle();
  return {
    container,
    async update(props: Record<string, unknown>) {
      instance.$set(props);
      await settle();
    },
    cleanup() {
      if (mountedTools.delete(instance)) instance.$destroy();
      container.remove();
    }
  };
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const setting = (container: HTMLElement, name: string) => {
  const label = Array.from(container.querySelectorAll('.writing-tool__settings label')).find(
    (label) => label.firstChild?.textContent?.trim() === name
  );
  if (!label) throw new Error(`Missing setting: ${name}`);
  return label.querySelector('input, select, textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
};

const changeSetting = async (container: HTMLElement, name: string, value: string | boolean) => {
  const control = setting(container, name);
  if (typeof value === 'boolean') (control as HTMLInputElement).checked = value;
  else control.value = value;
  control.dispatchEvent(
    new Event(control instanceof HTMLSelectElement || typeof value === 'boolean' ? 'change' : 'input', {
      bubbles: true
    })
  );
  await settle();
};

const submitTool = async (container: HTMLElement) => {
  container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
  await settle();
};

const render = async (component: Component<any>, props: Record<string, unknown> = {}) => {
  const container = document.createElement('div');
  document.body.append(container);
  const inputs =
    component === PromptApi ? { autoInit: false, chatKey: `svelte-components-${++promptChatKey}`, ...props } : props;
  const instance = mount(component, { target: container, props: inputs });
  mounted.add(instance as Record<string, unknown>);
  await tick();
  if (component === PromptApi) await settle();
  return {
    container,
    async cleanup() {
      if (mounted.delete(instance as Record<string, unknown>)) await unmount(instance);
      container.remove();
    }
  };
};

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await tick();
};

const setValue = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
};

const click = async (element: Element) => {
  (element as HTMLElement).click();
  await tick();
};

const selectFiles = async (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await tick();
};

const stream = (...chunks: string[]) =>
  new ReadableStream<string>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    }
  });

beforeEach(() => {
  let url = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => `blob:svelte-${++url}`),
    configurable: true
  });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

afterEach(async () => {
  mountedTools.forEach((instance) => instance.$destroy());
  mountedTools.clear();
  for (const instance of mounted) await unmount(instance);
  mounted.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Svelte presentation components', () => {
  it('renders safe Markdown and updates reactive content', async () => {
    const rendered = await render(MarkdownRenderer, {
      content: '## Result\n\n[Docs](https://example.com) <script>unsafe()</script>'
    });
    expect(rendered.container.querySelector('h2')?.textContent).toBe('Result');
    expect(rendered.container.querySelector('script')).toBeNull();
    expect(rendered.container.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  });

  it('handles prompt typing, keyboard modifiers, files, limits, removal, and cleanup', async () => {
    const onSend = vi.fn();
    const onValueChange = vi.fn();
    const onAttachmentsChange = vi.fn();
    const rendered = await render(PromptInput, {
      allowAttachments: true,
      maxAttachments: 1,
      onSend,
      onValueChange,
      onAttachmentsChange
    });
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await setValue(textarea, 'Hello');
    expect(onValueChange).toHaveBeenCalledWith('Hello');
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(onSend).not.toHaveBeenCalled();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    textarea.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(onSend).toHaveBeenCalledOnce();

    const fileInput = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(fileInput, [
      new File(['one'], 'one.png', { type: 'image/png' }),
      new File(['two'], 'two.png', { type: 'image/png' })
    ]);
    expect(onAttachmentsChange.mock.calls[0]?.[0]).toHaveLength(1);
    expect(rendered.container.querySelector('img[alt="one.png"]')).not.toBeNull();
    await click(rendered.container.querySelector('[aria-label="Remove one.png"]') as Element);
    expect(onAttachmentsChange).toHaveBeenLastCalledWith([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:svelte-1');
  });

  it('renders file attachments and blocks disabled or busy send paths', async () => {
    const onSend = vi.fn();
    const rendered = await render(PromptInput, {
      value: '',
      attachments: [{ id: 'file', name: 'notes.txt', type: 'text/plain' }],
      disabled: true,
      busy: true,
      onSend
    });
    expect(rendered.container.textContent).toContain('notes.txt');
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await click(rendered.container.querySelector('.prompt-input__send') as Element);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('routes sidebar callbacks and active state', async () => {
    const onCreate = vi.fn();
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const rendered = await render(ChatSidebar, {
      chats: [{ id: 'chat', title: 'Planning', updatedAt: 1 }],
      activeChatId: 'chat',
      onCreate,
      onSelect,
      onDelete
    });
    expect(rendered.container.querySelector('.is-active')).not.toBeNull();
    await click(rendered.container.querySelector('[data-browser-ai-action="create"]') as Element);
    await click(rendered.container.querySelector('[data-browser-ai-action="select"]') as Element);
    await click(rendered.container.querySelector('[aria-label="Delete Planning"]') as Element);
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('chat');
    expect(onDelete).toHaveBeenCalledWith('chat');

    const defaults = await render(ChatSidebar);
    await click(defaults.container.querySelector('button') as Element);
  });

  it('runs PromptInput default callbacks and unbounded file selection paths', async () => {
    vi.stubGlobal('crypto', undefined);
    const rendered = await render(PromptInput, { allowAttachments: true });
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await setValue(textarea, 'Default callbacks');
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await selectFiles(input, [new File(['text'], 'notes.txt', { type: 'text/plain' })]);
    await click(rendered.container.querySelector('[aria-label="Remove notes.txt"]') as Element);

    const unowned = await render(PromptInput, {
      attachments: [{ id: 'plain', name: 'plain.txt', type: 'text/plain' }]
    });
    await click(unowned.container.querySelector('[aria-label="Remove plain.txt"]') as Element);
  });
});

const installPromptApi = ({ output = 'Native answer', failure }: { output?: string; failure?: unknown } = {}) => {
  const native = Object.assign(new EventTarget(), {
    contextUsage: 2,
    contextWindow: 128,
    prompt: failure ? vi.fn().mockRejectedValue(failure) : vi.fn().mockResolvedValue(output),
    promptStreaming: failure
      ? vi.fn().mockReturnValue(
          new ReadableStream<string>({
            pull(controller) {
              controller.error(failure);
            }
          })
        )
      : vi.fn().mockReturnValue(stream('Native ', 'answer')),
    append: vi.fn(),
    measureContextUsage: vi.fn().mockResolvedValue(1),
    clone: vi.fn(),
    destroy: vi.fn()
  });
  const create = vi.fn().mockResolvedValue(native);
  vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available'), create });
  return { native, create };
};

describe('Svelte PromptApi', () => {
  it('renders background conversation errors and clears them when the controller recovers', async () => {
    const api = conversation.createConversation({ autoInit: false });
    const state = createBrowserAiStore(api.state.getSnapshot());
    vi.spyOn(conversation, 'createConversation').mockReturnValue({
      ...api,
      state,
      load: vi.fn().mockResolvedValue(null)
    });
    const rendered = await render(PromptApi);
    state.update({ error: new Error('Summary cache could not be saved') });
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Summary cache could not be saved');
    state.update({ error: 'Storage failed' });
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Browser AI request failed.');
    state.update({ error: null });
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
  });

  it('preserves edits and newly attached files made while an earlier prompt is running', async () => {
    const pending = deferred<string>();
    const { native } = installPromptApi();
    native.prompt.mockReturnValueOnce(pending.promise);
    const rendered = await render(PromptApi, { streaming: false });
    const textarea = rendered.container.querySelector('textarea')!;
    const fileInput = rendered.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await setValue(textarea, 'First prompt');
    await selectFiles(fileInput, [new File(['old'], 'first.png', { type: 'image/png' })]);
    await click(rendered.container.querySelector('.prompt-input__send')!);
    await settle();
    expect(native.prompt).toHaveBeenCalledOnce();
    expect(textarea.value).toBe('First prompt');
    await setValue(textarea, 'Second prompt');
    await selectFiles(fileInput, [new File(['new'], 'second.png', { type: 'image/png' })]);
    pending.resolve('First response');
    await settle();
    expect(textarea.value).toBe('Second prompt');
    expect(rendered.container.querySelector('.prompt-input img[alt="first.png"]')).toBeNull();
    expect(rendered.container.querySelector('.prompt-input img[alt="second.png"]')).not.toBeNull();
    expect(rendered.container.querySelector('.chat-history img[alt="first.png"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('First response');
  });

  it('streams text and reports message updates', async () => {
    const { native } = installPromptApi();
    const onMessagesChange = vi.fn();
    const rendered = await render(PromptApi, { onMessagesChange });
    await setValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Hello model');
    await click(rendered.container.querySelector('.prompt-input__send') as Element);
    await settle();
    expect(native.promptStreaming).toHaveBeenCalledWith(
      'Hello model',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(rendered.container.textContent).toContain('Native answer');
    const final = onMessagesChange.mock.calls[onMessagesChange.mock.calls.length - 1]?.[0];
    expect(final[1]).toMatchObject({ role: 'assistant', content: 'Native answer' });
  });

  it('uses non-streaming multimodal input and keeps cloned history URLs alive', async () => {
    const { native } = installPromptApi({ output: 'Image inspected' });
    const rendered = await render(PromptApi, { streaming: false });
    await selectFiles(rendered.container.querySelector('input[type="file"]') as HTMLInputElement, [
      new File(['pixels'], 'scene.png', { type: 'image/png' })
    ]);
    await click(rendered.container.querySelector('.prompt-input__send') as Element);
    await settle();
    expect(native.prompt).toHaveBeenCalled();
    expect(rendered.container.querySelector('img[alt="scene.png"]')?.getAttribute('src')).toBe('blob:svelte-2');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:svelte-1');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:svelte-2');
    await rendered.cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:svelte-2');
  });

  it('retains failed draft attachments for retry and clears them after a successful response', async () => {
    const failure = new Error('model failed');
    const { native } = installPromptApi({ failure });
    const onError = vi.fn();
    const rendered = await render(PromptApi, { streaming: false, onError });
    await setValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Fail');
    await selectFiles(rendered.container.querySelector<HTMLInputElement>('input[type="file"]')!, [
      new File(['pixels'], 'retry.png', { type: 'image/png' })
    ]);
    await click(rendered.container.querySelector('.prompt-input__send') as Element);
    await settle();
    expect(rendered.container.textContent).toContain('model failed');
    expect(onError).toHaveBeenCalledWith(failure);
    expect(rendered.container.querySelector('textarea')?.value).toBe('Fail');
    expect(rendered.container.querySelector('.prompt-input img[alt="retry.png"]')).not.toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:svelte-1');
    native.prompt.mockResolvedValue('Recovered response');
    await click(rendered.container.querySelector('.prompt-input__send')!);
    await settle();
    expect(rendered.container.querySelector('textarea')?.value).toBe('');
    expect(rendered.container.querySelector('.prompt-input__attachments')).toBeNull();
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    expect(rendered.container.textContent).toContain('Recovered response');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:svelte-1');
  });

  it('uses fallback request text and blocks empty or disabled sends', async () => {
    vi.stubGlobal('crypto', undefined);
    installPromptApi({ failure: 'request failed' });
    const fallback = await render(PromptApi, { streaming: false });
    await setValue(fallback.container.querySelector('textarea') as HTMLTextAreaElement, 'Fail');
    await click(fallback.container.querySelector('.prompt-input__send') as Element);
    await settle();
    expect(fallback.container.textContent).toContain('Browser AI request failed');

    const native = installPromptApi().native;
    const empty = await render(PromptApi);
    await click(empty.container.querySelector('.prompt-input__send') as Element);
    expect(native.prompt).not.toHaveBeenCalled();
    const disabled = await render(PromptApi, { disabled: true });
    await setValue(disabled.container.querySelector('textarea') as HTMLTextAreaElement, 'Blocked');
    await click(disabled.container.querySelector('.prompt-input__send') as Element);
    expect(native.prompt).not.toHaveBeenCalled();
  });

  it('honors explicit expected inputs and attachment opt-out', async () => {
    const first = installPromptApi();
    const expectedInputs: LanguageModelExpected[] = [{ type: 'text' }];
    const explicit = await render(PromptApi, { modelOptions: { expectedInputs } });
    await setValue(explicit.container.querySelector('textarea') as HTMLTextAreaElement, 'Explicit inputs');
    await click(explicit.container.querySelector('.prompt-input__send') as Element);
    await settle();
    expect(first.create).toHaveBeenCalledWith(expect.objectContaining({ expectedInputs }));
    await explicit.cleanup();

    const textOnly = await render(PromptApi, { allowAttachments: false });
    expect(textOnly.container.querySelector('input[type="file"]')).toBeNull();
  });
});

const installTextApi = (name: string, overrides: Record<string, unknown> = {}) => {
  const native = {
    inputQuota: 1024,
    measureInputUsage: vi.fn().mockResolvedValue(5),
    summarize: vi.fn().mockResolvedValue('Short summary'),
    summarizeStreaming: vi.fn().mockReturnValue(stream('Short ', 'summary')),
    write: vi.fn().mockResolvedValue('Draft'),
    writeStreaming: vi.fn().mockReturnValue(stream('Generated ', 'draft')),
    rewrite: vi.fn().mockResolvedValue('Rewrite'),
    rewriteStreaming: vi.fn().mockReturnValue(stream('Clear ', 'rewrite')),
    translate: vi.fn().mockResolvedValue('Bonjour'),
    translateStreaming: vi.fn().mockReturnValue(stream('Bon', 'jour')),
    detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'en', confidence: 0.96 }]),
    proofread: vi.fn().mockResolvedValue({ correctedInput: 'Correct text.', corrections: [] }),
    destroy: vi.fn(),
    ...overrides
  };
  vi.stubGlobal(name, {
    availability: vi.fn().mockResolvedValue('available'),
    create: vi.fn().mockResolvedValue(native)
  });
  return native;
};

describe('Svelte text tools', () => {
  it.each([
    ['Summarizer', Summarizer, {}, 'Short summary'],
    ['Writer', Writer, {}, 'Generated draft'],
    ['Rewriter', Rewriter, {}, 'Clear rewrite'],
    ['Translator', Translator, { sourceLanguage: 'en', targetLanguage: 'fr' }, 'Bonjour'],
    ['LanguageDetector', LanguageDetector, {}, 'English (en): 96%'],
    ['Proofreader', Proofreader, {}, 'Correct text.']
  ])('runs %s explicitly and forwards both progress callbacks', async (globalName, component, props, expected) => {
    const native = installTextApi(globalName);
    const availability = vi.fn().mockResolvedValue('available');
    vi.stubGlobal(globalName as string, { availability, create: vi.fn().mockResolvedValue(native) });
    const onProgress = vi.fn();
    const optionProgress = vi.fn();
    const rendered = await render(component as Component<any>, {
      ...(props as Record<string, unknown>),
      autoInit: false,
      runOptions: { onProgress: optionProgress },
      onProgress
    });
    await settle();
    expect(availability).not.toHaveBeenCalled();
    await setValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Input text');
    rendered.container
      .querySelector('form')
      ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(rendered.container.textContent).toContain(expected);
    expect(availability).toHaveBeenCalledOnce();
    expect(optionProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
    expect(onProgress.mock.calls).toEqual(optionProgress.mock.calls);
  });

  it('loads files, mirrors values, and reports file errors', async () => {
    installTextApi('Summarizer');
    const onValueChange = vi.fn();
    const rendered = await render(Summarizer, { value: 'Start', onValueChange });
    await settle();
    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(input, [new File(['Added'], 'notes.txt', { type: 'text/plain' })]);
    await settle();
    expect((rendered.container.querySelector('textarea') as HTMLTextAreaElement).value).toContain('Start\n\nAdded');
    expect(onValueChange).toHaveBeenCalledWith('Start\n\nAdded');

    vi.spyOn(File.prototype, 'text').mockRejectedValueOnce('bad file');
    await selectFiles(input, [new File(['bad'], 'bad.txt', { type: 'text/plain' })]);
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('Could not read file');
  });

  it.each([
    ['Summarizer', Summarizer, { summarize: vi.fn().mockRejectedValue(new Error('summary failed')) }, 'summary failed'],
    ['Writer', Writer, { writeStreaming: vi.fn().mockReturnValue(failingStream('write failed')) }, 'write failed'],
    [
      'Rewriter',
      Rewriter,
      { rewriteStreaming: vi.fn().mockReturnValue(failingStream('rewrite failed')) },
      'rewrite failed'
    ],
    [
      'Translator',
      Translator,
      { translateStreaming: vi.fn().mockReturnValue(failingStream('translate failed')) },
      'translate failed'
    ],
    [
      'LanguageDetector',
      LanguageDetector,
      { detect: vi.fn().mockRejectedValue('failed') },
      'Browser AI request failed'
    ],
    ['Proofreader', Proofreader, { proofread: vi.fn().mockRejectedValue('failed') }, 'Browser AI request failed']
  ])('reports %s failures', async (globalName, component, overrides, expected) => {
    installTextApi(globalName, overrides as Record<string, unknown>);
    const props = globalName === 'Translator' ? { sourceLanguage: 'en', targetLanguage: 'fr' } : {};
    const rendered = await render(component as Component<any>, props);
    await setValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Input');
    rendered.container
      .querySelector('form')
      ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain(expected);
  });

  it('blocks empty, busy, and disabled submissions and formats missing language data', async () => {
    const native = installTextApi('LanguageDetector', {
      detect: vi.fn().mockResolvedValue([{ detectedLanguage: undefined, confidence: undefined }])
    });
    const rendered = await render(LanguageDetector, { disabled: true });
    rendered.container
      .querySelector('form')
      ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(native.detect).not.toHaveBeenCalled();

    const enabled = await render(LanguageDetector);
    await setValue(enabled.container.querySelector('textarea') as HTMLTextAreaElement, '???');
    enabled.container
      .querySelector('form')
      ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(enabled.container.textContent).toContain('Unknown (und): 0%');
  });
});

describe('Svelte TextTool', () => {
  it('lets users toggle automatic translation and follows later prop and callback changes', async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);
    const rendered = await renderTool({
      kind: 'translator',
      value: 'Source',
      availability: 'available',
      autoRunDelay: 1,
      onRun
    });
    const toggle = () =>
      rendered.container.querySelector<HTMLInputElement>('.writing-tool__language-actions input[type="checkbox"]')!;
    expect(toggle().checked).toBe(false);
    expect(onRun).not.toHaveBeenCalled();
    await click(toggle());
    await settle();
    expect(onRun).toHaveBeenCalledOnce();
    await click(toggle());
    await setValue(rendered.container.querySelector('textarea')!, 'Second source');
    await settle();
    expect(onRun).toHaveBeenCalledOnce();
    const nextRun = vi.fn().mockResolvedValue(undefined);
    await rendered.update({ autoRun: true, onRun: nextRun });
    await settle();
    expect(toggle().checked).toBe(true);
    expect(nextRun).toHaveBeenCalledExactlyOnceWith('Second source', expect.any(Object));
    await rendered.update({ autoRun: false });
    expect(toggle().checked).toBe(false);
  });

  it.each([new Error('Automatic request failed'), 'Automatic request failed'])(
    'reports automatic errors once without retrying unchanged input (%s)',
    async (failure) => {
      const onRun = vi.fn().mockRejectedValue(failure);
      const rendered = await renderTool({
        kind: 'translator',
        availability: 'available',
        autoRun: true,
        autoRunDelay: 1,
        onRun
      });
      await setValue(rendered.container.querySelector('textarea')!, 'Source');
      await settle();
      expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe(
        failure instanceof Error ? failure.message : 'Could not complete the request.'
      );
      await rendered.update({ processing: 'translate' });
      await rendered.update({ processing: '' });
      await settle();
      expect(onRun).toHaveBeenCalledOnce();
      onRun.mockResolvedValue(undefined);
      await setValue(rendered.container.querySelector('textarea')!, 'Corrected source');
      await settle();
      expect(onRun).toHaveBeenCalledTimes(2);
      expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    }
  );

  it.each([new Error('Download denied'), 'Download denied'])(
    'reports pack preparation failures and clears them on the next attempt (%s)',
    async (failure) => {
      const onPrepare = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
      const onRun = vi.fn();
      const rendered = await renderTool({
        kind: 'translator',
        availability: 'downloadable',
        createOptions: { sourceLanguage: 'en', targetLanguage: 'de' },
        onPrepare,
        onRun
      });
      const download = () =>
        [...rendered.container.querySelectorAll('button')].find((button) => button.textContent === 'Download pack')!;
      await click(download());
      await settle();
      expect(onPrepare).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ createOptions: { sourceLanguage: 'en', targetLanguage: 'de' } })
      );
      expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe(
        failure instanceof Error ? failure.message : 'Could not prepare the language pair.'
      );
      await click(download());
      await settle();
      expect(onPrepare).toHaveBeenCalledTimes(2);
      expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
      expect(onRun).not.toHaveBeenCalled();
    }
  );

  it('allows a new request after Stop even while the cancelled native request is pending', async () => {
    const pending = deferred<void>();
    const onRun = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
    const onInterrupt = vi.fn();
    const rendered = await renderTool({ value: 'First', onRun, onInterrupt });
    await submitTool(rendered.container);
    const stop = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Stop'
    )!;
    await click(stop);
    await settle();
    expect(onInterrupt).toHaveBeenCalledOnce();
    expect((rendered.container.querySelector('[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
    await rendered.update({ value: 'Second' });
    await submitTool(rendered.container);
    expect(onRun).toHaveBeenLastCalledWith('Second', { createOptions: {}, runOptions: {} });
    pending.reject(new Error('Cancelled request failed late'));
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
  });

  it('submits edited create and run settings, preserving overrides until external options change', async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);
    const onCheckAvailability = vi.fn().mockResolvedValue('downloadable');
    const rendered = await renderTool({
      kind: 'writer',
      value: '  Draft  ',
      createOptions: { tone: 'casual' },
      runOptions: { context: 'Original' },
      onRun,
      onCheckAvailability,
      availability: 'downloadable'
    });
    expect((rendered.container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('  Draft  ');
    expect(rendered.container.querySelector('[type="submit"]')?.textContent).toContain('Download & run');
    expect(onCheckAvailability).toHaveBeenCalledWith(expect.objectContaining({ tone: 'casual' }));
    expect(onRun).not.toHaveBeenCalled();
    await changeSetting(rendered.container, 'Tone', 'formal');
    await changeSetting(rendered.container, 'Additional context', 'New context');
    await changeSetting(rendered.container, 'Strip HTML', false);
    await submitTool(rendered.container);
    expect(onRun).toHaveBeenLastCalledWith(
      'Draft',
      expect.objectContaining({
        createOptions: expect.objectContaining({ tone: 'formal' }),
        runOptions: expect.objectContaining({ context: 'New context', stripHtml: false })
      })
    );
    await rendered.update({ createOptions: { tone: 'casual' } });
    expect(setting(rendered.container, 'Tone').value).toBe('formal');
    await rendered.update({ runOptions: { context: 'Replacement' } });
    expect(setting(rendered.container, 'Tone').value).toBe('casual');
    expect(setting(rendered.container, 'Additional context').value).toBe('Replacement');
  });

  it('edits language lists, numeric limits, and correction settings through native controls', async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);
    const rendered = await renderTool({
      kind: 'language-detector',
      value: 'Bonjour',
      createOptions: { expectedInputLanguages: ['en', 'fr'] },
      onRun
    });
    expect(setting(rendered.container, 'Expected languages').value).toBe('en, fr');
    await changeSetting(rendered.container, 'Expected languages', 'es, de');
    await changeSetting(rendered.container, 'Confidence', '0.75');
    await changeSetting(rendered.container, 'Results', '3');
    await submitTool(rendered.container);
    expect(onRun).toHaveBeenLastCalledWith(
      'Bonjour',
      expect.objectContaining({
        createOptions: expect.objectContaining({ expectedInputLanguages: ['es', 'de'] }),
        runOptions: expect.objectContaining({ minConfidence: 0.75, maxResults: 3 })
      })
    );
    await rendered.update({ kind: 'proofreader', createOptions: { expectedInputLanguages: null } });
    await changeSetting(rendered.container, 'Correction types', true);
    await changeSetting(rendered.container, 'Explanations', true);
    await changeSetting(rendered.container, 'Explanation language', 'fr');
    await submitTool(rendered.container);
    expect(onRun).toHaveBeenLastCalledWith(
      'Bonjour',
      expect.objectContaining({
        createOptions: expect.objectContaining({
          includeCorrectionTypes: true,
          includeCorrectionExplanations: true,
          correctionExplanationLanguage: 'fr'
        })
      })
    );
  });

  it('shows progress and corrections, blocks busy controls, and keeps Stop available', async () => {
    const onInterrupt = vi.fn();
    const onRun = vi.fn();
    const read = vi.spyOn(File.prototype, 'text');
    const rendered = await renderTool({
      kind: 'proofreader',
      value: 'teh',
      output: 'the',
      processing: 'proofread',
      downloadProgress: 42.4,
      inputUsage: 8,
      inputQuota: 100,
      progressState: { phase: 'proofreading', processedChunks: 1, totalChunks: 3 },
      corrections: [
        { original: '<b>teh</b>', correction: 'the', types: ['spelling'], explanation: 'Spelling fix' },
        { original: '', correction: '.', types: [], explanation: '' }
      ],
      onInterrupt,
      onRun
    });
    expect(rendered.container.querySelector('.writing-tool__footer')?.textContent).toContain('8 / 100 tokens');
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain('42%');
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain('1/3');
    expect(rendered.container.querySelector('del')?.textContent).toBe('<b>teh</b>');
    expect(rendered.container.querySelector('del b')).toBeNull();
    expect(rendered.container.querySelector('[aria-label="Corrections"]')?.textContent).toContain('Spelling fix');
    for (const control of rendered.container.querySelectorAll('textarea, input, select'))
      expect((control as HTMLInputElement).disabled).toBe(true);
    await changeSetting(rendered.container, 'Correction types', true);
    await submitTool(rendered.container);
    const file = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(file, [new File(['Blocked'], 'blocked.txt', { type: 'text/plain' })]);
    expect(read).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
    const stop = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Stop'
    )!;
    await click(stop);
    expect(onInterrupt).toHaveBeenCalledOnce();
    await rendered.update({
      disabled: true,
      progressState: { phase: 'creating', totalChunks: 3 },
      downloadProgress: 100
    });
    expect(stop.disabled).toBe(true);
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain('0/3');
    await rendered.update({ processing: '', disabled: false, progressState: undefined, corrections: [] });
    await submitTool(rendered.container);
    expect(onRun).toHaveBeenCalledWith(
      'teh',
      expect.objectContaining({ createOptions: expect.objectContaining({ includeCorrectionTypes: false }) })
    );
  });

  it('recovers from current availability errors and ignores obsolete checks', async () => {
    const stale = deferred<Availability>();
    const current = deferred<Availability>();
    const onCheckAvailability = vi
      .fn()
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(current.promise)
      .mockResolvedValue('available');
    const rendered = await renderTool({ kind: 'writer', onCheckAvailability });
    await changeSetting(rendered.container, 'Tone', 'formal');
    stale.reject(new Error('Old options failed'));
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    current.reject('not available');
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Could not check availability.');
    await changeSetting(rendered.container, 'Tone', 'casual');
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    const late = deferred<Availability>();
    await rendered.update({ onCheckAvailability: () => late.promise });
    rendered.cleanup();
    late.reject(new Error('Unmounted check'));
    await settle();
  });

  it('copies plain output, resets feedback, and suppresses obsolete clipboard results', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const rendered = await renderTool({ output: 'Visible output', outputText: 'Copy this' });
    const copy = () => rendered.container.querySelector('.writing-tool__pane--output button') as HTMLButtonElement;
    await click(copy());
    await settle();
    expect(writeText).toHaveBeenCalledWith('Copy this');
    expect(copy().textContent).toBe('Copied');
    await rendered.update({ outputText: undefined });
    expect(copy().textContent).toBe('Copy output');
    writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
    await click(copy());
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Clipboard denied');
    writeText.mockRejectedValueOnce('blocked');
    await click(copy());
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Could not copy the result.');
    const stale = deferred<void>();
    writeText.mockReturnValueOnce(stale.promise);
    await click(copy());
    await rendered.update({ output: 'Replacement', error: 'External error' });
    stale.reject(new Error('Obsolete clipboard failure'));
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('External error');
    const late = deferred<void>();
    writeText.mockReturnValueOnce(late.promise);
    await click(copy());
    rendered.cleanup();
    late.resolve();
    await settle();
  });

  it('appends completed files to the latest input and keeps newer selections authoritative', async () => {
    const first = deferred<string>();
    const stale = deferred<string>();
    vi.spyOn(File.prototype, 'text')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce('Newest');
    const onValueChange = vi.fn();
    const rendered = await renderTool({ value: 'Seed', onValueChange });
    const file = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(file, [new File([''], 'first.txt', { type: 'text/plain' })]);
    await setValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Edited while reading');
    first.resolve('First');
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith('Edited while reading\n\nFirst');
    await selectFiles(file, [new File([''], 'old.txt', { type: 'text/plain' })]);
    await selectFiles(file, [new File([''], 'new.txt', { type: 'text/plain' })]);
    await settle();
    stale.reject(new Error('Old file failed'));
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    expect((rendered.container.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'Edited while reading\n\nFirst\n\nNewest'
    );
    expect(file.value).toBe('');
  });

  it.each(['disabled', 'processing', 'unmount'] as const)(
    'ignores pending file success and failure after %s',
    async (mode) => {
      for (const outcome of ['resolve', 'reject']) {
        const pending = deferred<string>();
        vi.spyOn(File.prototype, 'text').mockReturnValueOnce(pending.promise);
        const onValueChange = vi.fn();
        const rendered = await renderTool({ value: 'Seed', onValueChange });
        const file = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
        await selectFiles(file, [new File([''], 'pending.txt', { type: 'text/plain' })]);
        if (mode === 'unmount') rendered.cleanup();
        else await rendered.update(mode === 'disabled' ? { disabled: true } : { processing: 'write' });
        if (outcome === 'resolve') pending.resolve('Late');
        else pending.reject(new Error('Late failure'));
        await settle();
        expect(onValueChange).not.toHaveBeenCalled();
        expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
        expect(file.value).toBe('');
        rendered.cleanup();
      }
    }
  );

  it('handles absent files, optional callbacks, failed requests, and pending unmounts', async () => {
    const rendered = await renderTool();
    await submitTool(rendered.container);
    await setValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Input');
    await submitTool(rendered.container);
    const file = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(file, 'files', { value: null, configurable: true });
    file.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    vi.spyOn(File.prototype, 'text').mockRejectedValueOnce(new Error('Read failed'));
    await selectFiles(file, [new File([''], 'bad.txt', { type: 'text/plain' })]);
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Read failed');
    await rendered.update({
      onRun: async () => {
        throw 'Request failed';
      }
    });
    await submitTool(rendered.container);
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Could not complete the request.');
    const pending = deferred<void>();
    const onRun = vi.fn(() => pending.promise);
    await rendered.update({ onRun });
    await submitTool(rendered.container);
    await submitTool(rendered.container);
    expect(onRun).toHaveBeenCalledOnce();
    rendered.cleanup();
    pending.reject(new Error('Unmounted request'));
    await settle();
  });
});

function failingStream(message: string) {
  return new ReadableStream<string>({
    pull(controller) {
      controller.error(new Error(message));
    }
  });
}
