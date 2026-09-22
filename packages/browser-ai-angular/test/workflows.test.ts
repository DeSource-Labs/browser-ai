import type { DestroyRef } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAngularAiChats,
  createAngularPromptWorkflow,
  createAngularSummarizerWorkflow,
  createAngularWriterWorkflow,
  createAngularRewriterWorkflow,
  createAngularTranslatorWorkflow,
  createAngularLanguageDetectorWorkflow,
  createAngularProofreaderWorkflow
} from '../src/lib/workflows';

afterEach(() => vi.unstubAllGlobals());

describe('Angular workflow bindings', () => {
  it('adapts every shared workflow without starting browser work', () => {
    const create = vi.fn();
    for (const name of [
      'LanguageModel',
      'Summarizer',
      'Writer',
      'Rewriter',
      'Translator',
      'LanguageDetector',
      'Proofreader'
    ])
      vi.stubGlobal(name, { create });
    const controllers = [
      createAngularPromptWorkflow(),
      createAngularSummarizerWorkflow(),
      createAngularWriterWorkflow(),
      createAngularRewriterWorkflow(),
      createAngularTranslatorWorkflow(),
      createAngularLanguageDetectorWorkflow(),
      createAngularProofreaderWorkflow()
    ];
    for (const controller of controllers) {
      expect(controller.isReady()).toBe(false);
      expect(controller.isProcessing()).toBe(false);
      controller.dispose();
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('binds chat persistence and releases state through DestroyRef', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', undefined);
    let destroy: (() => void) | undefined;
    const destroyRef = {
      onDestroy: (callback: () => void) => {
        destroy = callback;
        return () => undefined;
      }
    } as DestroyRef;
    const chats = createAngularAiChats('prompt', destroyRef);
    await chats.loadChats();
    const chat = await chats.createChat();
    expect(chats.current().activeChat?.id).toBe(chat.id);
    expect(chats.isReady()).toBe(true);
    destroy?.();
    expect(chats.current().loaded).toBe(false);
    expect(chats.current().activeChat).toBeNull();
  });

  it('publishes workflow readiness and resets signals before destroying the scope subscription', async () => {
    const model = { inputQuota: 100, destroy: vi.fn(), measureInputUsage: async () => 5, write: async () => 'draft' };
    vi.stubGlobal('Writer', { availability: async () => 'available', create: async () => model });
    let destroy: (() => void) | undefined;
    const destroyRef = {
      onDestroy: (callback: () => void) => {
        destroy = callback;
        return () => undefined;
      }
    } as DestroyRef;
    const writer = createAngularWriterWorkflow(destroyRef);
    await expect(writer.write('brief')).resolves.toBe('draft');
    expect(writer.current().output).toBe('draft');
    expect(writer.isReady()).toBe(true);
    destroy?.();
    expect(writer.isReady()).toBe(false);
    expect(writer.current().output).toBe('');
    writer.dispose();
    expect(model.destroy).toHaveBeenCalledOnce();
  });
});
