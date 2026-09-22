import { createApp, defineComponent, h, nextTick, reactive, type Component } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toolMocks = vi.hoisted(() => ({ apis: {} as Record<string, Record<string, unknown>> }));

vi.mock('../src/composables/useSummarizer', async () => {
  const { computed, ref } = await import('vue');
  const api = {
    availability: ref<Availability | null>('available'),
    downloadProgress: ref(0),
    inputUsage: ref<number | null>(4),
    inputQuota: ref<number | null>(100),
    progressState: ref<Record<string, unknown>>({ phase: 'idle' }),
    lastResult: ref<Record<string, unknown> | null>(null),
    isProcessing: ref(false),
    requestAvailability: vi.fn(async () => 'available' as Availability),
    summarizeWithDetails: vi.fn(),
    dispose: vi.fn()
  };
  toolMocks.apis.summarizer = api;
  return { useSummarizer: () => ({ ...api, isReady: computed(() => api.availability.value === 'available') }) };
});

vi.mock('../src/composables/useWriter', async () => {
  const { ref } = await import('vue');
  const api = {
    availability: ref<Availability | null>('available'),
    downloadProgress: ref(0),
    inputUsage: ref<number | null>(5),
    inputQuota: ref<number | null>(200),
    progressState: ref<Record<string, unknown>>({ phase: 'idle' }),
    lastResult: ref<Record<string, unknown> | null>(null),
    isProcessing: ref(false),
    requestAvailability: vi.fn(async () => 'available' as Availability),
    writeWithDetails: vi.fn(),
    writeStreamingToText: vi.fn(),
    dispose: vi.fn()
  };
  toolMocks.apis.writer = api;
  return { useWriter: () => api };
});

vi.mock('../src/composables/useRewriter', async () => {
  const { ref } = await import('vue');
  const api = {
    availability: ref<Availability | null>('available'),
    downloadProgress: ref(0),
    inputUsage: ref<number | null>(6),
    inputQuota: ref<number | null>(300),
    progressState: ref<Record<string, unknown>>({ phase: 'idle' }),
    lastResult: ref<Record<string, unknown> | null>(null),
    isProcessing: ref(false),
    requestAvailability: vi.fn(async () => 'available' as Availability),
    rewriteWithDetails: vi.fn(),
    rewriteStreamingToText: vi.fn(),
    dispose: vi.fn()
  };
  toolMocks.apis.rewriter = api;
  return { useRewriter: () => api };
});

vi.mock('../src/composables/useLanguageDetector', async () => {
  const { ref } = await import('vue');
  const api = {
    availability: ref<Availability | null>('available'),
    downloadProgress: ref(0),
    inputUsage: ref<number | null>(7),
    inputQuota: ref<number | null>(400),
    progressState: ref<Record<string, unknown>>({ phase: 'idle' }),
    results: ref<Record<string, unknown>[]>([]),
    lastResult: ref<Record<string, unknown> | null>(null),
    isProcessing: ref(false),
    requestAvailability: vi.fn(async () => 'available' as Availability),
    detectWithDetails: vi.fn(),
    dispose: vi.fn()
  };
  toolMocks.apis.detector = api;
  return { useLanguageDetector: () => api, getLanguageDetectorLanguageName: (code: string) => code.toUpperCase() };
});

vi.mock('../src/composables/useProofreader', async () => {
  const { ref } = await import('vue');
  const api = {
    availability: ref<Availability | null>('available'),
    downloadProgress: ref(0),
    progressState: ref<Record<string, unknown>>({ phase: 'idle' }),
    corrections: ref<Record<string, unknown>[]>([]),
    lastResult: ref<Record<string, unknown> | null>(null),
    isProcessing: ref(false),
    requestAvailability: vi.fn(async () => 'available' as Availability),
    proofreadWithDetails: vi.fn(),
    createProofreadTextSegments: vi.fn(),
    dispose: vi.fn()
  };
  toolMocks.apis.proofreader = api;
  return { useProofreader: () => api, getProofreaderLanguageName: (code: string) => code.toUpperCase() };
});

vi.mock('../src/composables/useTranslator', async () => {
  const { ref } = await import('vue');
  const api = {
    availability: ref<Availability | null>('available'),
    downloadProgress: ref(0),
    inputUsage: ref<number | null>(8),
    inputQuota: ref<number | null>(500),
    progressState: ref<Record<string, unknown>>({ phase: 'idle' }),
    lastResult: ref<Record<string, unknown> | null>(null),
    isProcessing: ref(false),
    requestAvailability: vi.fn(async () => 'available' as Availability),
    create: vi.fn(),
    interrupt: vi.fn(),
    translateWithDetails: vi.fn(),
    translateStreamingToText: vi.fn(),
    dispose: vi.fn()
  };
  toolMocks.apis.translator = api;
  return {
    useTranslator: () => api,
    TRANSLATOR_LANGUAGE_OPTIONS: [
      { code: 'en', name: 'English' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' }
    ],
    getTranslatorLanguageName: (code: string) => ({ en: 'English', fr: 'French', de: 'German' })[code] ?? code
  };
});

import LanguageDetector from '../src/components/LanguageDetector.vue';
import Proofreader from '../src/components/Proofreader.vue';
import Rewriter from '../src/components/Rewriter.vue';
import Summarizer from '../src/components/Summarizer.vue';
import TextTool from '../src/components/TextTool.vue';
import Translator from '../src/components/Translator.vue';
import Writer from '../src/components/Writer.vue';

type LooseApi = Record<string, any>;
const api = (name: string) => toolMocks.apis[name] as LooseApi;
const apps = new Set<ReturnType<typeof createApp>>();

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
};

const mount = async (
  component: Component,
  initialProps: Record<string, unknown> = {},
  slots?: Record<string, () => unknown>
) => {
  const props = reactive({ ...initialProps });
  const container = document.createElement('div');
  document.body.append(container);
  const root = defineComponent({ setup: () => () => h(component, props, slots) });
  const app = createApp(root);
  apps.add(app);
  app.mount(container);
  await flush();
  return {
    container,
    props,
    async unmount() {
      if (apps.delete(app)) app.unmount();
      container.remove();
      await flush();
    }
  };
};

const change = async (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string | boolean) => {
  if (typeof value === 'boolean') (element as HTMLInputElement).checked = value;
  else element.value = value;
  const event = typeof value === 'boolean' || element instanceof HTMLSelectElement ? 'change' : 'input';
  element.dispatchEvent(new Event(event, { bubbles: true }));
  await flush();
};

const field = (container: Element, label: string) => {
  const wrapper = [...container.querySelectorAll('label')].find((element) =>
    element.textContent?.trim().startsWith(label)
  );
  const input = wrapper?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input, textarea, select'
  );
  expect(input, `field ${label}`).toBeTruthy();
  return input!;
};

const click = async (container: Element, label: string) => {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
  expect(button, `button ${label}`).toBeTruthy();
  button!.click();
  await flush();
};

const setPhase = async (name: string, phase: string, extra: Record<string, unknown> = {}) => {
  api(name).progressState.value = { phase, ...extra };
  await nextTick();
};

beforeEach(() => {
  for (const value of Object.values(toolMocks.apis).map((entry) => entry as LooseApi)) {
    value.availability.value = 'available';
    value.downloadProgress.value = 0;
    value.progressState.value = { phase: 'idle' };
    value.lastResult.value = null;
    value.isProcessing.value = false;
    value.requestAvailability.mockClear();
    value.dispose.mockClear();
  }
  api('summarizer')
    .summarizeWithDetails.mockReset()
    .mockImplementation(async (input: string, options: LooseApi) => {
      const result = { summary: `summary:${input}`, chunked: false };
      options.onProgress?.({ phase: 'ready' });
      api('summarizer').lastResult.value = result;
      return result;
    });
  for (const name of ['writer', 'rewriter']) {
    const value = api(name);
    const direct = name === 'writer' ? 'writeWithDetails' : 'rewriteWithDetails';
    const stream = name === 'writer' ? 'writeStreamingToText' : 'rewriteStreamingToText';
    value[direct].mockReset().mockImplementation(async (input: string, options: LooseApi) => {
      const result = { text: `${name}:${input}`, fitted: false };
      options.onProgress?.({ phase: 'ready' });
      value.lastResult.value = result;
      return result;
    });
    value[stream].mockReset().mockImplementation(async (input: string, options: LooseApi, onChunk: Function) => {
      const result = { text: `${name}:${input}`, fitted: true };
      onChunk(name, result.text);
      options.onProgress?.({ phase: 'ready' });
      value.lastResult.value = result;
      return result.text;
    });
  }
  api('detector').results.value = [];
  api('detector')
    .detectWithDetails.mockReset()
    .mockImplementation(async (_input: string, options: LooseApi) => {
      const results = [{ detectedLanguage: 'en', name: 'English', confidence: 0.98 }];
      const result = { ...results[0], results, chunks: [], chunked: false, sampled: false };
      options.onProgress?.({ phase: 'ready' });
      api('detector').results.value = results;
      api('detector').lastResult.value = result;
      return result;
    });
  api('proofreader').corrections.value = [];
  api('proofreader').createProofreadTextSegments.mockReset().mockReturnValue([]);
  api('proofreader')
    .proofreadWithDetails.mockReset()
    .mockImplementation(async (input: string, options: LooseApi) => {
      const result = {
        input,
        correctedInput: input,
        corrections: [],
        chunks: [],
        hasCorrections: false,
        chunked: false
      };
      options.onProgress?.({ phase: 'ready' });
      api('proofreader').lastResult.value = result;
      return result;
    });
  api('translator').requestAvailability.mockReset().mockResolvedValue('available');
  api('translator').create.mockReset().mockResolvedValue({});
  api('translator').interrupt.mockClear();
  api('translator')
    .translateWithDetails.mockReset()
    .mockImplementation(async (input: string, options: LooseApi) => {
      const result = { translation: `translated:${input}`, chunks: [], chunked: false, bypassed: false };
      options.onProgress?.({ phase: 'ready' });
      api('translator').lastResult.value = result;
      return result;
    });
  api('translator')
    .translateStreamingToText.mockReset()
    .mockImplementation(async (input: string, options: LooseApi, onChunk: Function) => {
      const result = { translation: `streamed:${input}`, chunks: [], chunked: true, bypassed: false };
      onChunk('streamed', result.translation);
      options.onProgress?.({ phase: 'ready' });
      api('translator').lastResult.value = result;
      return result.translation;
    });
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => undefined) } });
});

afterEach(async () => {
  for (const app of apps) app.unmount();
  apps.clear();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('TextTool', () => {
  it('renders empty, plain, markdown, busy, error, status, settings, slots, and actions', async () => {
    const events = { update: vi.fn(), run: vi.fn(), copy: vi.fn() };
    const view = await mount(
      TextTool,
      {
        modelValue: '',
        output: '',
        inputLabel: 'Input',
        outputLabel: 'Output',
        actionLabel: 'Run',
        busyActionLabel: 'Running',
        placeholder: 'Type',
        emptyOutputMessage: 'Empty',
        settingsSummary: 'Default',
        inputMeta: '0 chars',
        outputMeta: 'Plain',
        availability: null,
        downloadProgress: 0,
        busy: false,
        disabled: false,
        canRun: true,
        progressPercent: 8,
        errorMessage: '',
        showSettings: false,
        showAction: false,
        renderMarkdown: false,
        copyable: true,
        'onUpdate:modelValue': events.update,
        onRun: events.run,
        onCopy: events.copy
      },
      {
        'input-before': () => h('span', 'Before'),
        'input-after': () => h('span', 'After'),
        meta: () => h('span', 'Meta')
      }
    );
    expect(view.container.textContent).toContain('Empty');
    expect(view.container.textContent).toContain('Checking');
    await change(view.container.querySelector('textarea')!, 'hello');
    expect(events.update).toHaveBeenCalledWith('hello');

    Object.assign(view.props, {
      output: 'plain output',
      showSettings: true,
      showAction: true,
      statusText: 'Custom',
      downloadProgress: 50,
      busy: true,
      errorMessage: 'Failed'
    });
    await flush();
    expect(view.container.textContent).toContain('Running');
    expect(view.container.textContent).toContain('Downloading 50%');
    expect(view.container.textContent).toContain('Failed');
    await click(view.container, 'Running');
    await click(view.container, 'Copy');
    expect(events.run).toHaveBeenCalledOnce();
    expect(events.copy).toHaveBeenCalledOnce();

    Object.assign(view.props, {
      busy: false,
      output: '# Markdown',
      renderMarkdown: true,
      statusText: '',
      availability: 'available'
    });
    await flush();
    expect(view.container.querySelector('.browser-ai-markdown h1')?.textContent).toBe('Markdown');
    await view.unmount();
  });
});

describe('Summarizer', () => {
  it('forwards edited text, context visibility, and HTML settings to the workflow', async () => {
    const update = vi.fn();
    const view = await mount(Summarizer, {
      modelValue: 'Original',
      autoInit: false,
      autoCreate: false,
      sharedContext: 'Project background',
      outputLanguage: 'fr',
      'onUpdate:modelValue': update
    });
    await change(view.container.querySelector('textarea')!, '<p>New article</p>');
    await change(field(view.container, 'Strip HTML'), false);
    await change(field(view.container, 'Additional context'), true);
    await change(view.container.querySelector<HTMLTextAreaElement>('.writing-tool__context textarea')!, 'Keep dates');
    await click(view.container, 'Summarize');
    expect(update).toHaveBeenCalledWith('<p>New article</p>');
    expect(api('summarizer').summarizeWithDetails).toHaveBeenLastCalledWith(
      '<p>New article</p>',
      expect.objectContaining({
        autoCreate: false,
        stripHtml: false,
        context: 'Keep dates',
        createOptions: expect.objectContaining({ sharedContext: 'Project background', outputLanguage: 'fr' })
      })
    );
    await change(view.container.querySelector<HTMLTextAreaElement>('.writing-tool__context textarea')!, '');
    await click(view.container, 'Summarize');
    expect(api('summarizer').summarizeWithDetails.mock.lastCall[1].context).toBeUndefined();
    await change(field(view.container, 'Additional context'), false);
    expect(view.container.querySelector('.writing-tool__context')).toBeNull();
    view.props.context = '';
    await flush();
  });

  it('runs with settings and context, emits events, and renders progress variants', async () => {
    const events = { update: vi.fn(), availability: vi.fn(), progress: vi.fn(), summary: vi.fn(), error: vi.fn() };
    const view = await mount(Summarizer, {
      modelValue: 'Article',
      context: 'Facts',
      'onUpdate:modelValue': events.update,
      onAvailabilityChange: events.availability,
      onProgress: events.progress,
      onSummary: events.summary,
      onError: events.error
    });
    expect(api('summarizer').requestAvailability).toHaveBeenCalled();
    await click(view.container, 'Summarize');
    expect(view.container.textContent).toContain('summary:Article');
    expect(events.summary).toHaveBeenCalledOnce();
    expect(events.progress).toHaveBeenCalled();

    for (const [phase, extra] of [
      ['measuring', {}],
      ['chunking', {}],
      ['summarizing', { totalChunks: 1 }],
      ['summarizing', { totalChunks: 3, currentChunk: 2, processedChunks: 1 }],
      ['rolling-up', {}],
      ['ready', {}]
    ] as const) {
      await setPhase('summarizer', phase, extra);
    }
    api('summarizer').lastResult.value = { summary: 'x', chunked: true };
    api('summarizer').downloadProgress.value = 25;
    await flush();
    expect(view.container.textContent).toContain('Chunked');

    const selects = view.container.querySelectorAll('select');
    await change(selects[0]!, 'headline');
    await change(selects[1]!, 'long');
    await change(selects[2]!, 'plain-text');
    await change(selects[3]!, 'speed');
    expect(view.container.textContent).toContain('Headline / Long / Plain text / Speed');
    Object.assign(view.props, { context: 'Changed' });
    await flush();
    await view.unmount();
    expect(api('summarizer').dispose).toHaveBeenCalled();
  });

  it('guards disabled work and reports Error and non-Error failures', async () => {
    const error = vi.fn();
    const disabled = await mount(Summarizer, { modelValue: 'Text', disabled: true, autoInit: false, onError: error });
    expect(disabled.container.querySelector('button[type="button"]')?.hasAttribute('disabled')).toBe(true);
    await disabled.unmount();

    api('summarizer')
      .summarizeWithDetails.mockRejectedValueOnce(new Error('native failure'))
      .mockRejectedValueOnce('failure');
    const view = await mount(Summarizer, { modelValue: 'Text', autoInit: false, onError: error });
    await click(view.container, 'Summarize');
    expect(view.container.textContent).toContain('native failure');
    await click(view.container, 'Summarize');
    expect(view.container.textContent).toContain('Unable to summarize');
    expect(error).toHaveBeenCalledTimes(2);
  });
});

describe('Writer and Rewriter', () => {
  it.each(['writer', 'rewriter'] as const)(
    'forwards %s settings and wrapper errors after manual edits',
    async (name) => {
      const action = name === 'writer' ? 'Write' : 'Rewrite';
      const direct = name === 'writer' ? 'writeWithDetails' : 'rewriteWithDetails';
      const update = vi.fn();
      const error = vi.fn();
      const view = await mount(name === 'writer' ? Writer : Rewriter, {
        modelValue: 'Original',
        sharedContext: 'House style',
        outputLanguage: 'en',
        'onUpdate:modelValue': update,
        onError: error
      });
      await change(view.container.querySelector('textarea')!, 'Edited text');
      await change(field(view.container, 'Strip HTML'), false);
      await change(field(view.container, name === 'writer' ? 'Additional context' : 'Rewrite guidance'), true);
      await change(view.container.querySelector<HTMLTextAreaElement>('.writing-tool__context textarea')!, 'Keep names');
      await change(field(view.container, 'Stream output'), false);
      await click(view.container, action);
      expect(update).toHaveBeenCalledWith('Edited text');
      expect(api(name)[direct]).toHaveBeenLastCalledWith(
        'Edited text',
        expect.objectContaining({
          context: 'Keep names',
          stripHtml: false,
          createOptions: expect.objectContaining({ sharedContext: 'House style', outputLanguage: 'en' })
        })
      );
      await change(view.container.querySelector<HTMLTextAreaElement>('.writing-tool__context textarea')!, '');
      await click(view.container, action);
      expect(api(name)[direct].mock.lastCall[1].context).toBeUndefined();
      await change(field(view.container, name === 'writer' ? 'Additional context' : 'Rewrite guidance'), false);
      api(name)[direct].mockRejectedValueOnce('native rejected');
      await click(view.container, action);
      expect(error).toHaveBeenCalledExactlyOnceWith('native rejected');
      expect(view.container.textContent).toContain(name === 'writer' ? 'Unable to write from' : 'Unable to rewrite');
    }
  );

  it('covers streamed writer controls, progress, copy, props, and wrapper events', async () => {
    const events = { write: vi.fn(), progress: vi.fn(), update: vi.fn(), availability: vi.fn() };
    const view = await mount(Writer, {
      modelValue: 'Brief',
      context: 'Audience',
      onWrite: events.write,
      onProgress: events.progress,
      'onUpdate:modelValue': events.update,
      onAvailabilityChange: events.availability
    });
    await click(view.container, 'Write');
    expect(view.container.textContent).toContain('writer:Brief');
    expect(events.write).toHaveBeenCalledWith(expect.objectContaining({ fitted: true }));
    await click(view.container, 'Copy');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('writer:Brief');

    for (const phase of ['measuring', 'fitting-context', 'writing', 'ready', 'idle']) await setPhase('writer', phase);
    const selects = view.container.querySelectorAll('select');
    await change(selects[0]!, 'formal');
    await change(selects[1]!, 'long');
    await change(selects[2]!, 'plain-text');
    await change(selects[3]!, 'error');
    Object.assign(view.props, { context: 'New context' });
    await change(view.container.querySelector('textarea')!, 'New brief');
    expect(events.update).toHaveBeenCalledWith('New brief');
    await view.unmount();
  });

  it('covers direct rewriter behavior, both fallback errors, and unavailable guards', async () => {
    const events = { rewrite: vi.fn(), error: vi.fn() };
    const view = await mount(Rewriter, {
      modelValue: 'Original',
      stream: false,
      onRewrite: events.rewrite,
      onError: events.error
    });
    await click(view.container, 'Rewrite');
    expect(events.rewrite).toHaveBeenCalledWith(expect.objectContaining({ text: 'rewriter:Original' }));
    for (const phase of ['rewriting', 'measuring', 'fitting-context', 'ready', 'idle'])
      await setPhase('rewriter', phase);

    api('rewriter').rewriteWithDetails.mockRejectedValueOnce(new Error('rewrite failed')).mockRejectedValueOnce('bad');
    await click(view.container, 'Rewrite');
    expect(view.container.textContent).toContain('rewrite failed');
    await click(view.container, 'Rewrite');
    expect(view.container.textContent).toContain('Unable to rewrite');
    api('rewriter').availability.value = 'unavailable';
    await flush();
    expect(
      [...view.container.querySelectorAll('button')]
        .find((item) => item.textContent?.trim() === 'Rewrite')
        ?.hasAttribute('disabled')
    ).toBe(true);
    await view.unmount();
  });

  it('covers non-streamed writer and streamed rewriter branches', async () => {
    const writer = await mount(Writer, { modelValue: 'Direct', stream: false });
    await click(writer.container, 'Write');
    expect(api('writer').writeWithDetails).toHaveBeenCalled();
    await writer.unmount();
    const rewriter = await mount(Rewriter, { modelValue: 'Stream', stream: true });
    await click(rewriter.container, 'Rewrite');
    expect(api('rewriter').rewriteStreamingToText).toHaveBeenCalled();
    await rewriter.unmount();
  });
});

describe('LanguageDetector', () => {
  it('sends edited language hints, confidence, result count, and sampling controls', async () => {
    const update = vi.fn();
    const progress = vi.fn();
    const view = await mount(LanguageDetector, {
      modelValue: 'Hello',
      'onUpdate:modelValue': update,
      onProgress: progress
    });
    await change(view.container.querySelector('textarea')!, 'Bonjour');
    await change(field(view.container, 'Expected languages'), ' fr, , de ');
    await change(field(view.container, 'Confidence'), '0.65');
    await change(field(view.container, 'Results'), '8');
    await change(field(view.container, 'Long input'), 'sample');
    await change(field(view.container, 'Strip HTML'), false);
    await click(view.container, 'Detect');
    expect(update).toHaveBeenCalledWith('Bonjour');
    expect(progress).toHaveBeenCalledWith({ phase: 'ready' });
    expect(api('detector').detectWithDetails).toHaveBeenLastCalledWith(
      'Bonjour',
      expect.objectContaining({
        createOptions: { expectedInputLanguages: ['fr', 'de'] },
        minConfidence: 0.65,
        maxResults: 8,
        largeInputStrategy: 'sample',
        stripHtml: false
      })
    );
    expect(view.container.textContent).toContain('65% threshold');
    api('detector').availability.value = 'unavailable';
    await flush();
    expect(
      [...view.container.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Detect')?.disabled
    ).toBe(true);
  });

  it('renders ranked results, all result metadata, settings, progress, and copy', async () => {
    const detect = vi.fn();
    const view = await mount(LanguageDetector, {
      modelValue: 'Hello world',
      expectedInputLanguages: ['en'],
      onDetect: detect
    });
    await click(view.container, 'Detect');
    expect(detect).toHaveBeenCalledOnce();
    expect(view.container.textContent).toContain('98% confidence');
    await click(view.container, 'Copy code');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('en');

    for (const [phase, extra] of [
      ['measuring', {}],
      ['chunking', {}],
      ['detecting', { totalChunks: 0 }],
      ['detecting', { totalChunks: 3, currentChunk: 2, processedChunks: 1 }],
      ['ready', {}]
    ] as const)
      await setPhase('detector', phase, extra);
    api('detector').lastResult.value = {
      detectedLanguage: 'en',
      name: 'English',
      confidence: 0.9,
      results: [{}],
      chunks: [{}, {}],
      chunked: true,
      sampled: false
    };
    await flush();
    expect(view.container.textContent).toContain('2 chunks analyzed');
    api('detector').lastResult.value = {
      detectedLanguage: 'en',
      name: 'English',
      confidence: 0.9,
      results: [{}],
      chunks: [],
      chunked: false,
      sampled: true
    };
    await flush();
    expect(view.container.textContent).toContain('Representative sample');
    Object.assign(view.props, { expectedInputLanguages: [] });
    await flush();
    expect(view.container.textContent).toContain('All detectable languages');
    await view.unmount();
  });

  it('reports native and fallback errors', async () => {
    api('detector').detectWithDetails.mockRejectedValueOnce(new Error('detect failed')).mockRejectedValueOnce('bad');
    const error = vi.fn();
    const view = await mount(LanguageDetector, { modelValue: 'Text', onError: error });
    await click(view.container, 'Detect');
    await click(view.container, 'Detect');
    expect(error).toHaveBeenCalledTimes(2);
    expect(view.container.textContent).toContain('Unable to detect');
  });
});

describe('Proofreader', () => {
  it('forwards edited correction settings and disables the explanation language when explanations are off', async () => {
    const update = vi.fn();
    const view = await mount(Proofreader, { modelValue: 'Original', 'onUpdate:modelValue': update });
    await change(view.container.querySelector('textarea')!, 'Edited');
    await change(field(view.container, 'Expected languages'), ' fr, , en ');
    await change(field(view.container, 'Long input'), 'never');
    await change(field(view.container, 'Chunk size'), '12000');
    await change(field(view.container, 'Strip HTML'), false);
    await change(field(view.container, 'Correction types'), false);
    await change(field(view.container, 'Explanations'), true);
    await change(field(view.container, 'Explanation language'), 'fr');
    await click(view.container, 'Proofread');
    expect(update).toHaveBeenCalledWith('Edited');
    expect(api('proofreader').proofreadWithDetails).toHaveBeenLastCalledWith(
      'Edited',
      expect.objectContaining({
        createOptions: {
          expectedInputLanguages: ['fr', 'en'],
          includeCorrectionTypes: false,
          includeCorrectionExplanations: true,
          correctionExplanationLanguage: 'fr'
        },
        largeInputStrategy: 'never',
        maxChunkCharacters: 12000,
        stripHtml: false
      })
    );
    await change(field(view.container, 'Explanations'), false);
    expect(field(view.container, 'Explanation language').disabled).toBe(true);
    await click(view.container, 'Proofread');
    expect(
      api('proofreader').proofreadWithDetails.mock.lastCall[1].createOptions.correctionExplanationLanguage
    ).toBeUndefined();
  });

  it('renders unchanged segments beside corrections without optional type or explanation labels', async () => {
    const correction = {
      index: 0,
      startIndex: 6,
      endIndex: 9,
      original: 'teh',
      correction: 'the',
      correctedText: 'the',
      types: [],
      explanation: ''
    };
    api('proofreader').proofreadWithDetails.mockImplementationOnce(async () => {
      const result = {
        input: 'Keep: teh',
        correctedInput: 'Keep: the',
        corrections: [correction],
        chunks: [],
        hasCorrections: true,
        chunked: false
      };
      api('proofreader').corrections.value = [correction];
      api('proofreader').lastResult.value = result;
      api('proofreader').createProofreadTextSegments.mockReturnValue([
        { text: 'Keep: ' },
        { correction, correctedText: 'the' }
      ]);
      return result;
    });
    const view = await mount(Proofreader, { modelValue: 'Keep: teh' });
    await click(view.container, 'Proofread');
    expect(view.container.querySelector('.browser-ai-proofreader-result__text')?.textContent).toBe('Keep: the');
    expect(view.container.textContent).toContain('1 correction');
    expect(view.container.querySelector('.browser-ai-proofreader-result__corrections small')).toBeNull();
    expect(view.container.querySelector('.browser-ai-proofreader-result__corrections p')).toBeNull();
  });

  it('renders corrections, markdown, result states, settings, progress, and copy', async () => {
    const correction = {
      index: 0,
      startIndex: 0,
      endIndex: 3,
      original: 'teh',
      correction: 'the',
      correctedText: 'the',
      types: ['spelling'],
      explanation: 'Typo'
    };
    const result = {
      input: 'teh',
      correctedInput: 'the',
      corrections: [correction],
      chunks: [{}, {}],
      hasCorrections: true,
      chunked: true
    };
    api('proofreader').proofreadWithDetails.mockImplementationOnce(async (_input: string, options: LooseApi) => {
      options.onProgress?.({ phase: 'ready' });
      api('proofreader').corrections.value = [correction];
      api('proofreader').lastResult.value = result;
      api('proofreader').createProofreadTextSegments.mockReturnValue([{ correction, correctedText: 'the' }]);
      return result;
    });
    const proofread = vi.fn();
    const view = await mount(Proofreader, {
      modelValue: 'teh',
      expectedInputLanguages: ['en'],
      includeCorrectionTypes: true,
      includeCorrectionExplanations: true,
      onProofread: proofread
    });
    await click(view.container, 'Proofread');
    expect(view.container.textContent).toContain('Typo');
    expect(view.container.querySelector('mark')?.title).toContain('Replace');
    await click(view.container, 'Copy');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('the');
    for (const [phase, extra] of [
      ['measuring', {}],
      ['chunking', {}],
      ['proofreading', { totalChunks: 0 }],
      ['proofreading', { totalChunks: 2, currentChunk: 1, processedChunks: 1 }],
      ['ready', {}]
    ] as const)
      await setPhase('proofreader', phase, extra);
    Object.assign(view.props, { expectedInputLanguages: [] });
    await flush();
    expect(view.container.textContent).toContain('Any supported language');
    await view.unmount();

    const markdown = await mount(Proofreader, { modelValue: 'text', renderMarkdown: true });
    await click(markdown.container, 'Proofread');
    expect(markdown.container.querySelector('.browser-ai-markdown')).toBeTruthy();
    await markdown.unmount();
  });

  it('covers unchanged results and both error fallbacks', async () => {
    const view = await mount(Proofreader, { modelValue: 'Correct' });
    await click(view.container, 'Proofread');
    expect(view.container.textContent).toContain('No changes suggested');
    api('proofreader')
      .proofreadWithDetails.mockRejectedValueOnce(new Error('proof failed'))
      .mockRejectedValueOnce('bad');
    await click(view.container, 'Proofread');
    await click(view.container, 'Proofread');
    expect(view.container.textContent).toContain('Unable to proofread');
  });
});

describe('Translator', () => {
  it('checks an unknown language pair on demand and displays an active model download', async () => {
    api('translator').availability.value = null;
    const view = await mount(Translator, {
      modelValue: 'Hello',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      autoInit: false,
      autoTranslate: false
    });
    expect(view.container.textContent).toContain('Checking');
    expect(api('translator').requestAvailability).not.toHaveBeenCalled();
    await click(view.container, 'Translate');
    expect(api('translator').requestAvailability).toHaveBeenCalledExactlyOnceWith({
      sourceLanguage: 'en',
      targetLanguage: 'fr'
    });
    expect(api('translator').translateStreamingToText).not.toHaveBeenCalled();

    api('translator').availability.value = 'downloading';
    api('translator').downloadProgress.value = 45;
    api('translator').isProcessing.value = true;
    await setPhase('translator', 'creating');
    expect(view.container.textContent).toContain('45%');
    const download = [...view.container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Downloading'
    );
    expect(download?.disabled).toBe(true);
    api('translator').isProcessing.value = false;
    api('translator').downloadProgress.value = 0;
    await flush();
    await click(view.container, 'Download pack');
    expect(api('translator').create).toHaveBeenCalledExactlyOnceWith({ sourceLanguage: 'en', targetLanguage: 'fr' });
  });

  it('forwards manually selected languages and toggles, then clears output when automatic input is emptied', async () => {
    vi.useFakeTimers();
    const update = vi.fn();
    const view = await mount(Translator, {
      modelValue: 'Hello',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      autoTranslate: false,
      'onUpdate:modelValue': update
    });
    await change(field(view.container, 'From'), 'de');
    await change(field(view.container, 'To'), 'en');
    await change(field(view.container, 'Strip HTML'), false);
    await change(field(view.container, 'Auto chunk long text'), false);
    await change(field(view.container, 'Stream output'), false);
    await change(view.container.querySelector('textarea')!, 'Guten Tag');
    await click(view.container, 'Translate');
    expect(update).toHaveBeenCalledWith('Guten Tag');
    expect(api('translator').translateWithDetails).toHaveBeenLastCalledWith(
      'Guten Tag',
      expect.objectContaining({
        createOptions: { sourceLanguage: 'de', targetLanguage: 'en' },
        stripHtml: false,
        chunking: 'never'
      })
    );
    expect(view.container.textContent).toContain('translated:Guten Tag');
    await change(field(view.container, 'Auto translate'), true);
    await change(view.container.querySelector('textarea')!, '');
    expect(view.container.textContent).not.toContain('translated:Guten Tag');
    await vi.runOnlyPendingTimersAsync();
    expect(api('translator').translateWithDetails).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    'ignores obsolete translation completion after language selection changes; streamed: %s',
    async (stream) => {
      let resolve!: (result: unknown) => void;
      let emitChunk: ((_chunk: string, accumulated: string) => void) | undefined;
      const method = stream ? 'translateStreamingToText' : 'translateWithDetails';
      api('translator')[method].mockImplementationOnce(
        (_input: string, _options: unknown, onChunk?: typeof emitChunk) => {
          emitChunk = onChunk;
          return new Promise((complete) => {
            resolve = complete;
          });
        }
      );
      const translated = vi.fn();
      const view = await mount(Translator, {
        modelValue: 'Old text',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        autoTranslate: false,
        stream,
        onTranslate: translated
      });
      await click(view.container, 'Translate');
      await change(field(view.container, 'To'), 'de');
      emitChunk?.('obsolete', 'obsolete');
      api('translator').lastResult.value = { translation: 'obsolete' };
      resolve(stream ? 'obsolete' : { translation: 'obsolete' });
      await flush();
      expect(translated).not.toHaveBeenCalled();
      expect(view.container.textContent).not.toContain('obsolete');
    }
  );

  it('manually translates, streams, swaps, prepares downloads, and renders all progress states', async () => {
    const translated = vi.fn();
    const view = await mount(Translator, {
      modelValue: 'Hello',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      autoTranslate: false,
      stream: false,
      onTranslate: translated
    });
    await click(view.container, 'Translate');
    expect(translated).toHaveBeenCalledWith(expect.objectContaining({ translation: 'translated:Hello' }));
    await click(view.container, 'Copy');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('translated:Hello');
    await click(view.container, 'Swap');
    expect(view.container.querySelector('textarea')?.value).toBe('translated:Hello');

    for (const [phase, extra] of [
      ['measuring', {}],
      ['chunking', {}],
      ['translating', { totalChunks: 0 }],
      ['translating', { totalChunks: 3, currentChunk: 2, processedChunks: 1 }],
      ['ready', {}]
    ] as const)
      await setPhase('translator', phase, extra);
    api('translator').availability.value = 'downloadable';
    await flush();
    await click(view.container, 'Download pack');
    expect(api('translator').create).toHaveBeenCalled();
    await view.unmount();

    api('translator').availability.value = 'available';
    const stream = await mount(Translator, {
      modelValue: 'Hello',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      autoTranslate: false,
      stream: true
    });
    await click(stream.container, 'Translate');
    expect(stream.container.textContent).toContain('streamed:Hello');
    await stream.unmount();
  });

  it('auto-translates after debounce and handles empty, busy, unavailable, stale, abort, and errors', async () => {
    vi.useFakeTimers();
    const error = vi.fn();
    const view = await mount(Translator, {
      modelValue: 'Auto',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      debounceMs: -1,
      onError: error
    });
    await vi.runOnlyPendingTimersAsync();
    await flush();
    expect(api('translator').translateStreamingToText).toHaveBeenCalled();

    api('translator').isProcessing.value = true;
    api('translator').progressState.value = { phase: 'translating' };
    await change(view.container.querySelector('textarea')!, 'Queued');
    expect(api('translator').interrupt).toHaveBeenCalled();
    api('translator').isProcessing.value = false;
    await flush();
    await vi.runOnlyPendingTimersAsync();
    await flush();

    api('translator').translateStreamingToText.mockRejectedValueOnce(new DOMException('stop', 'AbortError'));
    await change(view.container.querySelector('textarea')!, 'Abort');
    await vi.runOnlyPendingTimersAsync();
    await flush();
    expect(error).not.toHaveBeenCalled();
    api('translator')
      .translateStreamingToText.mockRejectedValueOnce(new Error('translate failed'))
      .mockRejectedValueOnce('bad');
    await change(view.container.querySelector('textarea')!, 'Fail one');
    await vi.runOnlyPendingTimersAsync();
    await flush();
    await change(view.container.querySelector('textarea')!, 'Fail two');
    await vi.runOnlyPendingTimersAsync();
    await flush();
    expect(error).toHaveBeenCalledTimes(2);
    expect(view.container.textContent).toContain('Unable to translate');

    api('translator').availability.value = 'unavailable';
    await change(view.container.querySelector('textarea')!, 'Unavailable');
    Object.assign(view.props, { sourceLanguage: '', targetLanguage: '', autoTranslate: false });
    await flush();
    await change(view.container.querySelector('textarea')!, '');
    await view.unmount();
  });

  it('reports pair preparation failures and supports custom language options', async () => {
    api('translator').availability.value = 'downloadable';
    api('translator').create.mockRejectedValueOnce(new Error('download failed')).mockRejectedValueOnce('bad');
    const error = vi.fn();
    const view = await mount(Translator, {
      modelValue: 'Text',
      sourceLanguage: 'en',
      targetLanguage: 'de',
      autoTranslate: false,
      languageOptions: [
        { code: 'en', name: 'English' },
        { code: 'de', name: 'German' }
      ],
      onError: error
    });
    await click(view.container, 'Download pack');
    expect(view.container.textContent).toContain('download failed');
    await click(view.container, 'Download pack');
    expect(view.container.textContent).toContain('Unable to prepare');
  });
});
