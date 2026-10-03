import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
  useLanguageDetector,
  usePromptApi,
  useProofreader,
  useRewriter,
  useSummarizer,
  useTranslator,
  useWebMcp,
  useWriter
} from '../src/hooks';

interface StubState {
  processing: string;
  availability: Availability | null;
  instance: object | null;
}

const stubController = () => {
  let snapshot: StubState = { processing: '', availability: null, instance: null };
  const listeners = new Set<() => void>();
  return {
    state: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    },
    update(next: Partial<StubState>) {
      snapshot = { ...snapshot, ...next };
      listeners.forEach((listener) => listener());
    },
    dispose: vi.fn(),
    configure: vi.fn()
  };
};

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) await act(() => root?.unmount());
  root = undefined;
  container?.remove();
  container = undefined;
  vi.clearAllMocks();
});

const renderProbe = async (Probe: ComponentType) => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(() => root?.render(<Probe />));
};

describe('React controller hooks', () => {
  it.each([
    ['Prompt API', coreMocks.createPromptApi, () => usePromptApi({ topK: 2 })],
    ['Summarizer', coreMocks.createSummarizer, () => useSummarizer({ type: 'headline' })],
    ['Writer', coreMocks.createWriter, () => useWriter({ tone: 'formal' })],
    ['Rewriter', coreMocks.createRewriter, () => useRewriter({ tone: 'more-formal' })],
    ['Translator', coreMocks.createTranslator, () => useTranslator({ sourceLanguage: 'en', targetLanguage: 'fr' })],
    [
      'Language detector',
      coreMocks.createLanguageDetector,
      () => useLanguageDetector({ expectedInputLanguages: ['en'] })
    ],
    ['Proofreader', coreMocks.createProofreader, () => useProofreader({ includeCorrectionTypes: true })],
    ['WebMCP', coreMocks.createWebMcp, () => useWebMcp()]
  ])('adapts the %s controller to React state and cleanup', async (_name, factory, useHook) => {
    const controller = stubController();
    factory.mockReturnValueOnce(controller);
    let latest: ReturnType<typeof useHook> | undefined;
    const Probe = () => {
      latest = useHook();
      return <span>{latest.processing}</span>;
    };

    await renderProbe(Probe);
    expect(latest).toMatchObject({ isReady: false, isProcessing: false, processing: '' });
    expect(factory).toHaveBeenCalledOnce();

    await act(() => controller.update({ processing: 'create', availability: 'available', instance: {} }));
    expect(latest).toMatchObject({ isReady: true, isProcessing: true, processing: 'create' });
    expect(container?.textContent).toBe('create');

    await act(() => root?.unmount());
    root = undefined;
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it('keeps one controller across ordinary re-renders', async () => {
    const controller = stubController();
    coreMocks.createPromptApi.mockReturnValue(controller);
    let renders = 0;
    const Probe = () => {
      const api = usePromptApi();
      renders += 1;
      return <span>{api.processing}</span>;
    };
    await renderProbe(Probe);
    await act(() => controller.update({ processing: 'prompt' }));
    expect(renders).toBe(2);
    expect(coreMocks.createPromptApi).toHaveBeenCalledOnce();
  });
});

it('updates creation defaults when hook options change without replacing its controller', async () => {
  const controller = stubController();
  coreMocks.createTranslator.mockReturnValue(controller);
  const Probe = ({ target }: { target: string }) => {
    useTranslator({ sourceLanguage: 'en', targetLanguage: target });
    return null;
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(() => root?.render(<Probe target="fr" />));
  await act(() => root?.render(<Probe target="de" />));
  expect(controller.configure).toHaveBeenLastCalledWith({ sourceLanguage: 'en', targetLanguage: 'de' });
  expect(coreMocks.createTranslator).toHaveBeenCalledOnce();
});
