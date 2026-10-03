import type { BrowserAiStore, createBrowserAiStore } from '../../../packages/core/src/store';
import { vi, type Mock, type MockInstance } from 'vitest';

export const workflowMocks = (): { coreMocks: Record<string, Mock>; chatsMocks: { createAiChats: Mock } } => ({
  coreMocks: {
    createPromptWorkflow: vi.fn(),
    createSummarizerWorkflow: vi.fn(),
    createWriterWorkflow: vi.fn(),
    createRewriterWorkflow: vi.fn(),
    createTranslatorWorkflow: vi.fn(),
    createLanguageDetectorWorkflow: vi.fn(),
    createProofreaderWorkflow: vi.fn()
  },
  chatsMocks: { createAiChats: vi.fn() }
});

interface WorkflowBindings<Result> {
  chats(kind: 'prompt'): Result;
  prompt(options: { onContextOverflow: Mock }): Result;
  summarizer(): Result;
  writer(): Result;
  rewriter(): Result;
  translator(options: { sourceLanguage: string; targetLanguage: string }): Result;
  detector(options: { expectedInputLanguages: string[] }): Result;
  proofreader(options: { includeCorrectionTypes: boolean }): Result;
}

export function workflowBindingCases<Result>(
  bindings: WorkflowBindings<Result>,
  factories: Record<string, Mock>,
  chatsFactory: Mock
): [string, Mock, () => Result, unknown[]][] {
  const promptOptions = { onContextOverflow: vi.fn() };
  const translatorOptions = { sourceLanguage: 'en', targetLanguage: 'fr' };
  const detectorOptions = { expectedInputLanguages: ['en'] };
  const proofreaderOptions = { includeCorrectionTypes: true };
  return [
    ['Chat persistence', chatsFactory, () => bindings.chats('prompt'), ['prompt']],
    ['Prompt API', factories.createPromptWorkflow!, () => bindings.prompt(promptOptions), [promptOptions]],
    ['Summarizer', factories.createSummarizerWorkflow!, () => bindings.summarizer(), []],
    ['Writer', factories.createWriterWorkflow!, () => bindings.writer(), []],
    ['Rewriter', factories.createRewriterWorkflow!, () => bindings.rewriter(), []],
    [
      'Translator',
      factories.createTranslatorWorkflow!,
      () => bindings.translator(translatorOptions),
      [translatorOptions]
    ],
    [
      'Language detector',
      factories.createLanguageDetectorWorkflow!,
      () => bindings.detector(detectorOptions),
      [detectorOptions]
    ],
    [
      'Proofreader',
      factories.createProofreaderWorkflow!,
      () => bindings.proofreader(proofreaderOptions),
      [proofreaderOptions]
    ]
  ];
}

type WorkflowStore = BrowserAiStore<{ processing: string; isReady: boolean; isProcessing: boolean; output: string }>;

export const observedWorkflow = (
  createStore: typeof createBrowserAiStore
): {
  state: WorkflowStore;
  dispose: Mock;
  stopObserving: Mock;
  observe: MockInstance<WorkflowStore['subscribe']>;
} => {
  const state = createStore({ processing: '', isReady: true, isProcessing: false, output: '' });
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
  return { state, dispose, stopObserving, observe };
};
