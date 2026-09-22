import { createBrowserAiStore } from '@desource/browser-ai';
import { effectScope } from 'vue';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createAiChats: vi.fn() }));
vi.mock('@desource/browser-ai/chats', () => mocks);

import { useAiChats } from '../src/composables/useAiChats';

describe('Vue chat persistence binding', () => {
  it('publishes snapshots, preserves writable selection, and disposes with its scope', () => {
    const initial = { chats: [], activeChat: null, activeChatId: null as string | null, loaded: false };
    const state = createBrowserAiStore(initial);
    const unsubscribe = vi.fn();
    const subscribe = state.subscribe;
    vi.spyOn(state, 'subscribe').mockImplementation((listener) => {
      const stop = subscribe(listener);
      return () => {
        unsubscribe();
        stop();
      };
    });
    const controller = {
      state,
      setActiveChatId: vi.fn((activeChatId: string | null) => state.update({ activeChatId })),
      dispose: vi.fn(() => state.update(initial))
    };
    mocks.createAiChats.mockReturnValueOnce(controller);
    const scope = effectScope();
    const chats = scope.run(() => useAiChats('prompt'))!;
    expect(mocks.createAiChats).toHaveBeenCalledExactlyOnceWith('prompt');
    expect(chats.loaded.value).toBe(false);
    state.update({ loaded: true });
    expect(chats.loaded.value).toBe(true);

    chats.activeChatId.value = 'selected';
    expect(controller.setActiveChatId).toHaveBeenCalledExactlyOnceWith('selected');
    expect(chats.activeChatId.value).toBe('selected');

    scope.stop();
    expect(controller.dispose).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(chats.loaded.value).toBe(false);
    state.update({ loaded: true });
    expect(chats.loaded.value).toBe(false);
  });
});
