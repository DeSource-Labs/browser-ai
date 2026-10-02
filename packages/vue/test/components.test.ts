import { createApp, h, nextTick, reactive, type Component } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatHistory, { type ChatMessage } from '../src/components/ChatHistory.vue';
import ChatSidebar from '../src/components/ChatSidebar.vue';
import PromptInput, { type PromptAttachment } from '../src/components/PromptInput.vue';

const apps = new Set<ReturnType<typeof createApp>>();

const render = async (component: Component, initialProps: Record<string, unknown>) => {
  const props = reactive({ ...initialProps });
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp({ render: () => h(component, props) });
  apps.add(app);
  app.mount(container);
  await nextTick();
  return {
    container,
    props,
    cleanup() {
      if (apps.delete(app)) app.unmount();
      container.remove();
    }
  };
};

afterEach(() => {
  apps.forEach((app) => app.unmount());
  apps.clear();
  document.body.replaceChildren();
});

beforeEach(() => {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      callback(1);
      return 1;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
    revokeObjectURL: vi.fn()
  });
});

describe('ChatSidebar', () => {
  it('creates, selects, deletes, renames, and cancels edits', async () => {
    const events = { create: vi.fn(), select: vi.fn(), delete: vi.fn(), rename: vi.fn() };
    const view = await render(ChatSidebar, {
      chats: [],
      activeChatId: null,
      onCreate: events.create,
      onSelect: events.select,
      onDelete: events.delete,
      onRename: events.rename
    });
    expect(view.container.textContent).toContain('stored locally');
    view.container.querySelector<HTMLButtonElement>('.chat-sidebar__new')!.click();
    expect(events.create).toHaveBeenCalledOnce();

    view.props.chats = [
      { id: 'one', title: 'First chat', updatedAt: Date.now() - 120_000, preview: 'Preview' },
      { id: 'two', title: 'Second chat', updatedAt: Date.now() }
    ];
    view.props.activeChatId = 'one';
    await nextTick();
    expect(view.container.querySelector('.chat-sidebar__item--active')).toBeTruthy();
    view.container.querySelector<HTMLButtonElement>('.chat-sidebar__item-main')!.click();
    expect(events.select).toHaveBeenCalledWith('one');
    const actions = view.container.querySelectorAll<HTMLButtonElement>('.chat-sidebar__action');
    actions[1]!.click();
    expect(events.delete).toHaveBeenCalledWith('one');

    actions[0]!.click();
    await nextTick();
    const form = view.container.querySelector<HTMLFormElement>('form')!;
    const input = form.querySelector('input')!;
    input.value = '   ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(events.rename).not.toHaveBeenCalled();
    input.value = '  Renamed  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(events.rename).toHaveBeenCalledWith('one', 'Renamed');

    view.container.querySelectorAll<HTMLButtonElement>('.chat-sidebar__action')[0]!.click();
    await nextTick();
    view.container
      .querySelector<HTMLInputElement>('form input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(view.container.querySelector('form')).toBeNull();
    view.cleanup();
  });
});

describe('PromptInput', () => {
  it('updates, sends by button and Enter, respects modifiers, and emits voice', async () => {
    const events = { update: vi.fn(), send: vi.fn(), voice: vi.fn() };
    const view = await render(PromptInput, {
      modelValue: 'Prompt',
      attachments: [],
      allowVoice: true,
      'onUpdate:modelValue': events.update,
      onSend: events.send,
      onVoice: events.voice
    });
    const textarea = view.container.querySelector('textarea')!;
    textarea.value = 'Changed';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(events.update).toHaveBeenCalledWith('Changed');
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(events.send).toHaveBeenCalledOnce();
    for (const init of [
      { key: 'A' },
      { key: 'Enter', shiftKey: true },
      { key: 'Enter', metaKey: true },
      { key: 'Enter', ctrlKey: true },
      { key: 'Enter', altKey: true }
    ]) {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { ...init, bubbles: true }));
    }
    expect(events.send).toHaveBeenCalledOnce();
    view.container.querySelector<HTMLButtonElement>('[aria-label="Send prompt"]')!.click();
    view.container.querySelector<HTMLButtonElement>('[aria-label="Start voice input"]')!.click();
    expect(events.send).toHaveBeenCalledTimes(2);
    expect(events.voice).toHaveBeenCalledOnce();

    Object.assign(view.props, { sendOnEnter: false, disabled: true });
    await nextTick();
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    view.container.querySelector<HTMLButtonElement>('[aria-label="Start voice input"]')!.click();
    expect(events.send).toHaveBeenCalledTimes(2);
    expect(events.voice).toHaveBeenCalledOnce();
    view.cleanup();
  });

  it('selects, limits, displays, removes, and revokes attachments', async () => {
    const update = vi.fn();
    const image = new File(['image'], 'photo.png', { type: 'image/png' });
    const audio = new File(['audio'], 'sound.wav', { type: 'audio/wav' });
    const existing: PromptAttachment = {
      id: 'existing',
      file: audio,
      url: 'blob:existing',
      name: audio.name,
      type: audio.type
    };
    const view = await render(PromptInput, {
      modelValue: '',
      attachments: [existing],
      allowAttachments: true,
      maxAttachments: 2,
      'onUpdate:attachments': update
    });
    expect(view.container.textContent).toContain('sound.wav');
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const inputClick = vi.spyOn(input, 'click');
    view.container.querySelector<HTMLButtonElement>('[aria-label="Attach files"]')!.click();
    expect(inputClick).toHaveBeenCalledOnce();
    Object.defineProperty(input, 'files', { configurable: true, value: [image, audio] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(update).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'photo.png' })]));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    view.container.querySelector<HTMLButtonElement>('.prompt-input__remove')!.click();
    expect(update).toHaveBeenLastCalledWith([]);
    view.props.attachments = [{ id: 'image', file: image, url: 'blob:image', name: image.name, type: image.type }];
    await nextTick();
    expect(view.container.querySelector('img')?.alt).toBe('photo.png');
    view.props.attachments = [];
    await nextTick();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:image');

    Object.defineProperty(input, 'files', { configurable: true, value: [] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    view.props.attachments = [existing, { ...existing, id: 'second' }];
    await nextTick();
    Object.defineProperty(input, 'files', { configurable: true, value: [image] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(input.value).toBe('');
    view.cleanup();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:existing');
  });
});

describe('ChatHistory interactions', () => {
  it('renders attachments and typing states, tracks scroll pinning, and jumps to latest', async () => {
    const messages: ChatMessage[] = [
      {
        id: 'user',
        role: 'user',
        content: 'Question',
        timestamp: Date.now(),
        attachments: [
          { id: 'image', url: 'blob:image', name: 'image.png', type: 'image/png' },
          { id: 'file', url: 'blob:file', name: 'notes.txt', type: 'text/plain' }
        ]
      },
      { id: 'assistant', role: 'assistant', content: '', timestamp: Date.now() }
    ];
    const view = await render(ChatHistory, { messages, isTyping: true, autoScroll: true });
    expect(view.container.querySelector('img')?.alt).toBe('image.png');
    expect(view.container.textContent).toContain('notes.txt');
    expect(view.container.querySelector('.chat-message__dots')).toBeTruthy();
    const history = view.container.querySelector<HTMLElement>('.chat-history')!;
    Object.defineProperties(history, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, writable: true, value: 100 }
    });
    history.dispatchEvent(new Event('scroll'));
    view.props.messages = [...messages, { id: 'next', role: 'assistant', content: 'Streaming' }];
    await nextTick();
    await nextTick();
    expect(view.container.textContent).toContain('Latest response');
    view.container.querySelector<HTMLButtonElement>('.chat-history__latest')!.click();
    await nextTick();
    expect(history.scrollTop).toBe(1000);

    view.props.messages = [{ id: 'user-only', role: 'user', content: 'Question' }];
    await nextTick();
    expect(view.container.querySelectorAll('.chat-message--typing')).toHaveLength(1);
    view.props.autoScroll = false;
    await nextTick();
    view.props.messages = [];
    await nextTick();
    expect(view.container.textContent).toContain('Start a private');
    view.props.autoScroll = true;
    await nextTick();
    view.cleanup();
  });
});
