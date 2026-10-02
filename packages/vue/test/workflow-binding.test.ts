import { effectScope, isProxy } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWriter } from '../src/composables/useWriter';
import { useSummarizer } from '../src/composables/useSummarizer';
import { useRewriter } from '../src/composables/useRewriter';
import { useTranslator } from '../src/composables/useTranslator';
import { useLanguageDetector } from '../src/composables/useLanguageDetector';
import { useProofreader } from '../src/composables/useProofreader';
import { usePromptApi } from '../src/composables/usePromptApi';
import { useWorkflow } from '../src/composables/useWorkflow';
import { createBrowserAiStore } from '@desource/browser-ai';

afterEach(() => vi.unstubAllGlobals());

describe('Vue workflow bindings', () => {
  it('supports explicit disposal outside an effect scope and detaches its state subscription', () => {
    const state = createBrowserAiStore({ count: 0 });
    const dispose = vi.fn(() => state.update({ count: 0 }));
    const binding = useWorkflow({ state, dispose });
    state.update({ count: 2 });
    expect(binding.count.value).toBe(2);
    binding.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(binding.count.value).toBe(0);
    state.update({ count: 3 });
    expect(binding.count.value).toBe(0);
  });

  it('keeps existing composable fields as refs without creating native models', () => {
    const scope = effectScope();
    const controllers = scope.run(() => [
      usePromptApi(),
      useSummarizer(),
      useWriter(),
      useRewriter(),
      useTranslator(),
      useLanguageDetector(),
      useProofreader()
    ])!;
    for (const api of controllers) {
      expect(api.isReady.value).toBe(false);
      expect(api.isProcessing.value).toBe(false);
    }
    scope.stop();
  });

  it('publishes plain native instances and automatically destroys them with their Vue scope', async () => {
    const model = { inputQuota: 100, destroy: vi.fn(), measureInputUsage: async () => 5, write: async () => 'draft' };
    vi.stubGlobal('Writer', { availability: async () => 'available', create: async () => model });
    const scope = effectScope();
    const writer = scope.run(useWriter)!;
    await expect(writer.write('brief')).resolves.toBe('draft');
    expect(writer.output.value).toBe('draft');
    expect(writer.writer.value).toBe(model);
    expect(isProxy(writer.writer.value)).toBe(false);
    expect(writer.isReady.value).toBe(true);
    scope.stop();
    expect(writer.writer.value).toBeNull();
    expect(writer.output.value).toBe('');
    expect(model.destroy).toHaveBeenCalledOnce();
  });
});
