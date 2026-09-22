import { describe, expect, it, vi } from 'vitest';
import { testTextTool, type TextToolResult, type TextToolSetup } from './_textTool';

const installTranslator = (availability: Availability = 'available') => {
  const translateStreaming = vi.fn(
    (_input: string, _options: { signal: AbortSignal }) =>
      new ReadableStream<string>({
        start(controller) {
          controller.enqueue('Bonjour');
          controller.close();
        }
      })
  );
  const native = Object.assign(new EventTarget(), {
    inputQuota: 4096,
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    measureInputUsage: vi.fn().mockResolvedValue(8),
    translate: vi.fn().mockResolvedValue('Bonjour'),
    translateStreaming,
    destroy: vi.fn()
  });
  const factory = {
    availability: vi.fn().mockResolvedValue(availability),
    create: vi.fn().mockImplementation(async (options: TranslatorCreateOptions) => {
      factory.availability.mockResolvedValue('available');
      return Object.assign(native, {
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage
      });
    })
  };
  vi.stubGlobal('Translator', factory);
  return { native, factory };
};

const flushAutoRun = async (rendered: TextToolResult) => {
  await rendered.actions.flush();
  await rendered.actions.flush();
  await rendered.actions.flush();
};

const button = (container: HTMLElement, label: RegExp) => {
  const element = [...container.querySelectorAll('button')].find((item) => label.test(item.textContent?.trim() ?? ''));
  expect(element).toBeDefined();
  return element!;
};

const language = (container: HTMLElement, label: string) => {
  const element = [...container.querySelectorAll('label')].find((item) => item.textContent?.trim().startsWith(label));
  return element!.querySelector('select')!;
};

export function testTranslator(setup: TextToolSetup): void {
  testTextTool(setup, {
    action: 'Translate',
    emptyOutput: 'Translation will appear here.',
    globalName: 'Translator',
    method: 'translateStreaming',
    output: 'Bonjour',
    outputText: 'Bonjour',
    title: 'Translator'
  });

  describe('Translator editing contract', () => {
    it('automatically translates typed text with a ready pair without repeating after completion', async () => {
      const { native, factory } = installTranslator();
      const rendered = await setup({ value: '', autoTranslate: true, debounceMs: 1 });
      await flushAutoRun(rendered);
      expect(factory.create).not.toHaveBeenCalled();
      await rendered.actions.setValue(rendered.container.querySelector('textarea')!, 'Hello');
      await flushAutoRun(rendered);
      expect(native.translateStreaming).toHaveBeenCalledOnce();
      expect(rendered.onResult).toHaveBeenCalledOnce();
      expect(rendered.container.querySelector('.writing-tool__output')?.textContent).toContain('Bonjour');
      await flushAutoRun(rendered);
      expect(native.translateStreaming).toHaveBeenCalledOnce();
      expect(rendered.onError).not.toHaveBeenCalled();
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('keeps a stopped translation stopped until the source changes', async () => {
      const { native } = installTranslator();
      const cancel = vi.fn();
      native.translateStreaming.mockReturnValueOnce(new ReadableStream<string>({ cancel }));
      const rendered = await setup({ value: '', autoTranslate: true, debounceMs: 1 });
      await flushAutoRun(rendered);
      await rendered.actions.setValue(rendered.container.querySelector('textarea')!, 'First source');
      await flushAutoRun(rendered);
      expect(native.translateStreaming).toHaveBeenCalledOnce();
      const signal = native.translateStreaming.mock.calls[0]![1].signal;
      expect(signal.aborted).toBe(false);
      await rendered.actions.click(button(rendered.container, /^Stop$/));
      await flushAutoRun(rendered);
      expect(signal.aborted).toBe(true);
      expect(cancel).toHaveBeenCalledOnce();
      expect(native.translateStreaming).toHaveBeenCalledOnce();
      expect(rendered.onResult).not.toHaveBeenCalled();
      expect(rendered.onError).not.toHaveBeenCalled();
      await rendered.actions.setValue(rendered.container.querySelector('textarea')!, 'Changed source');
      await flushAutoRun(rendered);
      expect(native.translateStreaming).toHaveBeenCalledTimes(2);
      expect(rendered.onResult).toHaveBeenCalledOnce();
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('swaps both language selectors and uses the reversed pair for the next request', async () => {
      const { factory } = installTranslator();
      const rendered = await setup({ value: '', autoTranslate: false, debounceMs: 1 });
      await flushAutoRun(rendered);
      expect(language(rendered.container, 'From').value).toBe('en');
      expect(language(rendered.container, 'To').value).toBe('fr');
      await rendered.actions.click(button(rendered.container, /^Swap(?: languages)?$/));
      await flushAutoRun(rendered);
      expect(language(rendered.container, 'From').value).toBe('fr');
      expect(language(rendered.container, 'To').value).toBe('en');
      expect(factory.availability).toHaveBeenLastCalledWith(
        expect.objectContaining({ sourceLanguage: 'fr', targetLanguage: 'en' })
      );
      expect(factory.create).not.toHaveBeenCalled();
      await rendered.actions.setValue(rendered.container.querySelector('textarea')!, 'Bonjour');
      await rendered.actions.click(button(rendered.container, /^Translate$/));
      await flushAutoRun(rendered);
      expect(factory.create).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ sourceLanguage: 'fr', targetLanguage: 'en' })
      );
      expect(rendered.onResult).toHaveBeenCalledOnce();
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('downloads a language pack only after an explicit click, including with an empty source', async () => {
      const { native, factory } = installTranslator('downloadable');
      const rendered = await setup({ value: '', autoTranslate: true, debounceMs: 1 });
      await flushAutoRun(rendered);
      expect(factory.create).not.toHaveBeenCalled();
      expect(native.translateStreaming).not.toHaveBeenCalled();
      const download = button(rendered.container, /^Download pack$/);
      expect(download.disabled).toBe(false);
      await rendered.actions.click(download);
      await flushAutoRun(rendered);
      expect(factory.create).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ sourceLanguage: 'en', targetLanguage: 'fr' })
      );
      expect(native.translateStreaming).not.toHaveBeenCalled();
      await rendered.actions.setValue(rendered.container.querySelector('textarea')!, 'Hello');
      await flushAutoRun(rendered);
      expect(native.translateStreaming).toHaveBeenCalledOnce();
      expect(factory.create).toHaveBeenCalledOnce();
      expect(rendered.onResult).toHaveBeenCalledOnce();
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('does not start a downloadable model when the user types with automatic translation enabled', async () => {
      const { native, factory } = installTranslator('downloadable');
      const rendered = await setup({ value: '', autoTranslate: true, debounceMs: 1 });
      await flushAutoRun(rendered);
      await rendered.actions.setValue(rendered.container.querySelector('textarea')!, 'Source waiting for a pack');
      await flushAutoRun(rendered);
      expect(factory.create).not.toHaveBeenCalled();
      expect(native.translateStreaming).not.toHaveBeenCalled();
      expect(rendered.onResult).not.toHaveBeenCalled();
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });
  });
}
