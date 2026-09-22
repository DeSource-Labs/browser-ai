import { act, createElement, StrictMode, useState, type ComponentType, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserAiStore } from '@desource/browser-ai';
import * as conversationCore from '@desource/browser-ai/conversation';
import {
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
} from '../src/components';

const roots = new Set<Root>();

const render = async (element: ReactElement) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.add(root);
  await act(() => root.render(element));
  return {
    container,
    async update(next: ReactElement) {
      await act(() => root.render(next));
    },
    async cleanup() {
      if (roots.delete(root)) await act(() => root.unmount());
      container.remove();
    }
  };
};

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
};

const setControlValue = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  await act(() => element.dispatchEvent(new Event('input', { bubbles: true })));
};

const click = async (element: Element) => {
  await act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const selectFiles = async (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  await act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
};

const stream = (...chunks: string[]) =>
  new ReadableStream<string>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    }
  });

beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  let url = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => `blob:react-${++url}`),
    configurable: true
  });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

afterEach(async () => {
  for (const root of roots) await act(() => root.unmount());
  roots.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('React presentation components', () => {
  it('renders safe, linked Markdown', async () => {
    const rendered = await render(
      <MarkdownRenderer content={'## Result\n\n[Docs](https://example.com) <script>unsafe()</script>'} />
    );
    expect(rendered.container.querySelector('h2')?.textContent).toBe('Result');
    expect(rendered.container.querySelector('script')).toBeNull();
    expect(rendered.container.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  });

  it('supports controlled text, keyboard send rules, attachment limits, removal, and URL cleanup', async () => {
    const onSend = vi.fn();
    const onChange = vi.fn();
    const changes: ChatAttachment[][] = [];

    const Harness = () => {
      const [value, setValue] = useState('');
      const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
      return (
        <PromptInput
          value={value}
          attachments={attachments}
          allowAttachments
          maxAttachments={1}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          onAttachmentsChange={(next) => {
            changes.push(next);
            setAttachments(next);
          }}
          onSend={onSend}
        />
      );
    };

    const rendered = await render(<Harness />);
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await setControlValue(textarea, 'Hello');
    expect(onChange).toHaveBeenLastCalledWith('Hello');
    await act(() =>
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }))
    );
    expect(onSend).not.toHaveBeenCalled();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    await act(() => textarea.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(true);
    expect(onSend).toHaveBeenCalledOnce();

    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    const openPicker = vi.spyOn(input, 'click');
    await click(rendered.container.querySelector('[aria-label="Attach files"]') as Element);
    expect(openPicker).toHaveBeenCalledOnce();
    await selectFiles(input, [
      new File(['one'], 'one.png', { type: 'image/png' }),
      new File(['two'], 'two.png', { type: 'image/png' })
    ]);
    expect(changes[changes.length - 1]).toHaveLength(1);
    expect(rendered.container.querySelector('img[alt="one.png"]')).not.toBeNull();
    await click(rendered.container.querySelector('[aria-label="Remove one.png"]') as Element);
    expect(changes[changes.length - 1]).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:react-1');
  });

  it('honors disabled and busy prompt states', async () => {
    const onSend = vi.fn();
    const rendered = await render(
      <PromptInput value="ready" disabled busy onChange={() => undefined} onSend={onSend} />
    );
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await act(() => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    await click(rendered.container.querySelector('.prompt-input__send') as Element);
    expect(onSend).not.toHaveBeenCalled();
    expect((rendered.container.querySelector('.prompt-input__send') as HTMLButtonElement).disabled).toBe(true);
  });

  it('supports optional voice input and disabling Enter-to-send', async () => {
    const onSend = vi.fn();
    const onVoice = vi.fn();
    const rendered = await render(
      <PromptInput
        value="ready"
        allowVoice
        sendOnEnter={false}
        onChange={() => undefined}
        onSend={onSend}
        onVoice={onVoice}
      />
    );
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await act(() => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    await click(rendered.container.querySelector('[aria-label="Start voice input"]') as Element);
    expect(onSend).not.toHaveBeenCalled();
    expect(onVoice).toHaveBeenCalledOnce();
  });

  it('handles unowned files, absent callbacks, and attachment-only keyboard sends', async () => {
    vi.stubGlobal('crypto', undefined);
    const onSend = vi.fn();
    const rendered = await render(
      <PromptInput
        value=""
        attachments={[{ id: 'text', name: 'notes.txt', type: 'text/plain' }]}
        allowAttachments
        onChange={() => undefined}
        onSend={onSend}
      />
    );
    expect(rendered.container.textContent).toContain('notes.txt');
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await act(() => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onSend).toHaveBeenCalledOnce();

    const fileInput = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(() => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
    await selectFiles(fileInput, [new File(['text'], 'new.txt', { type: 'text/plain' })]);
    await rendered.cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:react-1');
  });

  it('routes sidebar actions and omits unavailable actions', async () => {
    const onCreate = vi.fn();
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const rendered = await render(
      <ChatSidebar
        chats={[{ id: 'chat-1', title: 'Planning', updatedAt: 1 }]}
        activeChatId="chat-1"
        onCreate={onCreate}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );
    expect(rendered.container.querySelector('.is-active')).not.toBeNull();
    const buttons = rendered.container.querySelectorAll('button');
    await click(buttons[0] as Element);
    await click(buttons[1] as Element);
    await click(buttons[2] as Element);
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('chat-1');
    expect(onDelete).toHaveBeenCalledWith('chat-1');

    const withoutDelete = await render(
      <ChatSidebar chats={[{ id: 'chat-2', title: 'No delete', updatedAt: 2 }]} activeChatId={null} />
    );
    expect(withoutDelete.container.querySelector('[aria-label^="Delete"]')).toBeNull();
  });
});

const installPromptApi = ({
  output = 'Native answer',
  chunks = ['Native ', 'answer'],
  failure
}: {
  output?: string;
  chunks?: string[];
  failure?: Error;
} = {}) => {
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
      : vi.fn().mockReturnValue(stream(...chunks)),
    append: vi.fn(),
    measureContextUsage: vi.fn().mockResolvedValue(1),
    clone: vi.fn(),
    destroy: vi.fn()
  });
  const create = vi.fn().mockResolvedValue(native);
  vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available'), create });
  return { native, create };
};

describe('React PromptApi', () => {
  it('streams a text response and reports controlled message updates', async () => {
    const { native } = installPromptApi();
    const onMessagesChange = vi.fn();
    const rendered = await render(<PromptApi onMessagesChange={onMessagesChange} />);
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await setControlValue(textarea, 'Hello model');
    await click(rendered.container.querySelector('.prompt-input__send') as Element);
    await settle();
    expect(native.promptStreaming).toHaveBeenCalledWith(
      'Hello model',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(rendered.container.textContent).toContain('Native answer');
    const finalMessages = onMessagesChange.mock.calls[onMessagesChange.mock.calls.length - 1]?.[0];
    expect(finalMessages).toHaveLength(2);
    expect(finalMessages[1]).toMatchObject({ role: 'assistant', content: 'Native answer' });
  });

  it('supports non-streaming multimodal prompts without revoking visible history URLs early', async () => {
    const { native, create } = installPromptApi({ output: 'Image inspected' });
    const rendered = await render(<PromptApi streaming={false} />);
    const fileInput = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(fileInput, [new File(['pixels'], 'scene.png', { type: 'image/png' })]);
    await click(rendered.container.querySelector('.prompt-input__send') as Element);
    await settle();
    expect(native.prompt).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ expectedInputs: [{ type: 'text' }, { type: 'image' }] })
    );
    expect(rendered.container.querySelector('img[alt="scene.png"]')?.getAttribute('src')).toBe('blob:react-2');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:react-1');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:react-2');
    await rendered.cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:react-2');
  });

  it('renders request failures and invokes the error callback', async () => {
    const failure = new Error('model unavailable');
    installPromptApi({ failure });
    const onError = vi.fn();
    const rendered = await render(<PromptApi streaming={false} onError={onError} />);
    await setControlValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Fail');
    await click(rendered.container.querySelector('.prompt-input__send') as Element);
    await settle();
    expect(rendered.container.textContent).toContain('model unavailable');
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('does not send empty or disabled requests', async () => {
    const { native } = installPromptApi();
    const rendered = await render(<PromptApi disabled initialMessages={[]} />);
    await click(rendered.container.querySelector('.prompt-input__send') as Element);
    expect(native.prompt).not.toHaveBeenCalled();
  });

  it('supports text-only model options and non-Error failures', async () => {
    const native = installPromptApi().native;
    native.prompt.mockRejectedValueOnce('request rejected');
    const onError = vi.fn();
    const rendered = await render(
      <PromptApi
        streaming={false}
        allowAttachments={false}
        modelOptions={{ expectedInputs: [{ type: 'text' }] }}
        onError={onError}
      />
    );
    await setControlValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Fail');
    await click(rendered.container.querySelector('.prompt-input__send') as Element);
    await settle();
    expect(rendered.container.textContent).toContain('Browser AI request failed');
    expect(onError).toHaveBeenCalledWith('request rejected');
  });

  it('resets omitted conversation options and callbacks after a prop update', async () => {
    const { native, create } = installPromptApi();
    const onPromptComplete = vi.fn();
    const rendered = await render(
      <PromptApi
        chatKey="react-reset-options"
        autoInit={false}
        streaming={false}
        systemPrompt="Answer in French."
        modelOptions={{ topK: 3 }}
        promptOptions={{ responseConstraint: { type: 'string' } }}
        onPromptComplete={onPromptComplete}
      />
    );
    const send = async (text: string) => {
      await setControlValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, text);
      await click(rendered.container.querySelector('.prompt-input__send')!);
      await settle();
    };
    await send('First request');
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ topK: 3, initialPrompts: [{ role: 'system', content: 'Answer in French.' }] })
    );
    expect(native.prompt).toHaveBeenLastCalledWith(
      'First request',
      expect.objectContaining({ responseConstraint: { type: 'string' } })
    );
    await rendered.update(<PromptApi chatKey="react-reset-options" autoInit={false} streaming={false} />);
    await send('Second request');
    const creation = create.mock.calls[create.mock.calls.length - 1]?.[0];
    expect(creation.topK).toBeUndefined();
    expect(creation.initialPrompts).not.toContainEqual({ role: 'system', content: 'Answer in French.' });
    expect(native.prompt.mock.calls[native.prompt.mock.calls.length - 1]?.[1].responseConstraint).toBeUndefined();
    expect(onPromptComplete).toHaveBeenCalledOnce();
  });

  it('shows and clears background storage errors from the conversation snapshot', async () => {
    const base = conversationCore.createConversation({ autoInit: false });
    const state = createBrowserAiStore(base.state.getSnapshot());
    base.dispose();
    const controller = {
      ...base,
      state,
      load: vi.fn().mockResolvedValue(undefined),
      configure: vi.fn(),
      dispose: vi.fn()
    };
    vi.spyOn(conversationCore, 'createConversation').mockReturnValue(controller);
    const rendered = await render(<PromptApi />);
    await act(() => {
      state.update({ processing: '', modelProcessing: '', error: new Error('Summary cache quota exceeded') });
    });
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Summary cache quota exceeded');
    await act(() => state.update({ error: null }));
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    await rendered.cleanup();
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it.each(['failure', 'cancel'] as const)('retains the draft and its attachments after %s', async (outcome) => {
    const { native } = installPromptApi();
    let fail!: (error: Error) => void;
    native.prompt.mockImplementationOnce(() => new Promise((_resolve, reject) => (fail = reject)));
    const onError = vi.fn();
    const rendered = await render(
      <PromptApi chatKey={`react-retained-${outcome}`} autoInit={false} streaming={false} onError={onError} />
    );
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await setControlValue(textarea, 'Keep my question');
    await selectFiles(rendered.container.querySelector('input[type="file"]') as HTMLInputElement, [
      new File(['pixels'], 'retry.png', { type: 'image/png' })
    ]);
    await click(rendered.container.querySelector('.prompt-input__send')!);
    await settle();
    if (outcome === 'failure') await act(() => fail(new Error('Model failed')));
    else
      await click([...rendered.container.querySelectorAll('button')].find((button) => button.textContent === 'Stop')!);
    await settle();
    expect(textarea.value).toBe('Keep my question');
    expect(rendered.container.querySelector('.prompt-input img[alt="retry.png"]')).not.toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:react-1');
    expect(rendered.container.querySelector('.chat-history')?.textContent).not.toContain('Keep my question');
    expect(onError).toHaveBeenCalledTimes(outcome === 'failure' ? 1 : 0);
  });

  it('does not clear a newer draft or attachment selection when an earlier request succeeds', async () => {
    const { native } = installPromptApi();
    let finish!: (value: string) => void;
    native.prompt.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const rendered = await render(
      <StrictMode>
        <PromptApi chatKey="react-newer-draft" autoInit={false} streaming={false} />
      </StrictMode>
    );
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await setControlValue(textarea, 'First question');
    await selectFiles(rendered.container.querySelector('input[type="file"]') as HTMLInputElement, [
      new File(['pixels'], 'first.png', { type: 'image/png' })
    ]);
    await click(rendered.container.querySelector('.prompt-input__send')!);
    await settle();
    await setControlValue(textarea, 'Next question');
    await selectFiles(rendered.container.querySelector('input[type="file"]') as HTMLInputElement, [
      new File(['pixels'], 'next.png', { type: 'image/png' })
    ]);
    await act(() => finish('First answer'));
    await settle();
    expect(textarea.value).toBe('Next question');
    expect(rendered.container.querySelector('.prompt-input img[alt="next.png"]')).not.toBeNull();
    expect(rendered.container.querySelector('.prompt-input img[alt="first.png"]')).toBeNull();
    expect(rendered.container.querySelector('.chat-history')?.textContent).toContain('First answer');
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

describe('React text tools', () => {
  it.each([
    ['Summarizer', Summarizer],
    ['Writer', Writer],
    ['Rewriter', Rewriter],
    ['Translator', Translator],
    ['LanguageDetector', LanguageDetector],
    ['Proofreader', Proofreader]
  ] as const)(
    'forwards %s progress to both callbacks and defers model checks when autoInit is false',
    async (globalName, Component) => {
      installTextApi(globalName);
      const onProgress = vi.fn();
      const runProgress = vi.fn();
      const rendered = await render(
        createElement(
          Component as ComponentType<{
            value: string;
            autoInit: boolean;
            onProgress: (state: unknown) => void;
            runOptions: { onProgress: (state: unknown) => void };
          }>,
          { value: 'Source', autoInit: false, onProgress, runOptions: { onProgress: runProgress } }
        )
      );
      const factory = (globalThis as unknown as Record<string, { availability: ReturnType<typeof vi.fn> }>)[
        globalName
      ]!;
      expect(factory.availability).not.toHaveBeenCalled();
      await click(rendered.container.querySelector('button[type="submit"]')!);
      await settle();
      expect(factory.availability).toHaveBeenCalled();
      expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
      expect(runProgress.mock.calls).toEqual(onProgress.mock.calls);
    }
  );

  it.each([
    ['Summarizer', Summarizer, 'summarize'],
    ['Writer', Writer, 'writeStreaming'],
    ['Rewriter', Rewriter, 'rewriteStreaming']
  ] as const)(
    'renders %s output according to the chosen Markdown or plain-text format',
    async (globalName, Component, method) => {
      for (const format of ['plain-text', 'markdown'] as const) {
        installTextApi(globalName, {
          [method]: method.endsWith('Streaming')
            ? vi.fn().mockImplementation(() => stream('# Result'))
            : vi.fn().mockResolvedValue('# Result')
        });
        const rendered = await render(<Component value="Source" createOptions={{ format }} />);
        expect(rendered.container.querySelector('.writing-tool__output')?.textContent).toContain('will appear here.');
        await click(rendered.container.querySelector('button[type="submit"]')!);
        await settle();
        const output = rendered.container.querySelector('.writing-tool__output')!;
        if (format === 'markdown') expect(output.querySelector('h1')?.textContent).toBe('Result');
        else {
          expect(output.querySelector('h1')).toBeNull();
          expect(output.textContent).toBe('# Result');
        }
        await rendered.cleanup();
      }
    }
  );

  it.each([
    ['Summarizer', <Summarizer />, 'Summarizer', 'Short summary'],
    ['Writer', <Writer />, 'Writer', 'Generated draft'],
    ['Rewriter', <Rewriter />, 'Rewriter', 'Clear rewrite'],
    ['Translator', <Translator sourceLanguage="en" targetLanguage="fr" />, 'Translator', 'Bonjour'],
    ['LanguageDetector', <LanguageDetector />, 'LanguageDetector', 'English (en): 96%'],
    ['Proofreader', <Proofreader />, 'Proofreader', 'Correct text.']
  ])('runs the %s component against its native API', async (globalName, component, _label, expected) => {
    installTextApi(globalName);
    const rendered = await render(component);
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await setControlValue(textarea, 'Input text');
    await click(rendered.container.querySelector('button[type="submit"]') as Element);
    await settle();
    expect(rendered.container.textContent).toContain(expected);
  });

  it('loads text attachments, mirrors changes, and reports file errors', async () => {
    installTextApi('Summarizer');
    const onValueChange = vi.fn();
    const rendered = await render(<Summarizer value="Start" onValueChange={onValueChange} />);
    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(input, [new File(['Added'], 'notes.txt', { type: 'text/plain' })]);
    await settle();
    expect((rendered.container.querySelector('textarea') as HTMLTextAreaElement).value).toContain('Start\n\nAdded');
    expect(onValueChange).toHaveBeenCalledWith('Start\n\nAdded');

    const text = vi.spyOn(File.prototype, 'text').mockRejectedValueOnce(new Error('file read failed'));
    await selectFiles(input, [new File(['bad'], 'bad.txt', { type: 'text/plain' })]);
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('file read failed');
    text.mockRestore();
  });

  it('surfaces native task failures and blocks empty or disabled submits', async () => {
    installTextApi('Summarizer', { summarize: vi.fn().mockRejectedValue(new Error('summarize failed')) });
    const rendered = await render(<Summarizer />);
    const submit = rendered.container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await setControlValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Input');
    await click(submit);
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('summarize failed');

    const disabled = await render(<Summarizer value="Input" disabled />);
    expect((disabled.container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    ['Writer', <Writer />, { writeStreaming: vi.fn().mockReturnValue(streamFailure('write failed')) }, 'write failed'],
    [
      'Rewriter',
      <Rewriter />,
      { rewriteStreaming: vi.fn().mockReturnValue(streamFailure('rewrite failed')) },
      'rewrite failed'
    ],
    [
      'Translator',
      <Translator sourceLanguage="en" targetLanguage="fr" />,
      { translateStreaming: vi.fn().mockReturnValue(streamFailure('translate failed')) },
      'translate failed'
    ],
    [
      'LanguageDetector',
      <LanguageDetector />,
      { detect: vi.fn().mockRejectedValue('detect failed') },
      'Browser AI request failed'
    ],
    [
      'Proofreader',
      <Proofreader />,
      { proofread: vi.fn().mockRejectedValue(new Error('proofread failed')) },
      'proofread failed'
    ]
  ])('surfaces %s failures', async (globalName, component, overrides, expected) => {
    installTextApi(globalName, overrides);
    const rendered = await render(component);
    await setControlValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Input');
    await click(rendered.container.querySelector('button[type="submit"]') as Element);
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain(expected);
  });

  it('formats missing language fields defensively', async () => {
    installTextApi('LanguageDetector', {
      detect: vi.fn().mockResolvedValue([{ detectedLanguage: undefined, confidence: undefined }])
    });
    const rendered = await render(<LanguageDetector />);
    await setControlValue(rendered.container.querySelector('textarea') as HTMLTextAreaElement, '???');
    await click(rendered.container.querySelector('button[type="submit"]') as Element);
    await settle();
    expect(rendered.container.textContent).toContain('Unknown (und): 0%');
  });
});

function streamFailure(message: string) {
  return new ReadableStream<string>({
    pull(controller) {
      controller.error(new Error(message));
    }
  });
}
