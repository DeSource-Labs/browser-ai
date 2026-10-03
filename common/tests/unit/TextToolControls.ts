import { expect, it, vi, type Mock } from 'vitest';
import { deferred } from '../helpers/streams';

export interface TextToolControlsRender {
  container: HTMLElement;
  onRun: Mock;
  onValueChange?: Mock;
  update(props: Record<string, unknown>): Promise<void>;
  changeSetting(name: string, value: string | boolean): Promise<void>;
  submit(): Promise<void>;
  selectFiles(files: File[]): Promise<void>;
  setValue(value: string): Promise<void>;
  flush(): Promise<void>;
  value(): string;
  error(): string;
  cleanup(): void | Promise<void>;
}

export type TextToolControlsSetup = (props: Record<string, unknown>) => Promise<TextToolControlsRender>;

export const setting = (container: HTMLElement, name: string) => {
  const label = Array.from(container.querySelectorAll('.writing-tool__settings label')).find(
    (label) => label.firstChild?.textContent?.trim() === name
  );
  if (!label) throw new Error(`Missing setting: ${name}`);
  return label.querySelector('input, select, textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
};

export const busyProofreaderOptions = () => ({
  kind: 'proofreader',
  value: 'teh',
  processing: 'proofread',
  downloadProgress: 42.4,
  inputUsage: 8,
  inputQuota: 100,
  progressState: { phase: 'proofreading', processedChunks: 1, totalChunks: 3 },
  corrections: [
    { original: '<b>teh</b>', correction: 'the', types: ['spelling'], explanation: 'Spelling fix' },
    { original: '', correction: '.', types: [], explanation: '' }
  ]
});

export const expectBusyProofreader = (container: HTMLElement) => {
  expect(container.querySelector('.writing-tool__footer')?.textContent).toContain('8 / 100 tokens');
  expect(container.querySelector('[role="status"]')?.textContent).toContain('42%');
  expect(container.querySelector('[role="status"]')?.textContent).toContain('1/3');
  expect(container.querySelector('del')?.textContent).toBe('<b>teh</b>');
  expect(container.querySelector('del b')).toBeNull();
  expect(container.querySelector('[aria-label="Corrections"]')?.textContent).toContain('Spelling fix');
  for (const control of container.querySelectorAll('textarea, input, select'))
    expect((control as HTMLInputElement).disabled).toBe(true);
};

export function testTextToolLanguageSettings(setup: TextToolControlsSetup): void {
  it('edits language lists, numeric limits, and correction settings through native controls', async () => {
    const rendered = await setup({
      kind: 'language-detector',
      value: 'Bonjour',
      createOptions: { expectedInputLanguages: ['en', 'fr'] }
    });
    expect(setting(rendered.container, 'Expected languages').value).toBe('en, fr');
    await rendered.changeSetting('Expected languages', 'es, de');
    await rendered.changeSetting('Confidence', '0.75');
    await rendered.changeSetting('Results', '3');
    await rendered.submit();
    expect(rendered.onRun).toHaveBeenLastCalledWith(
      'Bonjour',
      expect.objectContaining({
        createOptions: expect.objectContaining({ expectedInputLanguages: ['es', 'de'] }),
        runOptions: expect.objectContaining({ minConfidence: 0.75, maxResults: 3 })
      })
    );
    await rendered.update({ kind: 'proofreader', createOptions: { expectedInputLanguages: null } });
    await rendered.changeSetting('Correction types', true);
    await rendered.changeSetting('Explanations', true);
    await rendered.changeSetting('Explanation language', 'fr');
    await rendered.submit();
    expect(rendered.onRun).toHaveBeenLastCalledWith(
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
}

export function testTextToolFileLifecycle(setup: TextToolControlsSetup): void {
  it('appends completed files to the latest input and keeps newer selections authoritative', async () => {
    const first = deferred<string>();
    const stale = deferred<string>();
    vi.spyOn(File.prototype, 'text')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce('Newest');
    const rendered = await setup({ value: 'Seed' });
    const file = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await rendered.selectFiles([new File([''], 'first.txt', { type: 'text/plain' })]);
    await rendered.setValue('Edited while reading');
    first.resolve('First');
    await rendered.flush();
    expect(rendered.value()).toBe('Edited while reading\n\nFirst');
    if (rendered.onValueChange)
      expect(rendered.onValueChange).toHaveBeenLastCalledWith('Edited while reading\n\nFirst');
    await rendered.selectFiles([new File([''], 'old.txt', { type: 'text/plain' })]);
    await rendered.selectFiles([new File([''], 'new.txt', { type: 'text/plain' })]);
    stale.reject(new Error('Old file failed'));
    await rendered.flush();
    expect(rendered.value()).toBe('Edited while reading\n\nFirst\n\nNewest');
    expect(rendered.error()).toBe('');
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    expect(file.value).toBe('');
  });

  it.each(['disabled', 'processing', 'unmount'] as const)(
    'ignores pending file success and failure after %s',
    async (mode) => {
      for (const outcome of ['resolve', 'reject']) {
        const pending = deferred<string>();
        vi.spyOn(File.prototype, 'text').mockReturnValueOnce(pending.promise);
        const rendered = await setup({ value: 'Seed' });
        const file = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
        await rendered.selectFiles([new File([''], 'pending.txt', { type: 'text/plain' })]);
        if (mode === 'unmount') await rendered.cleanup();
        else await rendered.update(mode === 'disabled' ? { disabled: true } : { processing: 'write' });
        if (outcome === 'resolve') pending.resolve('Late');
        else pending.reject(new Error('Late failure'));
        await rendered.flush();
        expect(rendered.value()).toBe('Seed');
        expect(rendered.error()).toBe('');
        expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
        if (rendered.onValueChange) expect(rendered.onValueChange).not.toHaveBeenCalled();
        expect(file.value).toBe('');
        await rendered.cleanup();
      }
    }
  );
}
