import { createBrowserAiStore } from '@desource/browser-ai';
import { act, StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  useAiChats,
  useBrowserAiWorkflow,
  useLanguageDetectorWorkflow,
  usePromptWorkflow,
  useProofreaderWorkflow,
  useRewriterWorkflow,
  useSummarizerWorkflow,
  useTranslatorWorkflow,
  useWriterWorkflow
} from '../src/workflows';

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

afterEach(async () => {
  if (root) await act(() => root?.unmount());
  root = undefined;
  container?.remove();
  container = undefined;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const render = async (node: ReactNode) => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(() => root?.render(node));
};

const promptOptions = { onContextOverflow: vi.fn() };
const translatorOptions = { sourceLanguage: 'en', targetLanguage: 'fr' };
const detectorOptions = { expectedInputLanguages: ['en'] };
const proofreaderOptions = { includeCorrectionTypes: true };

describe('React workflow bindings', () => {
  it.each([
    ['Chat persistence', chatsMocks.createAiChats, () => useAiChats('prompt'), ['prompt']],
    ['Prompt API', coreMocks.createPromptWorkflow, () => usePromptWorkflow(promptOptions), [promptOptions]],
    ['Summarizer', coreMocks.createSummarizerWorkflow, () => useSummarizerWorkflow(), []],
    ['Writer', coreMocks.createWriterWorkflow, () => useWriterWorkflow(), []],
    ['Rewriter', coreMocks.createRewriterWorkflow, () => useRewriterWorkflow(), []],
    [
      'Translator',
      coreMocks.createTranslatorWorkflow,
      () => useTranslatorWorkflow(translatorOptions),
      [translatorOptions]
    ],
    [
      'Language detector',
      coreMocks.createLanguageDetectorWorkflow,
      () => useLanguageDetectorWorkflow(detectorOptions),
      [detectorOptions]
    ],
    [
      'Proofreader',
      coreMocks.createProofreaderWorkflow,
      () => useProofreaderWorkflow(proofreaderOptions),
      [proofreaderOptions]
    ]
  ])('binds %s snapshots, arguments, and cleanup', async (_name, factory, useHook, args) => {
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
    let latest: ReturnType<typeof useHook> | undefined;
    const Probe = () => {
      latest = useHook();
      return <span>{latest.processing}</span>;
    };

    await render(<Probe />);
    expect(factory).toHaveBeenCalledExactlyOnceWith(...args);
    expect(observe).toHaveBeenCalledOnce();
    expect(latest).toMatchObject({ state, dispose, isReady: true, isProcessing: false });
    expect(state.getSnapshot()).not.toHaveProperty('instance');

    await act(() => state.update({ processing: 'create', isReady: false, isProcessing: true }));
    expect(latest).toMatchObject({ isReady: false, isProcessing: true, processing: 'create' });
    expect(container?.textContent).toBe('create');
    expect(factory).toHaveBeenCalledOnce();

    await act(() => root?.unmount());
    root = undefined;
    expect(dispose).toHaveBeenCalledOnce();
    expect(stopObserving).toHaveBeenCalledOnce();
  });

  it('reuses a real workflow after StrictMode cleanup and destroys its session on unmount', async () => {
    const { createWriterWorkflow } = await vi.importActual<typeof import('@desource/browser-ai/workflows')>(
      '@desource/browser-ai/workflows'
    );
    const native = { inputQuota: 1024, destroy: vi.fn() };
    const create = vi.fn().mockResolvedValue(native);
    vi.stubGlobal('Writer', { availability: vi.fn().mockResolvedValue('available'), create });
    const workflow = createWriterWorkflow();
    const dispose = vi.spyOn(workflow, 'dispose');
    const factory = vi.fn(() => workflow);
    let latest: ReturnType<typeof useBrowserAiWorkflow<typeof workflow>> | undefined;
    const Probe = () => {
      latest = useBrowserAiWorkflow(factory);
      return <span>{latest.isReady ? 'ready' : 'idle'}</span>;
    };

    await render(
      <StrictMode>
        <Probe />
      </StrictMode>
    );
    expect(dispose).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
    const initialFactoryCalls = factory.mock.calls.length;

    await act(async () => {
      await latest?.create();
    });
    expect(latest).toMatchObject({ writer: native, isReady: true, isProcessing: false });
    expect(container?.textContent).toBe('ready');
    expect(create).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledTimes(initialFactoryCalls);

    await act(() => root?.unmount());
    root = undefined;
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(native.destroy).toHaveBeenCalledOnce();
    expect(workflow.state.getSnapshot()).toMatchObject({ writer: null, isReady: false, processing: '' });
  });
});
