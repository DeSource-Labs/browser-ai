import { createBrowserAiStore } from '@desource/browser-ai';
import { observedWorkflow, workflowBindingCases } from '../../../common/tests/helpers/workflow-bindings';
import { act, StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { coreMocks, chatsMocks } = await vi.hoisted(async () => {
  const { workflowMocks } = await import('../../../common/tests/helpers/workflow-bindings');
  return workflowMocks();
});

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

const bindings = {
  chats: useAiChats,
  prompt: usePromptWorkflow,
  summarizer: useSummarizerWorkflow,
  writer: useWriterWorkflow,
  rewriter: useRewriterWorkflow,
  translator: useTranslatorWorkflow,
  detector: useLanguageDetectorWorkflow,
  proofreader: useProofreaderWorkflow
};
const cases = workflowBindingCases<ReturnType<(typeof bindings)[keyof typeof bindings]>>(
  bindings,
  coreMocks,
  chatsMocks.createAiChats
);

describe('React workflow bindings', () => {
  it.each(cases)('binds %s snapshots, arguments, and cleanup', async (_name, factory, useHook, args) => {
    const { state, dispose, stopObserving, observe } = observedWorkflow(createBrowserAiStore);
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
