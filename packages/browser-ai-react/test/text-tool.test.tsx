import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextTool, type TextToolProps } from '../src/components/TextTool';

const roots = new Set<Root>();
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
};
const render = async (overrides: Partial<TextToolProps> = {}) => {
  let props: TextToolProps = {
    title: 'Text tool',
    action: 'Run',
    placeholder: 'Source',
    output: 'No result',
    availability: null,
    processing: '',
    onRun: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.add(root);
  await act(() => root.render(<TextTool {...props} />));
  return {
    container,
    async update(next: Partial<TextToolProps>) {
      props = { ...props, ...next };
      await act(() => root.render(<TextTool {...props} />));
    },
    async cleanup() {
      if (roots.delete(root)) await act(() => root.unmount());
      container.remove();
    }
  };
};
const field = (container: HTMLElement, label: string) => {
  const element = [...container.querySelectorAll('label')].find((item) => item.textContent?.trim().startsWith(label));
  return element!.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')!;
};
const setValue = async (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
  await act(() =>
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  );
};
const click = async (element: HTMLElement) => {
  await act(() => element.click());
};
const submit = async (container: HTMLElement) => {
  await act(() =>
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  );
};
const selectFiles = async (container: HTMLElement, files: File[] | null) => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  await act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
};
const copyButton = (container: HTMLElement) =>
  [...container.querySelectorAll('button')].find((button) => button.textContent?.startsWith('Cop'))!;

beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
});
afterEach(async () => {
  for (const root of roots) await act(() => root.unmount());
  roots.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('React text tool controls', () => {
  it('normalizes settings, routes create/run options, and resets local choices when props change', async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);
    const onCheckAvailability = vi.fn().mockResolvedValue('available');
    const rendered = await render({
      kind: 'language-detector',
      value: 'Source',
      onRun,
      onCheckAvailability,
      renderOutput: (configuration) => <span>{String(configuration.runOptions.minConfidence)}</span>
    });
    expect(onCheckAvailability).toHaveBeenLastCalledWith({ expectedInputLanguages: [] });
    await setValue(field(rendered.container, 'Expected languages'), 'fr, de');
    await setValue(field(rendered.container, 'Confidence'), '0.75');
    await setValue(field(rendered.container, 'Results'), '5');
    await click(field(rendered.container, 'Strip HTML'));
    expect(rendered.container.querySelector('.writing-tool__output')?.textContent).toBe('0.75');
    await submit(rendered.container);
    expect(onRun).toHaveBeenLastCalledWith('Source', {
      createOptions: { expectedInputLanguages: ['fr', 'de'] },
      runOptions: { minConfidence: 0.75, maxResults: 5, largeInputStrategy: 'chunk', stripHtml: false }
    });
    expect(onCheckAvailability).toHaveBeenLastCalledWith({ expectedInputLanguages: ['fr', 'de'] });
    await rendered.update({ value: 'New source', createOptions: { expectedInputLanguages: ['es'] } });
    expect(field(rendered.container, 'Expected languages').value).toBe('es');
    expect(field(rendered.container, 'Confidence').value).toBe('0.42');
    await setValue(field(rendered.container, 'Confidence'), '0.6');
    await submit(rendered.container);
    expect(onRun).toHaveBeenLastCalledWith(
      'New source',
      expect.objectContaining({
        createOptions: { expectedInputLanguages: ['es'] },
        runOptions: expect.objectContaining({ minConfidence: 0.6 })
      })
    );
  });

  it('accepts context text and caller options without a settings descriptor', async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);
    const rendered = await render({ kind: 'writer', value: 'Draft', onRun });
    await setValue(field(rendered.container, 'Additional context'), 'For researchers\nUse citations.');
    await submit(rendered.container);
    expect(onRun).toHaveBeenLastCalledWith(
      'Draft',
      expect.objectContaining({ runOptions: expect.objectContaining({ context: 'For researchers\nUse citations.' }) })
    );
    await rendered.update({
      kind: undefined,
      createOptions: { custom: 'value' },
      runOptions: { context: 'Own context' }
    });
    expect(rendered.container.querySelector('details')).toBeNull();
    await setValue(rendered.container.querySelector('textarea')!, 'Edited');
    await submit(rendered.container);
    expect(onRun).toHaveBeenLastCalledWith('Edited', {
      createOptions: { custom: 'value' },
      runOptions: { context: 'Own context' }
    });
  });

  it.each([{ value: '' }, { value: 'Source', disabled: true }, { value: 'Source', processing: 'running' }])(
    'guards form submissions and file controls in blocked state %j',
    async (state) => {
      const onRun = vi.fn().mockResolvedValue(undefined);
      const onValueChange = vi.fn();
      const rendered = await render({ ...state, onRun, onValueChange });
      await submit(rendered.container);
      expect(onRun).not.toHaveBeenCalled();
      if (state.value) {
        await selectFiles(rendered.container, [new File(['Ignored'], 'ignored.txt')]);
        expect(onValueChange).not.toHaveBeenCalled();
      }
    }
  );

  it('renders quota, download/chunk progress, interruption, and detailed corrections', async () => {
    const onInterrupt = vi.fn();
    const rendered = await render({
      value: 'Source',
      processing: 'creating',
      availability: 'downloadable',
      downloadProgress: 24.6,
      inputUsage: 17,
      inputQuota: 512,
      progressState: { phase: 'summarizing', totalChunks: 4 },
      onInterrupt,
      corrections: [
        {
          index: 0,
          startIndex: 0,
          endIndex: 3,
          original: 'teh',
          correction: 'the',
          types: ['spelling'],
          explanation: 'Fix spelling.'
        },
        { index: 1, startIndex: 4, endIndex: 8, original: 'text', correction: 'texts', types: [], explanation: '' }
      ]
    });
    expect(rendered.container.querySelector('footer')?.textContent).toContain('17 / 512 tokens');
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toBe('summarizing 25% 0/4');
    expect(rendered.container.querySelectorAll('[aria-label="Corrections"] li')).toHaveLength(2);
    expect(rendered.container.querySelector('del')?.textContent).toBe('teh');
    expect(rendered.container.querySelector('ins')?.textContent).toBe('the');
    expect(rendered.container.textContent).toContain('Fix spelling.');
    await click([...rendered.container.querySelectorAll('button')].find((button) => button.textContent === 'Stop')!);
    expect(onInterrupt).toHaveBeenCalledOnce();
    await rendered.update({
      downloadProgress: 100,
      progressState: { phase: 'summarizing', processedChunks: 2, totalChunks: 4 }
    });
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toBe('summarizing 2/4');
    await rendered.update({ progressState: undefined, downloadProgress: 0, onInterrupt: undefined });
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toBe('creating');
    await rendered.update({ processing: '', inputUsage: null, inputQuota: null });
    expect(rendered.container.querySelector('button[type="submit"]')?.textContent).toBe('Download & run');
    expect(rendered.container.querySelector('footer')?.textContent).toContain('— / — tokens');
  });

  it('reports availability failures and ignores obsolete requests', async () => {
    const oldRequest = deferred<Availability>();
    const onCheckAvailability = vi.fn().mockReturnValueOnce(oldRequest.promise).mockResolvedValue('available');
    const rendered = await render({ kind: 'writer', onCheckAvailability });
    await setValue(field(rendered.container, 'Tone'), 'formal');
    oldRequest.reject(new Error('Old availability failed'));
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    onCheckAvailability.mockRejectedValueOnce(new Error('Current availability failed'));
    await setValue(field(rendered.container, 'Tone'), 'casual');
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Current availability failed');
  });

  it('ignores availability rejection after disposal', async () => {
    const pending = deferred<Availability>();
    const rendered = await render({ onCheckAvailability: () => pending.promise });
    await rendered.cleanup();
    pending.reject(new Error('Disposed'));
    await settle();
    expect(rendered.container.textContent).toBe('');
  });

  it('lets users toggle automatic translation and follows later prop and callback changes', async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);
    const rendered = await render({
      kind: 'translator',
      value: 'Source',
      availability: 'available',
      autoRunDelay: 1,
      onRun
    });
    const toggle = () => field(rendered.container, 'Auto translate') as HTMLInputElement;
    expect(toggle().checked).toBe(false);
    await settle();
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

  it('reports automatic failures without retrying unchanged input', async () => {
    const onRun = vi.fn().mockRejectedValue(new Error('Automatic translation failed'));
    const rendered = await render({
      kind: 'translator',
      availability: 'available',
      autoRun: true,
      autoRunDelay: 1,
      onRun
    });
    await setValue(rendered.container.querySelector('textarea')!, 'Source');
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Automatic translation failed');
    await rendered.update({ processing: 'translating' });
    await rendered.update({ processing: '' });
    await settle();
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('reports rejected manual runs', async () => {
    const rendered = await render({
      value: 'Source',
      onRun: vi.fn().mockRejectedValue(new Error('Manual translation failed'))
    });
    await submit(rendered.container);
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Manual translation failed');
  });

  it.each([new Error('Download denied'), 'Download denied'])(
    'reports explicit pack preparation failures and clears them on a later attempt (%s)',
    async (failure) => {
      const onRun = vi.fn();
      const onPrepare = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
      const rendered = await render({
        kind: 'translator',
        availability: 'downloadable',
        onPrepare,
        onRun,
        createOptions: { sourceLanguage: 'en', targetLanguage: 'de' }
      });
      const download = () =>
        [...rendered.container.querySelectorAll('button')].find((element) => element.textContent === 'Download pack')!;
      await click(download());
      expect(onPrepare).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ createOptions: { sourceLanguage: 'en', targetLanguage: 'de' } })
      );
      expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe(
        failure instanceof Error ? failure.message : 'Browser AI request failed.'
      );
      await click(download());
      expect(onPrepare).toHaveBeenCalledTimes(2);
      expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
      expect(onRun).not.toHaveBeenCalled();
    }
  );

  it.each([{ disabled: true }, { processing: 'creating' }])(
    'disables translator controls while blocked: %j',
    async (state) => {
      const onPrepare = vi.fn();
      const rendered = await render({ kind: 'translator', availability: 'downloadable', onPrepare, ...state });
      const toggle = field(rendered.container, 'Auto translate') as HTMLInputElement;
      const swap = [...rendered.container.querySelectorAll('button')].find(
        (element) => element.textContent === 'Swap languages'
      )!;
      const download = [...rendered.container.querySelectorAll('button')].find(
        (element) => element.textContent === 'Download pack'
      )!;
      expect(toggle.disabled).toBe(true);
      expect(swap.disabled).toBe(true);
      expect(download.disabled).toBe(true);
      await click(download);
      expect(onPrepare).not.toHaveBeenCalled();
    }
  );
});

describe('React text file lifecycle', () => {
  it('appends completed reads to the current draft, not the draft at selection time', async () => {
    const pending = deferred<string>();
    vi.spyOn(File.prototype, 'text').mockReturnValueOnce(pending.promise);
    const onValueChange = vi.fn();
    const rendered = await render({ value: 'Initial', onValueChange });
    await selectFiles(rendered.container, [new File([''], 'notes.txt')]);
    await setValue(rendered.container.querySelector('textarea')!, 'Edited while reading');
    pending.resolve('Attachment');
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith('Edited while reading\n\nAttachment');
    expect(rendered.container.querySelector<HTMLInputElement>('input[type="file"]')?.value).toBe('');
  });

  it.each(['resolve', 'reject'] as const)('ignores obsolete file %s after a newer selection', async (outcome) => {
    const pending = deferred<string>();
    vi.spyOn(File.prototype, 'text').mockReturnValueOnce(pending.promise);
    const onValueChange = vi.fn();
    const rendered = await render({ onValueChange });
    await selectFiles(rendered.container, [new File([''], 'old.txt')]);
    await selectFiles(rendered.container, [new File(['New attachment'], 'new.txt')]);
    pending[outcome]('Old attachment');
    await settle();
    expect(rendered.container.querySelector('textarea')?.value).toBe('New attachment');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('New attachment');
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
  });

  it.each(['resolve', 'reject'] as const)('ignores file %s after disposal', async (outcome) => {
    const pending = deferred<string>();
    vi.spyOn(File.prototype, 'text').mockReturnValueOnce(pending.promise);
    const onValueChange = vi.fn();
    const rendered = await render({ onValueChange });
    await selectFiles(rendered.container, [new File([''], 'pending.txt')]);
    await rendered.cleanup();
    pending[outcome]('Late attachment');
    await settle();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it.each([{ disabled: true }, { processing: 'running' }])(
    'discards pending files when controls become blocked: %j',
    async (state) => {
      const pending = deferred<string>();
      vi.spyOn(File.prototype, 'text').mockReturnValueOnce(pending.promise);
      const onValueChange = vi.fn();
      const rendered = await render({ value: 'Source', onValueChange });
      await selectFiles(rendered.container, [new File([''], 'pending.txt')]);
      await rendered.update(state);
      pending.resolve('Late attachment');
      await settle();
      expect(rendered.container.querySelector('textarea')?.value).toBe('Source');
      expect(onValueChange).not.toHaveBeenCalled();
    }
  );

  it('handles missing files, non-Error failures, error precedence, and recovery', async () => {
    const read = vi.spyOn(File.prototype, 'text').mockRejectedValueOnce('Unreadable');
    const rendered = await render({ value: 'Source' });
    await selectFiles(rendered.container, null);
    expect(rendered.container.querySelector('textarea')?.value).toBe('Source');
    await selectFiles(rendered.container, [new File([''], 'broken.txt')]);
    await settle();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Could not read file.');
    await rendered.update({ error: 'Model failed' });
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('Model failed');
    read.mockResolvedValueOnce('Recovered');
    await selectFiles(rendered.container, [new File([''], 'good.txt')]);
    await rendered.update({ error: '' });
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    expect(rendered.container.querySelector('textarea')?.value).toBe('Source\n\nRecovered');
  });
});

describe('React result copying', () => {
  const clipboard = (writeText = vi.fn().mockResolvedValue(undefined)) => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    return writeText;
  };

  it('copies plain output text and resets confirmation when output changes', async () => {
    const writeText = clipboard();
    const rendered = await render({ output: <strong>Rendered result</strong>, outputText: '**Plain source**' });
    await click(copyButton(rendered.container));
    expect(writeText).toHaveBeenCalledExactlyOnceWith('**Plain source**');
    expect(copyButton(rendered.container).textContent).toBe('Copied');
    await rendered.update({ outputText: 'New output' });
    expect(copyButton(rendered.container).textContent).toBe('Copy output');
  });

  it('does not confirm a newer result when copying the previous result finishes late', async () => {
    const pending = deferred<void>();
    clipboard(vi.fn().mockReturnValue(pending.promise));
    const rendered = await render({ outputText: 'Old output' });
    await click(copyButton(rendered.container));
    await rendered.update({ outputText: 'New output' });
    pending.resolve();
    await settle();
    expect(copyButton(rendered.container).textContent).toBe('Copy output');
  });

  it.each([new Error('Permission denied'), 'Permission denied'])(
    'shows clipboard failures and clears them after recovery (%s)',
    async (failure) => {
      clipboard(vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined));
      const rendered = await render({ outputText: 'Result' });
      await click(copyButton(rendered.container));
      expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe(
        failure instanceof Error ? failure.message : 'Could not copy the result.'
      );
      await click(copyButton(rendered.container));
      expect(copyButton(rendered.container).textContent).toBe('Copied');
      expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    }
  );

  it.each(['resolve', 'reject'] as const)('ignores clipboard %s after disposal', async (outcome) => {
    const pending = deferred<void>();
    clipboard(vi.fn().mockReturnValue(pending.promise));
    const rendered = await render({ outputText: 'Result' });
    await click(copyButton(rendered.container));
    await rendered.cleanup();
    if (outcome === 'resolve') pending.resolve();
    else pending.reject(new Error('Disposed'));
    await settle();
    expect(rendered.container.textContent).toBe('');
  });
});
