import { describe, expect, it, vi, type Mock } from 'vitest';
import type { ContractRender } from './types';

export interface TextToolResult extends ContractRender {
  onError: Mock;
  onProgress: Mock;
  onResult: Mock;
  onValueChange: Mock;
}

export interface TextToolOptions {
  autoTranslate?: boolean;
  debounceMs?: number;
  value?: string;
  disabled?: boolean;
}

export type TextToolSetup = (options?: TextToolOptions) => TextToolResult | Promise<TextToolResult>;

export interface TextToolContract {
  action: string;
  emptyOutput: string;
  globalName: string;
  method: string;
  output: unknown;
  outputText: string;
  title: string;
}

const stream = (...chunks: string[]) =>
  new ReadableStream<string>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    }
  });

const install = (contract: TextToolContract) => {
  const native: Record<string, unknown> = {
    inputQuota: 4096,
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    measureInputUsage: vi.fn().mockResolvedValue(8),
    destroy: vi.fn()
  };
  const method = vi.fn().mockResolvedValue(contract.output);
  native[contract.method] = contract.method.endsWith('Streaming')
    ? vi.fn().mockImplementation(() => stream(contract.outputText))
    : method;
  if (contract.method.endsWith('Streaming')) {
    const direct = contract.method.replace('Streaming', '');
    native[direct] = method;
  }
  vi.stubGlobal(contract.globalName, {
    availability: vi.fn().mockResolvedValue('available'),
    create: vi.fn().mockResolvedValue(native)
  });
  return native;
};

const settingChanges: Record<string, { label: string; value: string | boolean; options: Record<string, unknown> }> = {
  Summarizer: { label: 'Type', value: 'headline', options: { type: 'headline' } },
  Writer: { label: 'Tone', value: 'formal', options: { tone: 'formal' } },
  Rewriter: { label: 'Tone', value: 'more-formal', options: { tone: 'more-formal' } },
  Translator: { label: 'From', value: 'de', options: { sourceLanguage: 'de' } },
  LanguageDetector: {
    label: 'Expected languages',
    value: 'fr, de',
    options: { expectedInputLanguages: ['fr', 'de'] }
  },
  Proofreader: { label: 'Correction types', value: true, options: { includeCorrectionTypes: true } }
};

const runButton = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('[data-browser-ai-action="run"]')!;

export function testTextTool(setup: TextToolSetup, contract: TextToolContract): void {
  describe(`${contract.title} shared contract`, () => {
    it('uses the shared two-pane structure and runs the browser API', async () => {
      const native = install(contract);
      const rendered = await setup({ value: 'Source text' });
      const root = rendered.container.querySelector('.writing-tool');
      expect(root).not.toBeNull();
      expect(root?.querySelector('.writing-tool__workspace')).not.toBeNull();
      expect(root?.querySelectorAll('.writing-tool__pane')).toHaveLength(2);
      expect(root?.querySelector('textarea')).not.toBeNull();
      expect(root?.querySelector('.writing-tool__output')?.textContent).toContain(contract.emptyOutput);
      const action = root!.querySelector<HTMLButtonElement>('[data-browser-ai-action="run"]');
      expect(action?.textContent?.trim()).toBe(contract.action);
      await rendered.actions.click(action!);
      await rendered.actions.flush();
      expect(native[contract.method]).toHaveBeenCalled();
      expect(root?.querySelector('.writing-tool__output')?.textContent).toContain(contract.outputText);
      expect(rendered.onResult).toHaveBeenCalledExactlyOnceWith(expect.any(Object));
      expect(rendered.onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
      expect(rendered.onError).not.toHaveBeenCalled();
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('propagates controlled input and disables execution', async () => {
      install(contract);
      const editable = await setup({ value: '' });
      await editable.actions.setValue(editable.container.querySelector('textarea')!, 'Changed source');
      expect(editable.onValueChange).toHaveBeenCalledWith('Changed source');
      await editable.cleanup();
      const rendered = await setup({ value: 'Source text', disabled: true });
      expect(rendered.container.querySelector('textarea')!.disabled).toBe(true);
      expect(runButton(rendered.container).disabled).toBe(true);
      const fileInput = rendered.container.querySelector<HTMLInputElement>('input[type="file"]')!;
      expect(fileInput.disabled).toBe(true);
      await rendered.actions.selectFiles(fileInput, [new File(['Ignored attachment'], 'disabled.txt')]);
      await rendered.actions.flush();
      expect(rendered.onValueChange).not.toHaveBeenCalled();
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('loads text files through the shared attachment control', async () => {
      install(contract);
      const rendered = await setup({ value: 'Existing source' });
      const input = rendered.container.querySelector<HTMLInputElement>('input[type="file"]');
      expect(input?.accept).toContain('.md');
      await rendered.actions.selectFiles(input!, [
        new File(['Attached source'], 'notes.md', { type: 'text/markdown' })
      ]);
      await rendered.actions.flush();
      expect(rendered.onValueChange).toHaveBeenLastCalledWith('Existing source\n\nAttached source');
      expect(rendered.container.querySelector('textarea')?.value).toBe('Existing source\n\nAttached source');
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('forwards edited settings to native model creation', async () => {
      const native = install(contract);
      const rendered = await setup({ value: 'Source text' });
      const change = settingChanges[contract.globalName]!;
      const label = [...rendered.container.querySelectorAll('label')].find((element) =>
        element.textContent?.trim().startsWith(change.label)
      );
      const control = label?.querySelector<HTMLInputElement | HTMLSelectElement>('input, select');
      expect(control).toBeDefined();
      if (typeof change.value === 'boolean') {
        expect((control as HTMLInputElement).checked).toBe(!change.value);
        await rendered.actions.click(control!);
      } else {
        await rendered.actions.setValue(control!, change.value);
      }
      await rendered.actions.flush();
      await rendered.actions.click(runButton(rendered.container));
      await rendered.actions.flush();
      const factory = (globalThis as unknown as Record<string, { create: Mock }>)[contract.globalName]!;
      expect(factory.create).toHaveBeenLastCalledWith(expect.objectContaining(change.options));
      expect(native[contract.method]).toHaveBeenCalled();
      expect(rendered.onResult).toHaveBeenCalledOnce();
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    if (['Summarizer', 'Writer', 'Rewriter'].includes(contract.globalName)) {
      it('respects plain-text output and can render the same result as Markdown', async () => {
        install({ ...contract, output: '**Literal result**', outputText: '**Literal result**' });
        const rendered = await setup({ value: 'Source text' });
        const label = [...rendered.container.querySelectorAll('label')].find((element) =>
          element.textContent?.trim().startsWith('Format')
        )!;
        const format = label.querySelector('select')!;
        await rendered.actions.setValue(format, 'plain-text');
        await rendered.actions.flush();
        await rendered.actions.click(runButton(rendered.container));
        await rendered.actions.flush();
        const output = rendered.container.querySelector('.writing-tool__output')!;
        expect(output.textContent).toContain('**Literal result**');
        expect(output.querySelector('strong')).toBeNull();
        await rendered.actions.setValue(format, 'markdown');
        await rendered.actions.flush();
        expect(output.querySelector('strong')?.textContent).toBe('Literal result');
        await rendered.cleanup();
        vi.unstubAllGlobals();
      });
    }

    it('shows native failures and delivers the original error callback', async () => {
      const native = install(contract);
      const failure = new Error(`${contract.title} model failed`);
      const method = native[contract.method] as Mock;
      if (contract.method.endsWith('Streaming')) {
        method.mockImplementation(() => new ReadableStream({ start: (controller) => controller.error(failure) }));
      } else {
        method.mockRejectedValue(failure);
      }
      const rendered = await setup({ value: 'Source text' });
      await rendered.actions.click(runButton(rendered.container));
      await rendered.actions.flush();
      expect(rendered.container.querySelector('.writing-tool__error')?.textContent).toContain(failure.message);
      expect(rendered.onError).toHaveBeenCalledExactlyOnceWith(failure);
      expect(rendered.onResult).not.toHaveBeenCalled();
      expect(runButton(rendered.container).disabled).toBe(false);
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });

    it('stops pending native work and ignores its late output after a subsequent run', async () => {
      const native = install(contract);
      const method = native[contract.method] as Mock;
      let completeNative!: () => void;
      const pending = new Promise<void>((resolve) => {
        completeNative = resolve;
      });
      let cancelled = false;
      const cancel = vi.fn(() => {
        cancelled = true;
      });
      if (contract.method.endsWith('Streaming')) {
        method.mockReturnValueOnce(
          new ReadableStream<string>({
            async pull(controller) {
              await pending;
              if (!cancelled) {
                controller.enqueue(contract.outputText);
                controller.close();
              }
            },
            cancel
          })
        );
      } else {
        method.mockImplementationOnce(() => pending.then(() => contract.output));
      }
      const rendered = await setup({ value: 'Source text' });
      await rendered.actions.click(runButton(rendered.container));
      await rendered.actions.flush();
      expect(method).toHaveBeenCalledOnce();
      const signal = method.mock.calls[0]![1]?.signal as AbortSignal;
      expect(signal.aborted).toBe(false);
      expect(rendered.onResult).not.toHaveBeenCalled();
      const stop = [...rendered.container.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Stop'
      );
      expect(stop).toBeDefined();
      expect(rendered.container.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(true);
      await rendered.actions.click(stop!);
      await rendered.actions.flush();
      expect(signal.aborted).toBe(true);
      if (contract.method.endsWith('Streaming')) expect(cancel).toHaveBeenCalledOnce();
      expect(rendered.onResult).not.toHaveBeenCalled();
      expect(runButton(rendered.container).disabled).toBe(false);
      await rendered.actions.click(runButton(rendered.container));
      await rendered.actions.flush();
      expect(rendered.onResult).toHaveBeenCalledOnce();
      completeNative();
      await rendered.actions.flush();
      expect(method).toHaveBeenCalledTimes(2);
      expect(rendered.onResult).toHaveBeenCalledOnce();
      expect(rendered.container.querySelector('.writing-tool__output')?.textContent).toContain(contract.outputText);
      expect(runButton(rendered.container).disabled).toBe(false);
      await rendered.cleanup();
      vi.unstubAllGlobals();
    });
  });
}
