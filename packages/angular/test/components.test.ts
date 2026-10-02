import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserAiChatSidebarComponent } from '../src/lib/chat.component';
import { BrowserAiMarkdownRendererComponent } from '../src/lib/markdown-renderer.component';
import { BrowserAiPromptApiComponent } from '../src/lib/prompt-api.component';
import { BrowserAiPromptInputComponent } from '../src/lib/prompt-input.component';
import {
  BrowserAiLanguageDetectorComponent,
  BrowserAiProofreaderComponent,
  BrowserAiRewriterComponent,
  BrowserAiSummarizerComponent,
  BrowserAiTranslatorComponent,
  BrowserAiWriterComponent
} from '../src/lib/text-components';
import { BrowserAiTextToolComponent } from '../src/lib/text-tool.component';

const fixtures = new Set<ComponentFixture<unknown>>();
let promptChatKey = 0;

const render = async <T>(component: new (...args: any[]) => T, inputs: Record<string, unknown> = {}) => {
  const fixture = TestBed.createComponent(component);
  fixtures.add(fixture as ComponentFixture<unknown>);
  const props =
    component === BrowserAiPromptApiComponent
      ? { autoInit: false, chatKey: `angular-components-${++promptChatKey}`, ...inputs }
      : inputs;
  for (const [name, value] of Object.entries(props)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  await fixture.whenStable();
  if (component === BrowserAiPromptApiComponent)
    await vi.waitFor(() =>
      expect((fixture.componentInstance as BrowserAiPromptApiComponent).api.isProcessing()).toBe(false)
    );
  fixture.detectChanges();
  return {
    fixture,
    instance: fixture.componentInstance,
    container: fixture.nativeElement as HTMLElement,
    cleanup() {
      if (fixtures.delete(fixture as ComponentFixture<unknown>)) fixture.destroy();
    }
  };
};

const renderTool = async (inputs: Record<string, unknown> = {}) => {
  const rendered = await render(BrowserAiTextToolComponent, {
    title: 'Tool',
    action: 'Run',
    placeholder: 'Source text',
    ...inputs
  });
  return {
    ...rendered,
    async update(inputs: Record<string, unknown>) {
      for (const [name, value] of Object.entries(inputs)) rendered.fixture.componentRef.setInput(name, value);
      await settle(rendered.fixture);
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

const changeSetting = async (
  rendered: { container: HTMLElement; fixture: ComponentFixture<unknown> },
  name: string,
  value: string | boolean
) => {
  const control = setting(rendered.container, name);
  if (typeof value === 'boolean') (control as HTMLInputElement).checked = value;
  else control.value = value;
  control.dispatchEvent(
    new Event(control instanceof HTMLSelectElement || typeof value === 'boolean' ? 'change' : 'input', {
      bubbles: true
    })
  );
  await settle(rendered.fixture);
};

const settle = async (fixture: ComponentFixture<unknown>) => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await fixture.whenStable();
  fixture.detectChanges();
};

const setValue = async (
  rendered: { fixture: ComponentFixture<unknown> },
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string
) => {
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  rendered.fixture.detectChanges();
  await rendered.fixture.whenStable();
};

const selectFiles = async (
  rendered: { fixture: ComponentFixture<unknown> },
  input: HTMLInputElement,
  files: File[] | null
) => {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle(rendered.fixture);
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
    value: vi.fn(() => `blob:angular-${++url}`),
    configurable: true
  });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

afterEach(() => {
  fixtures.forEach((fixture) => fixture.destroy());
  fixtures.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Angular presentation components', () => {
  it('renders safe linked Markdown', async () => {
    const rendered = await render(BrowserAiMarkdownRendererComponent, {
      content: '## Result\n\n[Docs](https://example.com) <script>unsafe()</script>'
    });
    expect(rendered.container.querySelector('h2')?.textContent).toBe('Result');
    expect(rendered.container.querySelector('script')).toBeNull();
    expect(rendered.container.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  });

  it('routes sidebar outputs and active state', async () => {
    const rendered = await render(BrowserAiChatSidebarComponent, {
      chats: [{ id: 'chat', title: 'Planning', updatedAt: 1 }],
      activeChatId: 'chat'
    });
    const create = vi.fn();
    const select = vi.fn();
    const remove = vi.fn();
    rendered.instance.create.subscribe(create);
    rendered.instance.select.subscribe(select);
    rendered.instance.delete.subscribe(remove);
    (rendered.container.querySelector('[data-browser-ai-action="create"]') as HTMLButtonElement).click();
    (rendered.container.querySelector('[data-browser-ai-action="select"]') as HTMLButtonElement).click();
    (rendered.container.querySelector('[aria-label="Delete Planning"]') as HTMLButtonElement).click();
    expect(rendered.container.querySelector('.is-active')).not.toBeNull();
    expect(create).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledWith('chat');
    expect(remove).toHaveBeenCalledWith('chat');
  });

  it('handles prompt text, keyboard rules, file limits, removal, and cleanup', async () => {
    const rendered = await render(BrowserAiPromptInputComponent, {
      allowAttachments: true,
      maxAttachments: 1
    });
    const send = vi.fn();
    rendered.instance.send.subscribe(send);
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await setValue(rendered, textarea, 'Hello');
    expect(rendered.instance.value()).toBe('Hello');

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(send).not.toHaveBeenCalled();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    textarea.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(send).toHaveBeenCalledOnce();

    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    const picker = vi.spyOn(input, 'click');
    (rendered.container.querySelector('[aria-label="Attach files"]') as HTMLButtonElement).click();
    expect(picker).toHaveBeenCalledOnce();
    await selectFiles(rendered, input, [
      new File(['one'], 'one.png', { type: 'image/png' }),
      new File(['two'], 'two.png', { type: 'image/png' })
    ]);
    expect(rendered.instance.attachments()).toHaveLength(1);
    expect(rendered.container.querySelector('img[alt="one.png"]')).not.toBeNull();
    (rendered.container.querySelector('[aria-label="Remove one.png"]') as HTMLButtonElement).click();
    rendered.fixture.detectChanges();
    expect(rendered.instance.attachments()).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:angular-1');
  });

  it('supports fallback IDs, unbounded files, absent files, unowned attachments, and guarded sends', async () => {
    vi.stubGlobal('crypto', undefined);
    const rendered = await render(BrowserAiPromptInputComponent, { allowAttachments: true });
    const send = vi.fn();
    rendered.instance.send.subscribe(send);
    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(rendered, input, null);
    await selectFiles(rendered, input, [new File(['text'], 'notes.txt', { type: 'text/plain' })]);
    expect(rendered.container.textContent).toContain('notes.txt');

    rendered.instance.attachments.set([{ id: 'plain', name: 'plain.txt', type: 'text/plain' }]);
    rendered.fixture.detectChanges();
    (rendered.container.querySelector('[aria-label="Remove plain.txt"]') as HTMLButtonElement).click();
    rendered.fixture.detectChanges();
    expect(rendered.instance.attachments()).toEqual([]);

    rendered.instance.value.set('Blocked');
    rendered.fixture.componentRef.setInput('busy', true);
    rendered.fixture.detectChanges();
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(send).not.toHaveBeenCalled();
    rendered.fixture.componentRef.setInput('busy', false);
    rendered.fixture.componentRef.setInput('disabled', true);
    rendered.fixture.detectChanges();
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(send).not.toHaveBeenCalled();
  });

  it('revokes still-owned attachment URLs on destroy', async () => {
    const rendered = await render(BrowserAiPromptInputComponent, { allowAttachments: true });
    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(rendered, input, [new File(['audio'], 'voice.wav', { type: 'audio/wav' })]);
    rendered.cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:angular-1');
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

describe('Angular PromptApi', () => {
  it('streams a text prompt and renders message updates', async () => {
    const { native } = installPromptApi();
    const rendered = await render(BrowserAiPromptApiComponent);
    rendered.instance.draft.set('Hello model');
    await rendered.instance.send();
    await settle(rendered.fixture);
    expect(native.promptStreaming).toHaveBeenCalledWith(
      'Hello model',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(rendered.container.textContent).toContain('Native answer');
    expect(rendered.instance.messages()[1]).toMatchObject({ role: 'assistant', content: 'Native answer' });
  });

  it('runs a non-streaming multimodal prompt and retains cloned history URLs until destroy', async () => {
    const { native, create } = installPromptApi({ output: 'Image inspected' });
    const rendered = await render(BrowserAiPromptApiComponent, { streaming: false });
    rendered.instance.attachments.set([
      {
        id: 'source',
        file: new File(['pixels'], 'scene.png', { type: 'image/png' }),
        url: 'blob:source',
        name: 'scene.png',
        type: 'image/png'
      }
    ]);
    await rendered.instance.send();
    await settle(rendered.fixture);
    expect(native.prompt).toHaveBeenCalled();
    expect(
      create.mock.calls.some(([options]) =>
        options.expectedInputs?.some((input: { type: string }) => input.type === 'image')
      )
    ).toBe(true);
    expect(rendered.container.querySelector('img[alt="scene.png"]')?.getAttribute('src')).toBe('blob:angular-1');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:angular-1');
    rendered.cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:angular-1');
  });

  it('reports Error and non-Error failures', async () => {
    const failure = new Error('model failed');
    installPromptApi({ failure });
    const rendered = await render(BrowserAiPromptApiComponent, { streaming: false });
    const requestError = vi.fn();
    rendered.instance.requestError.subscribe(requestError);
    rendered.instance.draft.set('Fail');
    await rendered.instance.send();
    rendered.fixture.detectChanges();
    expect(rendered.container.textContent).toContain('model failed');
    expect(requestError).toHaveBeenCalledWith(failure);

    installPromptApi({ failure: 'rejected' });
    const fallback = await render(BrowserAiPromptApiComponent, { streaming: false });
    fallback.instance.draft.set('Fail again');
    await fallback.instance.send();
    fallback.fixture.detectChanges();
    expect(fallback.container.textContent).toContain('Browser AI request failed');
  });

  it('rejects attachment metadata without a backing File before prompting', async () => {
    const { native } = installPromptApi();
    const rendered = await render(BrowserAiPromptApiComponent, { streaming: false, allowAttachments: false });
    rendered.instance.attachments.set([{ id: 'plain', name: 'notes.txt', type: 'text/plain' }]);
    await rendered.instance.send();
    rendered.fixture.detectChanges();
    expect(rendered.instance.messages()).toEqual([]);
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('has no backing File');
    expect(native.prompt).not.toHaveBeenCalled();
  });

  it('passes explicit model options and guards empty, disabled, and concurrent sends', async () => {
    let release!: (value: string) => void;
    const pending = new Promise<string>((resolve) => (release = resolve));
    const { native, create } = installPromptApi();
    native.prompt.mockReturnValueOnce(pending);
    const expectedInputs: LanguageModelExpected[] = [{ type: 'text' }];
    const rendered = await render(BrowserAiPromptApiComponent, {
      streaming: false,
      modelOptions: { expectedInputs, topK: 2 }
    });

    await rendered.instance.send();
    expect(native.prompt).not.toHaveBeenCalled();
    rendered.instance.draft.set('First');
    const first = rendered.instance.send();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(native.prompt).toHaveBeenCalledOnce();
    rendered.instance.draft.set('Second');
    await rendered.instance.send();
    expect(native.prompt).toHaveBeenCalledOnce();
    release('Done');
    await first;
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ expectedInputs, topK: 2 }));

    rendered.fixture.componentRef.setInput('disabled', true);
    rendered.instance.draft.set('Blocked');
    await rendered.instance.send();
    expect(native.prompt).toHaveBeenCalledOnce();
  });
});

describe('Angular TextTool', () => {
  it('lets users toggle automatic translation and follows later prop changes', async () => {
    const rendered = await renderTool({
      kind: 'translator',
      value: 'Source',
      availability: 'available',
      autoRunDelay: 1
    });
    const configuredRun = vi.fn();
    const run = vi.fn();
    rendered.instance.configuredRun.subscribe(configuredRun);
    rendered.instance.run.subscribe(run);
    const toggle = () =>
      rendered.container.querySelector<HTMLInputElement>('.writing-tool__language-actions input[type="checkbox"]')!;
    expect(toggle().checked).toBe(false);
    expect(run).not.toHaveBeenCalled();
    toggle().click();
    await settle(rendered.fixture);
    await settle(rendered.fixture);
    expect(run).toHaveBeenCalledExactlyOnceWith('Source');
    toggle().click();
    await settle(rendered.fixture);
    await setValue(rendered, rendered.container.querySelector('textarea')!, 'Second source');
    await settle(rendered.fixture);
    expect(run).toHaveBeenCalledOnce();
    await rendered.update({ autoRun: true });
    await settle(rendered.fixture);
    expect(toggle().checked).toBe(true);
    expect(configuredRun).toHaveBeenLastCalledWith({
      input: 'Second source',
      configuration: rendered.instance.configuration()
    });
    expect(run).toHaveBeenCalledTimes(2);
    await rendered.update({ autoRun: false });
    expect(toggle().checked).toBe(false);
  });

  it.each([new Error('Download denied'), 'Download denied'])(
    'reports pack preparation failures and clears them on the next attempt (%s)',
    async (failure) => {
      const onPrepare = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
      const rendered = await renderTool({
        kind: 'translator',
        availability: 'downloadable',
        createOptions: { sourceLanguage: 'en', targetLanguage: 'de' },
        onPrepare
      });
      const run = vi.fn();
      rendered.instance.run.subscribe(run);
      const download = () =>
        [...rendered.container.querySelectorAll('button')].find((button) => button.textContent === 'Download pack')!;
      download().click();
      await settle(rendered.fixture);
      expect(onPrepare).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ createOptions: { sourceLanguage: 'en', targetLanguage: 'de' } })
      );
      expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe(
        failure instanceof Error ? failure.message : 'Could not prepare the language pair.'
      );
      download().click();
      await settle(rendered.fixture);
      expect(onPrepare).toHaveBeenCalledTimes(2);
      expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
      expect(run).not.toHaveBeenCalled();
    }
  );

  it('updates text, emits trimmed submissions, appends files, and clears prior file errors', async () => {
    const rendered = await render(BrowserAiTextToolComponent, {
      title: 'Tool',
      action: 'Run',
      placeholder: 'Input',
      value: 'Start'
    });
    const run = vi.fn();
    rendered.instance.run.subscribe(run);
    const textarea = rendered.container.querySelector('textarea') as HTMLTextAreaElement;
    await setValue(rendered, textarea, '  Updated  ');
    rendered.container
      .querySelector('form')
      ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    expect(run).toHaveBeenCalledWith('Updated');

    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(rendered, input, [new File(['Added'], 'notes.txt', { type: 'text/plain' })]);
    expect(rendered.instance.value()).toContain('Updated  \n\nAdded');
    expect(rendered.instance.fileError()).toBe('');

    vi.spyOn(File.prototype, 'text').mockRejectedValueOnce(new Error('file read failed'));
    await selectFiles(rendered, input, [new File(['bad'], 'bad.txt', { type: 'text/plain' })]);
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('file read failed');
  });

  it('renders an asynchronous file failure without manual change detection', async () => {
    const rendered = await render(BrowserAiTextToolComponent, {
      title: 'Tool',
      action: 'Run',
      placeholder: 'Input'
    });
    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    let reject!: (error: Error) => void;
    vi.spyOn(File.prototype, 'text').mockReturnValueOnce(
      new Promise((_, rejectPromise) => {
        reject = rejectPromise;
      })
    );
    Object.defineProperty(input, 'files', { value: [new File(['bad'], 'bad.txt', { type: 'text/plain' })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await rendered.fixture.whenStable();
    reject(new Error('Delayed file read failure'));
    await vi.waitFor(() =>
      expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('Delayed file read failure')
    );
  });

  it('handles absent files, non-Error file failures, and guarded submits', async () => {
    const rendered = await render(BrowserAiTextToolComponent, {
      title: 'Tool',
      action: 'Run',
      placeholder: 'Input'
    });
    const run = vi.fn();
    rendered.instance.run.subscribe(run);
    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(rendered, input, null);
    vi.spyOn(File.prototype, 'text').mockRejectedValueOnce('bad file');
    await selectFiles(rendered, input, [new File(['bad'], 'bad.txt', { type: 'text/plain' })]);
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('Could not read');

    rendered.instance.submit(new Event('submit', { cancelable: true }));
    rendered.instance.value.set('Input');
    rendered.fixture.componentRef.setInput('processing', 'busy');
    rendered.instance.submit(new Event('submit', { cancelable: true }));
    rendered.fixture.componentRef.setInput('processing', '');
    rendered.fixture.componentRef.setInput('disabled', true);
    rendered.instance.submit(new Event('submit', { cancelable: true }));
    expect(run).not.toHaveBeenCalled();
  });

  it('submits edited settings on both event contracts and resets them only for changed external options', async () => {
    const onCheckAvailability = vi.fn().mockResolvedValue('downloadable');
    const rendered = await renderTool({
      kind: 'writer',
      value: '  Draft  ',
      createOptions: { tone: 'casual' },
      runOptions: { context: 'Original' },
      availability: 'downloadable',
      onCheckAvailability
    });
    const run = vi.fn();
    const configuredRun = vi.fn();
    rendered.instance.run.subscribe(run);
    rendered.instance.configuredRun.subscribe(configuredRun);
    expect(rendered.container.querySelector('[type="submit"]')?.textContent).toContain('Download & run');
    expect(onCheckAvailability).toHaveBeenCalledWith(expect.objectContaining({ tone: 'casual' }));
    expect(run).not.toHaveBeenCalled();
    expect((rendered.container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('  Draft  ');
    await changeSetting(rendered, 'Tone', 'formal');
    await changeSetting(rendered, 'Additional context', 'New context');
    await changeSetting(rendered, 'Strip HTML', false);
    rendered.instance.submit(new Event('submit', { cancelable: true }));
    expect(run).toHaveBeenCalledWith('Draft');
    expect(configuredRun).toHaveBeenCalledWith({
      input: 'Draft',
      configuration: expect.objectContaining({
        createOptions: expect.objectContaining({ tone: 'formal' }),
        runOptions: expect.objectContaining({ context: 'New context', stripHtml: false })
      })
    });
    await rendered.update({ createOptions: { tone: 'casual' } });
    expect(setting(rendered.container, 'Tone').value).toBe('formal');
    await rendered.update({ runOptions: { context: 'Replacement' } });
    expect(setting(rendered.container, 'Tone').value).toBe('casual');
    expect(setting(rendered.container, 'Additional context').value).toBe('Replacement');
  });

  it('edits language lists, numeric limits, and correction settings through native controls', async () => {
    const rendered = await renderTool({
      kind: 'language-detector',
      value: 'Bonjour',
      createOptions: { expectedInputLanguages: ['en', 'fr'] }
    });
    const configuredRun = vi.fn();
    rendered.instance.configuredRun.subscribe(configuredRun);
    expect(setting(rendered.container, 'Expected languages').value).toBe('en, fr');
    await changeSetting(rendered, 'Expected languages', 'es, de');
    await changeSetting(rendered, 'Confidence', '0.75');
    await changeSetting(rendered, 'Results', '3');
    rendered.instance.submit(new Event('submit'));
    expect(configuredRun).toHaveBeenLastCalledWith({
      input: 'Bonjour',
      configuration: expect.objectContaining({
        createOptions: expect.objectContaining({ expectedInputLanguages: ['es', 'de'] }),
        runOptions: expect.objectContaining({ minConfidence: 0.75, maxResults: 3 })
      })
    });
    await rendered.update({ kind: 'proofreader', createOptions: { expectedInputLanguages: null } });
    await changeSetting(rendered, 'Correction types', true);
    await changeSetting(rendered, 'Explanations', true);
    await changeSetting(rendered, 'Explanation language', 'fr');
    rendered.instance.submit(new Event('submit'));
    expect(configuredRun).toHaveBeenLastCalledWith({
      input: 'Bonjour',
      configuration: expect.objectContaining({
        createOptions: expect.objectContaining({
          includeCorrectionTypes: true,
          includeCorrectionExplanations: true,
          correctionExplanationLanguage: 'fr'
        })
      })
    });
  });

  it('shows progress and corrections while busy controls stay disabled and Stop stays available', async () => {
    const onInterrupt = vi.fn();
    const read = vi.spyOn(File.prototype, 'text');
    const rendered = await renderTool({
      kind: 'proofreader',
      value: 'teh',
      result: 'the',
      processing: 'proofread',
      downloadProgress: 42.4,
      inputUsage: 8,
      inputQuota: 100,
      progressState: { phase: 'proofreading', processedChunks: 1, totalChunks: 3 },
      corrections: [
        { original: '<b>teh</b>', correction: 'the', types: ['spelling'], explanation: 'Spelling fix' },
        { original: '', correction: '.', types: [], explanation: '' }
      ],
      onInterrupt
    });
    expect(rendered.container.querySelector('.writing-tool__footer')?.textContent).toContain('8 / 100 tokens');
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain('42%');
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain('1/3');
    expect(rendered.container.querySelector('del')?.textContent).toBe('<b>teh</b>');
    expect(rendered.container.querySelector('del b')).toBeNull();
    expect(rendered.container.querySelector('[aria-label="Corrections"]')?.textContent).toContain('Spelling fix');
    for (const control of rendered.container.querySelectorAll('textarea, input, select'))
      expect((control as HTMLInputElement).disabled).toBe(true);
    await changeSetting(rendered, 'Correction types', true);
    await setValue(rendered, rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Blocked');
    expect(rendered.instance.value()).toBe('teh');
    expect(rendered.instance.configuration().createOptions.includeCorrectionTypes).toBe(false);
    const file = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(rendered, file, [new File(['Blocked'], 'blocked.txt', { type: 'text/plain' })]);
    expect(read).not.toHaveBeenCalled();
    const stop = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Stop'
    )!;
    stop.click();
    expect(onInterrupt).toHaveBeenCalledOnce();
    await rendered.update({
      disabled: true,
      progressState: { phase: 'creating', totalChunks: 3 },
      downloadProgress: 100
    });
    expect(stop.disabled).toBe(true);
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain('0/3');
    await rendered.update({ disabled: false, progressState: undefined, onInterrupt: undefined });
    expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain('proofread');
  });

  it('recovers from current availability failures and ignores obsolete or unmounted checks', async () => {
    const stale = deferred<Availability>();
    const current = deferred<Availability>();
    const onCheckAvailability = vi
      .fn()
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(current.promise)
      .mockResolvedValue('available');
    const rendered = await renderTool({ kind: 'writer', onCheckAvailability });
    await changeSetting(rendered, 'Tone', 'formal');
    stale.reject(new Error('Old options failed'));
    await settle(rendered.fixture);
    expect(rendered.instance.availabilityError()).toBe('');
    current.reject('not available');
    await settle(rendered.fixture);
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('not available');
    await changeSetting(rendered, 'Tone', 'casual');
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
    await rendered.update({
      onCheckAvailability: async () => {
        throw new Error('Current check failed');
      }
    });
    expect(rendered.instance.availabilityError()).toBe('Current check failed');
    const late = deferred<Availability>();
    await rendered.update({ onCheckAvailability: () => late.promise });
    rendered.cleanup();
    late.reject(new Error('Unmounted check'));
    await Promise.resolve();
    await Promise.resolve();
    expect(rendered.instance.availabilityError()).toBe('');
  });

  it('copies plain output, resets feedback, and suppresses obsolete clipboard results', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const rendered = await renderTool({ result: 'Visible output', outputText: 'Copy this' });
    await rendered.instance.copy();
    await settle(rendered.fixture);
    expect(writeText).toHaveBeenCalledWith('Copy this');
    expect(rendered.container.querySelector('.writing-tool__pane--output button')?.textContent?.trim()).toBe('Copied');
    await rendered.update({ outputText: undefined });
    expect(rendered.instance.copied()).toBe(false);
    writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
    await rendered.instance.copy();
    expect(rendered.instance.fileError()).toBe('Clipboard denied');
    writeText.mockRejectedValueOnce('blocked');
    await rendered.instance.copy();
    expect(rendered.instance.fileError()).toBe('Could not copy the result.');
    const stale = deferred<void>();
    writeText.mockReturnValueOnce(stale.promise);
    const staleCopy = rendered.instance.copy();
    await rendered.update({ result: 'Replacement', error: 'External error' });
    stale.reject(new Error('Obsolete failure'));
    await staleCopy;
    expect(rendered.instance.fileError()).toBe('Could not copy the result.');
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe('External error');
    const late = deferred<void>();
    writeText.mockReturnValueOnce(late.promise);
    const lateCopy = rendered.instance.copy();
    rendered.cleanup();
    late.resolve();
    await lateCopy;
    expect(rendered.instance.copied()).toBe(false);
    const blocked = await renderTool({ result: 'Output', disabled: true });
    await blocked.instance.copy();
    await blocked.update({ disabled: false, processing: 'write' });
    await blocked.instance.copy();
    await blocked.update({ processing: '', result: '' });
    await blocked.instance.copy();
    expect(writeText).toHaveBeenCalledTimes(5);
  });

  it('appends completed files to the latest input and keeps newer selections authoritative', async () => {
    const first = deferred<string>();
    const stale = deferred<string>();
    vi.spyOn(File.prototype, 'text')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce('Newest');
    const rendered = await renderTool({ value: 'Seed' });
    const file = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await selectFiles(rendered, file, [new File([''], 'first.txt', { type: 'text/plain' })]);
    await setValue(
      rendered,
      rendered.container.querySelector('textarea') as HTMLTextAreaElement,
      'Edited while reading'
    );
    first.resolve('First');
    await settle(rendered.fixture);
    expect(rendered.instance.value()).toBe('Edited while reading\n\nFirst');
    await selectFiles(rendered, file, [new File([''], 'old.txt', { type: 'text/plain' })]);
    await selectFiles(rendered, file, [new File([''], 'new.txt', { type: 'text/plain' })]);
    stale.reject(new Error('Old file failed'));
    await settle(rendered.fixture);
    expect(rendered.instance.value()).toBe('Edited while reading\n\nFirst\n\nNewest');
    expect(rendered.instance.fileError()).toBe('');
    expect(file.value).toBe('');
  });

  it.each(['disabled', 'processing', 'unmount'] as const)(
    'ignores pending file success and failure after %s',
    async (mode) => {
      for (const outcome of ['resolve', 'reject']) {
        const pending = deferred<string>();
        vi.spyOn(File.prototype, 'text').mockReturnValueOnce(pending.promise);
        const rendered = await renderTool({ value: 'Seed' });
        const file = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
        await selectFiles(rendered, file, [new File([''], 'pending.txt', { type: 'text/plain' })]);
        if (mode === 'unmount') rendered.cleanup();
        else await rendered.update(mode === 'disabled' ? { disabled: true } : { processing: 'write' });
        if (outcome === 'resolve') pending.resolve('Late');
        else pending.reject(new Error('Late failure'));
        await Promise.resolve();
        await Promise.resolve();
        expect(rendered.instance.value()).toBe('Seed');
        expect(rendered.instance.fileError()).toBe('');
        expect(file.value).toBe('');
        rendered.cleanup();
      }
    }
  );
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
  const create = vi.fn().mockResolvedValue(native);
  const availability = vi.fn().mockResolvedValue('available');
  vi.stubGlobal(name, { availability, create });
  return { native, create, availability };
};

type TextComponent =
  | typeof BrowserAiSummarizerComponent
  | typeof BrowserAiWriterComponent
  | typeof BrowserAiRewriterComponent
  | typeof BrowserAiTranslatorComponent
  | typeof BrowserAiLanguageDetectorComponent
  | typeof BrowserAiProofreaderComponent;

describe('Angular native text components', () => {
  it.each([
    ['Summarizer', BrowserAiSummarizerComponent, {}, 'Short summary'],
    ['Writer', BrowserAiWriterComponent, {}, 'Generated draft'],
    ['Rewriter', BrowserAiRewriterComponent, {}, 'Clear rewrite'],
    ['Translator', BrowserAiTranslatorComponent, { sourceLanguage: 'en', targetLanguage: 'fr' }, 'Bonjour'],
    ['LanguageDetector', BrowserAiLanguageDetectorComponent, {}, 'English (en): 96%'],
    ['Proofreader', BrowserAiProofreaderComponent, {}, 'Correct text.']
  ] as const)(
    'runs %s explicitly and forwards both progress callbacks',
    async (globalName, component, inputs, expected) => {
      const { availability } = installTextApi(globalName);
      const optionProgress = vi.fn();
      const onProgress = vi.fn();
      const rendered = await render<InstanceType<TextComponent>>(component, {
        ...inputs,
        autoInit: false,
        runOptions: { onProgress: optionProgress }
      });
      rendered.instance.progress.subscribe(onProgress);
      expect(availability).not.toHaveBeenCalled();
      await (rendered.instance as { execute(value: string): Promise<void> }).execute('Input text');
      rendered.fixture.detectChanges();
      expect(rendered.container.textContent).toContain(expected);
      expect(availability).toHaveBeenCalledOnce();
      expect(optionProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
      expect(onProgress.mock.calls).toEqual(optionProgress.mock.calls);
    }
  );

  it.each([
    [
      'Summarizer',
      BrowserAiSummarizerComponent,
      { summarize: vi.fn().mockRejectedValue(new Error('summary failed')) },
      {},
      'summary failed'
    ],
    [
      'Writer',
      BrowserAiWriterComponent,
      { writeStreaming: vi.fn().mockReturnValue(failingStream(new Error('write failed'))) },
      {},
      'write failed'
    ],
    [
      'Rewriter',
      BrowserAiRewriterComponent,
      { rewriteStreaming: vi.fn().mockReturnValue(failingStream(new Error('rewrite failed'))) },
      {},
      'rewrite failed'
    ],
    [
      'Translator',
      BrowserAiTranslatorComponent,
      { translateStreaming: vi.fn().mockReturnValue(failingStream(new Error('translation failed'))) },
      { sourceLanguage: 'en', targetLanguage: 'fr' },
      'translation failed'
    ],
    [
      'LanguageDetector',
      BrowserAiLanguageDetectorComponent,
      { detect: vi.fn().mockRejectedValue(new Error('detection failed')) },
      {},
      'detection failed'
    ],
    [
      'Proofreader',
      BrowserAiProofreaderComponent,
      { proofread: vi.fn().mockRejectedValue('failed') },
      {},
      'Browser AI request failed'
    ]
  ] as const)('reports %s failures', async (globalName, component, overrides, inputs, expected) => {
    installTextApi(globalName, overrides);
    const rendered = await render<InstanceType<TextComponent>>(component, inputs);
    const requestError = vi.fn();
    (
      rendered.instance as { requestError: { subscribe(callback: (error: unknown) => void): unknown } }
    ).requestError.subscribe(requestError);
    await (rendered.instance as { execute(value: string): Promise<void> }).execute('Input text');
    rendered.fixture.detectChanges();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain(expected);
    expect(requestError).toHaveBeenCalledOnce();
  });

  it('passes operation options and formats incomplete language results', async () => {
    const detector = installTextApi('LanguageDetector', {
      detect: vi.fn().mockResolvedValue([{ detectedLanguage: undefined, confidence: undefined }])
    });
    const rendered = await render(BrowserAiLanguageDetectorComponent, {
      options: { expectedInputLanguages: ['en'] }
    });
    expect(rendered.instance.resultText()).toBe('');
    expect(rendered.container.textContent).toContain('Language results will appear');
    await rendered.instance.execute('???');
    rendered.fixture.detectChanges();
    expect(rendered.instance.resultText()).toBe('Unknown (und): 0%');
    expect(detector.create).toHaveBeenCalledWith(
      expect.objectContaining({ expectedInputLanguages: ['en'], signal: expect.any(AbortSignal) })
    );
  });
});

function failingStream(error: unknown) {
  return new ReadableStream<string>({
    pull(controller) {
      controller.error(error);
    }
  });
}
