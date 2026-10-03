import { createBrowserAiStore } from '@desource/browser-ai';
import { observedWorkflow, workflowBindingCases } from '../../../common/tests/helpers/workflow-bindings';
import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { coreMocks, chatsMocks } = await vi.hoisted(async () => {
  const { workflowMocks } = await import('../../../common/tests/helpers/workflow-bindings');
  return workflowMocks();
});

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

const bindings = {
  chats: createSvelteAiChats,
  prompt: createSveltePromptWorkflow,
  summarizer: createSvelteSummarizerWorkflow,
  writer: createSvelteWriterWorkflow,
  rewriter: createSvelteRewriterWorkflow,
  translator: createSvelteTranslatorWorkflow,
  detector: createSvelteLanguageDetectorWorkflow,
  proofreader: createSvelteProofreaderWorkflow
};
const cases = workflowBindingCases<ReturnType<(typeof bindings)[keyof typeof bindings]>>(
  bindings,
  coreMocks,
  chatsMocks.createAiChats
);

interface WorkflowStatus {
  isReady: boolean;
  isProcessing: boolean;
  processing: string;
}

describe('Svelte workflow bindings', () => {
  it.each(cases)(
    'binds %s snapshots and arguments without deriving readiness from instance',
    (_name, factory, bind, args) => {
      const { state, dispose, stopObserving, observe } = observedWorkflow(createBrowserAiStore);
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
    }
  );

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
