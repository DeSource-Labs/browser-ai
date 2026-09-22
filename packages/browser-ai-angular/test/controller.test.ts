import type { DestroyRef } from '@angular/core';
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
  BrowserAiService,
  createAngularLanguageDetector,
  createAngularPromptApi,
  createAngularProofreader,
  createAngularRewriter,
  createAngularSummarizer,
  createAngularTranslator,
  createAngularWebMcp,
  createAngularWriter,
  toAngularController
} from '../src/lib/controller';

const stubController = () => {
  let snapshot = { availability: 'unavailable' as Availability, instance: null as object | null, processing: '' };
  const listeners = new Set<() => void>();
  return {
    state: {
      getSnapshot: () => snapshot,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return vi.fn(() => listeners.delete(listener));
      }
    },
    publish(next: typeof snapshot) {
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
    dispose: vi.fn()
  };
};

const destroyRef = () => {
  let callback: (() => void) | undefined;
  return {
    ref: { onDestroy: vi.fn((next: () => void) => (callback = next)) } as unknown as DestroyRef,
    destroy: () => callback?.()
  };
};

afterEach(() => vi.clearAllMocks());

describe('Angular controller adapter', () => {
  it('exposes live computed signals and disposes the original controller once', () => {
    const core = stubController();
    const disposeController = core.dispose;
    const lifecycle = destroyRef();
    const adapted = toAngularController(core, lifecycle.ref);

    expect(adapted.current()).toMatchObject({ availability: 'unavailable', processing: '' });
    expect(adapted.isProcessing()).toBe(false);
    expect(adapted.isReady()).toBe(false);
    core.publish({ availability: 'available', instance: {}, processing: 'prompt' });
    expect(adapted.current().processing).toBe('prompt');
    expect(adapted.isProcessing()).toBe(true);
    expect(adapted.isReady()).toBe(true);

    lifecycle.destroy();
    adapted.dispose();
    expect(disposeController).toHaveBeenCalledOnce();
  });

  it('supports an explicitly managed lifecycle', () => {
    const core = stubController();
    const disposeController = core.dispose;
    const adapted = toAngularController(core);
    adapted.dispose();
    expect(disposeController).toHaveBeenCalledOnce();
  });

  it('passes options and destroy hooks through every factory', () => {
    Object.values(coreMocks).forEach((factory) => factory.mockImplementation(() => stubController()));
    const lifecycle = destroyRef();

    createAngularPromptApi({ topK: 2 }, lifecycle.ref);
    createAngularSummarizer({ type: 'headline' }, lifecycle.ref);
    createAngularWriter({ tone: 'formal' }, lifecycle.ref);
    createAngularRewriter({ tone: 'more-formal' }, lifecycle.ref);
    createAngularTranslator({ sourceLanguage: 'en', targetLanguage: 'fr' }, lifecycle.ref);
    createAngularLanguageDetector({ expectedInputLanguages: ['en'] }, lifecycle.ref);
    createAngularProofreader({ includeCorrectionTypes: true }, lifecycle.ref);
    createAngularWebMcp(lifecycle.ref);

    expect(coreMocks.createPromptApi).toHaveBeenCalledWith({ topK: 2 });
    expect(coreMocks.createSummarizer).toHaveBeenCalledWith({ type: 'headline' });
    expect(coreMocks.createWriter).toHaveBeenCalledWith({ tone: 'formal' });
    expect(coreMocks.createRewriter).toHaveBeenCalledWith({ tone: 'more-formal' });
    expect(coreMocks.createTranslator).toHaveBeenCalledWith({ sourceLanguage: 'en', targetLanguage: 'fr' });
    expect(coreMocks.createLanguageDetector).toHaveBeenCalledWith({ expectedInputLanguages: ['en'] });
    expect(coreMocks.createProofreader).toHaveBeenCalledWith({ includeCorrectionTypes: true });
    expect(coreMocks.createWebMcp).toHaveBeenCalledOnce();
  });

  it('provides all service factories', () => {
    Object.values(coreMocks).forEach((factory) => factory.mockImplementation(() => stubController()));
    const service = new BrowserAiService();

    service.prompt({ topK: 1 });
    service.summarizer({ type: 'key-points' });
    service.writer({ tone: 'casual' });
    service.rewriter({ length: 'shorter' });
    service.translator({ sourceLanguage: 'en', targetLanguage: 'de' });
    service.languageDetector({ expectedInputLanguages: ['de'] });
    service.proofreader({ includeCorrectionTypes: false });
    service.webMcp();

    expect(Object.values(coreMocks).every((factory) => factory.mock.calls.length > 0)).toBe(true);
  });
});
