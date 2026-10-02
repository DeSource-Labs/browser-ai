import { createBrowserAiStore } from '@desource/browser-ai';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

const coreMocks = vi.hoisted(() => ({
  createPromptWorkflow: vi.fn(),
  createSummarizerWorkflow: vi.fn(),
  createWriterWorkflow: vi.fn(),
  createRewriterWorkflow: vi.fn(),
  createTranslatorWorkflow: vi.fn(),
  createLanguageDetectorWorkflow: vi.fn(),
  createProofreaderWorkflow: vi.fn()
}));

const chatsMocks = vi.hoisted(() => ({ createAiChats: vi.fn() }));

vi.mock('@desource/browser-ai/workflows', () => coreMocks);
vi.mock('@desource/browser-ai/chats', () => chatsMocks);

import {
  createSvelteAiChats,
  createBrowserAiWorkflow,
  createSvelteLanguageDetectorWorkflow,
  createSveltePromptWorkflow,
  createSvelteProofreaderWorkflow,
  createSvelteRewriterWorkflow,
  createSvelteSummarizerWorkflow,
  createSvelteTranslatorWorkflow,
  createSvelteWriterWorkflow
} from '../src/lib/workflows';

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const promptOptions = { onContextOverflow: vi.fn() };
const translatorOptions = { sourceLanguage: 'en', targetLanguage: 'fr' };
const detectorOptions = { expectedInputLanguages: ['en'] };
const proofreaderOptions = { includeCorrectionTypes: true };

interface WorkflowStatus {
  isReady: boolean;
  isProcessing: boolean;
  processing: string;
}

describe('Svelte workflow bindings', () => {
  it.each([
    ['Chat persistence', chatsMocks.createAiChats, () => createSvelteAiChats('prompt'), ['prompt']],
    ['Prompt API', coreMocks.createPromptWorkflow, () => createSveltePromptWorkflow(promptOptions), [promptOptions]],
    ['Summarizer', coreMocks.createSummarizerWorkflow, () => createSvelteSummarizerWorkflow(), []],
    ['Writer', coreMocks.createWriterWorkflow, () => createSvelteWriterWorkflow(), []],
    ['Rewriter', coreMocks.createRewriterWorkflow, () => createSvelteRewriterWorkflow(), []],
    [
      'Translator',
      coreMocks.createTranslatorWorkflow,
      () => createSvelteTranslatorWorkflow(translatorOptions),
      [translatorOptions]
    ],
    [
      'Language detector',
      coreMocks.createLanguageDetectorWorkflow,
      () => createSvelteLanguageDetectorWorkflow(detectorOptions),
      [detectorOptions]
    ],
    [
      'Proofreader',
      coreMocks.createProofreaderWorkflow,
      () => createSvelteProofreaderWorkflow(proofreaderOptions),
      [proofreaderOptions]
    ]
  ])('binds %s snapshots and arguments without deriving readiness from instance', (_name, factory, bind, args) => {
    const state = createBrowserAiStore({ processing: '', isReady: true, isProcessing: false, output: '' });
    const dispose = vi.fn();
    const stopObserving = vi.fn();
    const subscribe = state.subscribe;
    const observe = vi.spyOn(state, 'subscribe').mockImplementation((listener) => {
      const stop = subscribe(listener);
      return () => {
        stopObserving();
        stop();
      };
    });
    factory.mockReturnValue({ state, dispose });
    const workflow = bind();
    const listener = vi.fn();
    const unsubscribe = workflow.state.subscribe(listener);

    expect(factory).toHaveBeenCalledExactlyOnceWith(...args);
    expect(observe).toHaveBeenCalledOnce();
    expect(workflow.coreState).toBe(state);
    expect(workflow.dispose).toBe(dispose);
    expect(listener).toHaveBeenLastCalledWith(state.getSnapshot());
    expect(get<WorkflowStatus>(workflow.state)).toMatchObject({ isReady: true, isProcessing: false });
    expect(state.getSnapshot()).not.toHaveProperty('instance');

    state.update({ processing: 'create', isReady: false, isProcessing: true });
    expect(listener).toHaveBeenLastCalledWith(state.getSnapshot());
    expect(get<WorkflowStatus>(workflow.state)).toMatchObject({
      isReady: false,
      isProcessing: true,
      processing: 'create'
    });
    unsubscribe();
    workflow.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(stopObserving).toHaveBeenCalledOnce();
  });

  it('shares one core subscription, resumes with the current snapshot, and disposes explicitly', async () => {
    const { createWriterWorkflow } = await vi.importActual<typeof import('@desource/browser-ai/workflows')>(
      '@desource/browser-ai/workflows'
    );
    const native = { inputQuota: 1024, destroy: vi.fn() };
    vi.stubGlobal('Writer', {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue(native)
    });
    const core = createWriterWorkflow();
    const dispose = vi.spyOn(core, 'dispose');
    const subscribe = core.state.subscribe;
    const unsubscribe = vi.fn();
    const observe = vi.spyOn(core.state, 'subscribe').mockImplementation((listener) => {
      const stop = subscribe(listener);
      return () => {
        unsubscribe();
        stop();
      };
    });
    const workflow = createBrowserAiWorkflow(core);
    const first = vi.fn();
    const second = vi.fn();
    expect(observe).not.toHaveBeenCalled();

    const stopFirst = workflow.state.subscribe(first);
    const stopSecond = workflow.state.subscribe(second);
    expect(observe).toHaveBeenCalledOnce();
    expect(first).toHaveBeenLastCalledWith(core.state.getSnapshot());
    expect(second).toHaveBeenLastCalledWith(core.state.getSnapshot());
    stopFirst();
    expect(unsubscribe).not.toHaveBeenCalled();
    stopSecond();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(dispose).not.toHaveBeenCalled();

    first.mockClear();
    second.mockClear();
    await workflow.create();
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    const resumed = vi.fn();
    const stopResumed = workflow.state.subscribe(resumed);
    expect(observe).toHaveBeenCalledTimes(2);
    expect(resumed).toHaveBeenCalledExactlyOnceWith(core.state.getSnapshot());
    expect(resumed.mock.calls[0]?.[0]).toMatchObject({ writer: native, isReady: true });

    workflow.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(native.destroy).toHaveBeenCalledOnce();
    expect(resumed).toHaveBeenLastCalledWith(expect.objectContaining({ writer: null, isReady: false }));
    stopResumed();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
});
