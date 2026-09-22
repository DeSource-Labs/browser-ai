import { describe, expect, it, vi, type Mock } from 'vitest';
import { deferred, emitDownloadProgress } from '../helpers/streams';
import type { ContractMessage, ContractRender } from './types';

export interface PromptApiResult extends ContractRender {
  onError: Mock;
  onMessagesChange: Mock;
  update(options: Partial<PromptApiOptions>): Promise<void>;
}

export interface PromptApiOptions {
  disabled?: boolean;
  streaming?: boolean;
  chatKey?: string;
  autoInit?: boolean;
  initialMessages?: ContractMessage[];
  systemPrompt?: string;
  modelOptions?: LanguageModelCreateCoreOptions;
}

export type PromptApiSetup = (options?: PromptApiOptions) => PromptApiResult | Promise<PromptApiResult>;

const stream = (...chunks: string[]) =>
  new ReadableStream<string>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    }
  });

const installPromptApi = () => {
  const session = Object.assign(new EventTarget(), {
    contextUsage: 2,
    contextWindow: 128,
    prompt: vi.fn().mockResolvedValue('Local answer'),
    promptStreaming: vi.fn().mockImplementation(() => stream('Local ', 'answer')),
    append: vi.fn().mockResolvedValue(undefined),
    measureContextUsage: vi.fn().mockResolvedValue(1),
    clone: vi.fn(),
    destroy: vi.fn()
  });
  vi.stubGlobal('LanguageModel', {
    availability: vi.fn().mockResolvedValue('available'),
    create: vi.fn().mockResolvedValue(session)
  });
  return session;
};

const send = async (rendered: PromptApiResult, text: string) => {
  await rendered.actions.setValue(rendered.container.querySelector('.prompt-input textarea')!, text);
  await rendered.actions.click(rendered.container.querySelector('.prompt-input__send')!);
  await rendered.actions.flush();
};
const button = (container: Element, text: string) =>
  [...container.querySelectorAll('button')].find((element) => element.textContent?.trim() === text)!;
const messages = (rendered: PromptApiResult) => {
  const calls = rendered.onMessagesChange.mock.calls;
  return calls[calls.length - 1]?.[0] as ContractMessage[];
};

export function testPromptApi(setup: PromptApiSetup): void {
  describe('PromptApi shared contract', () => {
    it('uses the common chat structure and streams a controlled message update', async () => {
      const session = installPromptApi();
      const rendered = await setup();
      expect(rendered.container.querySelector('.prompt-api > .prompt-api__main')).not.toBeNull();
      expect(rendered.container.querySelector('.prompt-api__header')).not.toBeNull();
      expect(rendered.container.querySelector('.chat-history')).not.toBeNull();
      expect(rendered.container.querySelector('.prompt-input')).not.toBeNull();
      const textarea = rendered.container.querySelector('textarea')!;
      await rendered.actions.setValue(textarea, 'Hello model');
      await rendered.actions.click(rendered.container.querySelector('.prompt-input__send')!);
      await rendered.actions.flush();
      expect(session.promptStreaming).toHaveBeenCalled();
      expect(rendered.container.textContent).toContain('Local answer');
      const calls = rendered.onMessagesChange.mock.calls;
      const messages = calls[calls.length - 1]?.[0] as ContractMessage[] | undefined;
      expect(messages?.[messages.length - 1]).toMatchObject({ role: 'assistant', content: 'Local answer' });
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('reports unsupported-browser requests without throwing from the UI', async () => {
      vi.stubGlobal('LanguageModel', undefined);
      const rendered = await setup({ streaming: false });
      await rendered.actions.setValue(rendered.container.querySelector('textarea')!, 'Try locally');
      await rendered.actions.click(rendered.container.querySelector('.prompt-input__send')!);
      await rendered.actions.flush();
      expect(rendered.container.textContent).toMatch(/unavailable|not available|not ready|unsupported/i);
      expect(rendered.onError).toHaveBeenCalled();
      expect(rendered.container.querySelector('textarea')!.value).toBe('Try locally');
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('renders initial preview-only attachments without passing URLs to the model', async () => {
      installPromptApi();
      const rendered = await setup({
        streaming: false,
        initialMessages: [
          {
            id: 'preview',
            role: 'user',
            content: 'Earlier image',
            timestamp: 1,
            attachments: [{ id: 'image', name: 'scene.png', type: 'image/png', url: 'https://example.com/scene.png' }]
          }
        ]
      });
      expect(rendered.container.querySelector('.chat-history img')?.getAttribute('src')).toBe(
        'https://example.com/scene.png'
      );
      await send(rendered, 'Continue with text');
      expect(LanguageModel.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          initialPrompts: expect.arrayContaining([{ role: 'user', content: 'Earlier image' }])
        })
      );
      expect(JSON.stringify(vi.mocked(LanguageModel.create).mock.calls)).not.toContain('https://example.com/scene.png');
      expect(rendered.container.querySelector('.chat-history img')?.getAttribute('src')).toBe(
        'https://example.com/scene.png'
      );
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('shows native download progress during a user-initiated model preparation', async () => {
      const session = installPromptApi();
      const creation = deferred<LanguageModel>();
      vi.mocked(LanguageModel.availability).mockResolvedValue('downloadable');
      vi.mocked(LanguageModel.create).mockImplementationOnce((options) => {
        emitDownloadProgress(options!, 40, 100);
        return creation.promise;
      });
      const rendered = await setup({ streaming: false });
      await send(rendered, 'Prepare and answer');
      const progress = rendered.container.querySelector(
        'progress[aria-label="Model download progress"]'
      ) as HTMLProgressElement;
      expect(progress?.value).toBe(40);
      expect(progress.max).toBe(100);
      creation.resolve(session as unknown as LanguageModel);
      await rendered.actions.flush();
      expect(rendered.container.querySelector('progress[aria-label="Model download progress"]')).toBeNull();
      expect(rendered.container.querySelector('textarea')!.value).toBe('');
      expect(rendered.container.textContent).toContain('Local answer');
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('reuses the native session across multiple completed turns', async () => {
      const session = installPromptApi();
      const rendered = await setup({ streaming: false, autoInit: false });
      await send(rendered, 'First question');
      await send(rendered, 'Follow-up question');
      expect(LanguageModel.create).toHaveBeenCalledOnce();
      expect(session.prompt).toHaveBeenNthCalledWith(
        1,
        'First question',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(session.prompt).toHaveBeenNthCalledWith(
        2,
        'Follow-up question',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(messages(rendered).map(({ role, content }) => ({ role, content }))).toEqual([
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'Local answer' },
        { role: 'user', content: 'Follow-up question' },
        { role: 'assistant', content: 'Local answer' }
      ]);
      expect(rendered.onError).not.toHaveBeenCalled();
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('creates, selects, renames, and deletes saved chats with explicit confirmation', async () => {
      installPromptApi();
      const chatKey = `saved-chat-contract-${crypto.randomUUID()}`;
      let rendered = await setup({ chatKey, streaming: false });
      await send(rendered, 'First conversation');
      await rendered.actions.click(rendered.container.querySelector('[data-browser-ai-action="create"]')!);
      await rendered.actions.flush();
      expect(rendered.container.querySelectorAll('.chat-sidebar__item')).toHaveLength(2);
      expect(messages(rendered)).toEqual([]);
      await send(rendered, 'Second conversation');
      await rendered.actions.click(rendered.container.querySelector('[aria-label="Rename New chat"]')!);
      await rendered.actions.setValue(
        rendered.container.querySelector('.chat-sidebar__rename input')!,
        '  Research notes  '
      );
      await rendered.actions.click(rendered.container.querySelector('[data-browser-ai-action="save-rename"]')!);
      await rendered.actions.flush();
      expect(rendered.container.querySelector('.prompt-api__title')?.textContent).toBe('Research notes');
      const firstChat = [...rendered.container.querySelectorAll('[data-browser-ai-action="select"]')].find(
        (element) =>
          (element.querySelector('.chat-sidebar__title')?.textContent ?? element.textContent)?.trim() ===
          'First conversation'
      )!;
      await rendered.actions.click(firstChat);
      await rendered.actions.flush();
      expect(messages(rendered).map(({ content }) => content)).toEqual(['First conversation', 'Local answer']);
      await rendered.actions.click(rendered.container.querySelector('[aria-label="Delete Research notes"]')!);
      const dialog = rendered.container.querySelector('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Delete');
      await rendered.actions.click(button(dialog, 'Cancel'));
      expect(rendered.container.querySelector('[role="dialog"]')).toBeNull();
      expect(rendered.container.querySelectorAll('.chat-sidebar__item')).toHaveLength(2);
      await rendered.actions.click(rendered.container.querySelector('[aria-label="Delete Research notes"]')!);
      await rendered.actions.click(button(rendered.container.querySelector('[role="dialog"]')!, 'Delete'));
      await rendered.actions.flush();
      expect(rendered.container.querySelectorAll('.chat-sidebar__item')).toHaveLength(1);
      expect(rendered.container.querySelector('.prompt-api__title')?.textContent).toBe('First conversation');
      await rendered.cleanup();

      rendered = await setup({ chatKey, streaming: false });
      expect(rendered.container.querySelectorAll('.chat-sidebar__item')).toHaveLength(1);
      expect(messages(rendered).map(({ content }) => content)).toEqual(['First conversation', 'Local answer']);
      await rendered.actions.click(button(rendered.container.querySelector('.prompt-api__header')!, 'Clear chat'));
      await rendered.actions.flush();
      expect(messages(rendered)).toEqual([]);
      expect(rendered.container.querySelectorAll('.chat-sidebar__item')).toHaveLength(1);
      expect(rendered.container.querySelector('.chat-history')?.textContent).not.toContain('Local answer');
      await rendered.cleanup();
      rendered = await setup({ chatKey });
      expect(messages(rendered)).toEqual([]);
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('stops a pending turn, permits another send, and ignores late native output', async () => {
      const session = installPromptApi();
      let finish!: (value: string) => void;
      session.prompt.mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          })
      );
      const rendered = await setup({ streaming: false });
      await send(rendered, 'Interrupted request');
      const signal = session.prompt.mock.calls[0]![1].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
      expect((rendered.container.querySelector('.prompt-input__send') as HTMLButtonElement).disabled).toBe(true);
      await rendered.actions.click(button(rendered.container.querySelector('.prompt-api__header')!, 'Stop'));
      await rendered.actions.flush();
      expect(signal.aborted).toBe(true);
      expect(rendered.container.querySelector('textarea')!.value).toBe('Interrupted request');
      expect(messages(rendered)).toEqual([]);
      await send(rendered, 'Successful request');
      expect(messages(rendered).map(({ content }) => content)).toEqual(['Successful request', 'Local answer']);
      finish('Late answer from interrupted request');
      await rendered.actions.flush();
      expect(messages(rendered).map(({ content }) => content)).toEqual(['Successful request', 'Local answer']);
      expect(session.prompt).toHaveBeenCalledTimes(2);
      expect(rendered.onError).not.toHaveBeenCalled();
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('applies system and model prop changes while preserving visible conversation history', async () => {
      const session = installPromptApi();
      const rendered = await setup({
        streaming: false,
        autoInit: false,
        systemPrompt: 'Answer briefly.',
        modelOptions: { expectedInputs: [{ type: 'text', languages: ['en'] }] },
        initialMessages: [{ id: 'earlier', role: 'assistant', content: 'Earlier answer', timestamp: 1 }]
      });
      expect(messages(rendered).map(({ content }) => content)).toEqual(['Earlier answer']);
      expect(LanguageModel.create).not.toHaveBeenCalled();
      await send(rendered, 'First request');
      expect(LanguageModel.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          expectedInputs: [{ type: 'text', languages: ['en'] }],
          initialPrompts: expect.arrayContaining([
            { role: 'system', content: 'Answer briefly.' },
            { role: 'assistant', content: 'Earlier answer' }
          ])
        })
      );
      await rendered.update({
        systemPrompt: 'Answer in French.',
        modelOptions: { expectedInputs: [{ type: 'text', languages: ['fr'] }] }
      });
      expect(rendered.container.querySelector('.chat-history')?.textContent).toContain('Earlier answer');
      await send(rendered, 'Second request');
      expect(LanguageModel.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          expectedInputs: [{ type: 'text', languages: ['fr'] }],
          initialPrompts: expect.arrayContaining([
            { role: 'system', content: 'Answer in French.' },
            { role: 'user', content: 'First request' }
          ])
        })
      );
      expect(session.prompt).toHaveBeenCalledTimes(2);
      expect(messages(rendered)).toHaveLength(5);
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('disables sending and saved-chat actions while retaining initial messages', async () => {
      const session = installPromptApi();
      const rendered = await setup({
        disabled: true,
        autoInit: false,
        initialMessages: [{ id: 'initial', role: 'assistant', content: 'Saved answer', timestamp: 1 }]
      });
      expect(rendered.container.querySelector('.chat-history')?.textContent).toContain('Saved answer');
      const buttons = [
        ...rendered.container.querySelectorAll<HTMLButtonElement>(
          '.chat-sidebar button, .prompt-api__header button, .prompt-input__send'
        )
      ];
      expect(buttons.length).toBeGreaterThan(3);
      expect(buttons.every((element) => element.disabled)).toBe(true);
      await rendered.actions.click(rendered.container.querySelector('.prompt-input__send')!);
      await rendered.actions.click(rendered.container.querySelector('[data-browser-ai-action="create"]')!);
      expect(session.prompt).not.toHaveBeenCalled();
      expect(session.promptStreaming).not.toHaveBeenCalled();
      expect(messages(rendered)).toHaveLength(1);
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });
  });
}
