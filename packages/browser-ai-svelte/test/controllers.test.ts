import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

const coreMocks = vi.hoisted(() => ({
  createPromptApi: vi.fn(),
  createSummarizer: vi.fn(),
  createWriter: vi.fn(),
  createRewriter: vi.fn(),
  createTranslator: vi.fn(),
  createLanguageDetector: vi.fn(),
  createProofreader: vi.fn(),
  createWebMcp: vi.fn()
}));

vi.mock('@desource/browser-ai', () => coreMocks);

import {
  createLanguageDetector,
  createPromptApi,
  createProofreader,
  createRewriter,
  createSummarizer,
  createTranslator,
  createWebMcp,
  createWriter,
  toSvelteController
} from '../src/lib/controllers';

const stubController = () => {
  let snapshot = { processing: '', output: '' };
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());
  return {
    state: {
      getSnapshot: () => snapshot,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      update(updater: Partial<typeof snapshot> | ((current: typeof snapshot) => typeof snapshot)) {
        snapshot = typeof updater === 'function' ? updater(snapshot) : { ...snapshot, ...updater };
        publish();
        return snapshot;
      }
    },
    updateState(next: Partial<typeof snapshot>) {
      snapshot = { ...snapshot, ...next };
      publish();
    },
    dispose: vi.fn()
  };
};

afterEach(() => vi.clearAllMocks());

describe('Svelte controller adapters', () => {
  it('maps the external store while preserving the core state handle', () => {
    const core = stubController();
    const adapted = toSvelteController(core);
    expect(adapted.coreState).toBe(core.state);
    expect(get(adapted.state)).toEqual({ processing: '', output: '' });
    core.updateState({ processing: 'prompt', output: 'partial' });
    expect(get(adapted.state)).toEqual({ processing: 'prompt', output: 'partial' });
    adapted.dispose();
    expect(core.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    ['Prompt API', coreMocks.createPromptApi, () => createPromptApi({ topK: 2 })],
    ['Summarizer', coreMocks.createSummarizer, () => createSummarizer({ type: 'headline' })],
    ['Writer', coreMocks.createWriter, () => createWriter({ tone: 'formal' })],
    ['Rewriter', coreMocks.createRewriter, () => createRewriter({ tone: 'more-formal' })],
    ['Translator', coreMocks.createTranslator, () => createTranslator({ sourceLanguage: 'en', targetLanguage: 'fr' })],
    [
      'Language detector',
      coreMocks.createLanguageDetector,
      () => createLanguageDetector({ expectedInputLanguages: ['en'] })
    ],
    ['Proofreader', coreMocks.createProofreader, () => createProofreader({ includeCorrectionTypes: true })],
    ['WebMCP', coreMocks.createWebMcp, () => createWebMcp()]
  ])('creates a %s adapter', (_name, factory, createAdapter) => {
    const core = stubController();
    factory.mockReturnValueOnce(core);
    const adapted = createAdapter();
    expect(adapted.coreState).toBe(core.state);
    expect(factory).toHaveBeenCalledOnce();
  });
});
