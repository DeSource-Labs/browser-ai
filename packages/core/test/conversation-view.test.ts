import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  conversationAttachments,
  conversationMessages,
  createConversationView,
  createChatViewport,
  formatRelativeTime,
  toDateTime,
  type ConversationMessageView
} from '../src/conversation-view';
import type { ConversationMessage } from '../src/conversation';

const message = (attachments?: ConversationMessage['attachments']): ConversationMessage => ({
  id: 'message',
  role: 'user',
  content: 'Source',
  timestamp: 1,
  ...(attachments ? { attachments } : {})
});

beforeEach(() => {
  let next = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:preview-${++next}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('conversation attachment conversion', () => {
  it('retains original files while removing UI-only URLs from native attachment inputs', () => {
    const file = new File(['Image'], 'scene.png', { type: 'image/png' });
    const view = { id: 'file', name: 'Scene', type: 'image/png', file, url: 'blob:caller-owned' };
    expect(conversationAttachments([view])).toEqual([{ id: 'file', name: 'Scene', type: 'image/png', value: file }]);
    expect(view.url).toBe('blob:caller-owned');
    expect(conversationAttachments([])).toEqual([]);
    expect(() =>
      conversationAttachments([{ id: 'missing', name: 'Missing image', type: 'image/png', url: 'blob:no-file' }])
    ).toThrow('has no backing File');
  });

  it('supplies missing timestamps and converts attachments without changing caller messages', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const file = new File(['Notes'], 'notes.txt');
    const input = [
      { id: 'old', role: 'assistant' as const, content: 'Old', timestamp: 0, attachments: [] },
      {
        id: 'new',
        role: 'user' as const,
        content: 'New',
        attachments: [{ id: 'notes', name: 'notes.txt', type: '', file }]
      },
      { id: 'plain', role: 'assistant' as const, content: 'Plain' }
    ];
    const converted = conversationMessages(input);
    expect(converted[0]).toEqual({ id: 'old', role: 'assistant', content: 'Old', timestamp: 0 });
    expect(converted[1]).toMatchObject({ timestamp: 1234, attachments: [{ value: file }] });
    expect(converted[2]).toEqual({ id: 'plain', role: 'assistant', content: 'Plain', timestamp: 1234 });
    expect(input[1]).not.toHaveProperty('timestamp');
    expect(input[1]!.attachments![0]).toHaveProperty('file', file);
  });

  it('keeps initial text and timestamps while excluding preview-only attachments from native history', () => {
    const file = new File(['Image'], 'scene.png', { type: 'image/png' });
    const preview = { id: 'preview', name: 'Saved scene', type: 'image/png', url: 'https://example.com/scene.png' };
    const input: ConversationMessageView[] = [
      { id: 'preview-only', role: 'user', content: 'Earlier image', timestamp: 123, attachments: [preview] },
      {
        id: 'mixed',
        role: 'assistant',
        content: 'Earlier response',
        timestamp: 456,
        attachments: [preview, { id: 'file', name: 'scene.png', type: 'image/png', file, url: 'blob:caller-file' }]
      }
    ];
    expect(conversationMessages(input)).toEqual([
      { id: 'preview-only', role: 'user', content: 'Earlier image', timestamp: 123 },
      {
        id: 'mixed',
        role: 'assistant',
        content: 'Earlier response',
        timestamp: 456,
        attachments: [{ id: 'file', name: 'scene.png', type: 'image/png', value: file }]
      }
    ]);
    expect(input[1]!.attachments).toHaveLength(2);
    expect(() => conversationAttachments([preview])).toThrow('has no backing File');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe('conversation preview ownership', () => {
  it('reuses visible previews and releases removed attachments before unmount', () => {
    const view = createConversationView();
    const file = new File(['Image'], 'scene.png', { type: 'image/png' });
    const blob = new Blob(['Audio'], { type: 'audio/wav' });
    const original = [
      message([{ value: file }, { value: file, id: 'duplicate', name: 'Renamed', type: 'image/jpeg' }, { value: blob }])
    ];
    const first = view.messages(original);
    expect(first[0]!.attachments).toEqual([
      { id: 'message-0', name: 'scene.png', type: 'image/png', file, url: 'blob:preview-1' },
      { id: 'duplicate', name: 'Renamed', type: 'image/jpeg', file, url: 'blob:preview-1' },
      { id: 'message-2', name: 'Attachment', type: 'audio/wav', url: 'blob:preview-2' }
    ]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(view.messages(original)).toEqual(first);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(original[0]!.attachments![0]).not.toHaveProperty('url');
    expect(view.messages([])).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    view.dispose();
    view.dispose();
    expect(vi.mocked(URL.revokeObjectURL).mock.calls).toEqual([['blob:preview-1'], ['blob:preview-2']]);
    view.messages(original);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(4);
    view.dispose();
  });

  it('renders text and non-Blob inputs without preview URLs, including environments without File or Blob', () => {
    const view = createConversationView();
    expect(view.messages([message(), message([])])[0]).not.toHaveProperty('attachments');
    expect(
      view.messages([message([{ value: 'Document', name: 'notes.txt', type: 'text/plain' }])])[0]!.attachments
    ).toEqual([{ id: 'message-0', name: 'notes.txt', type: 'text/plain' }]);
    vi.stubGlobal('File', undefined);
    vi.stubGlobal('Blob', undefined);
    expect(view.messages([message([{ value: new Uint8Array([1]) }])])[0]!.attachments).toEqual([
      { id: 'message-0', name: 'Attachment', type: '' }
    ]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    view.dispose();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('preserves mixed initial preview order without sharing mutable metadata or owning caller URLs', () => {
    const firstFile = new File(['First'], 'first.png', { type: 'image/png' });
    const secondFile = new File(['Second'], 'second.png', { type: 'image/png' });
    const initial: ConversationMessageView[] = [
      {
        id: 'mixed',
        role: 'user',
        content: 'Initial content',
        timestamp: 123,
        attachments: [
          { id: 'preview-1', name: 'First preview', type: 'image/png', url: 'blob:caller-first' },
          { id: 'file-1', name: 'First file', type: 'image/png', file: firstFile, url: 'blob:caller-file' },
          { id: 'preview-2', name: 'Second preview', type: 'image/png', url: 'https://example.com/image.png' },
          { id: 'file-2', name: 'Second file', type: 'image/png', file: secondFile }
        ]
      },
      { id: 'empty', role: 'assistant', content: '', attachments: [] },
      { id: 'plain', role: 'assistant', content: 'Plain' },
      {
        id: 'file-only',
        role: 'user',
        content: 'File',
        attachments: [{ id: 'file', name: 'First file', type: 'image/png', file: firstFile }]
      }
    ];
    const current = conversationMessages(initial);
    const view = createConversationView(initial);
    expect(view.messages([])).toEqual([]);
    initial[0]!.attachments![0]!.url = 'blob:mutated';
    initial[0]!.attachments!.reverse();
    current[0]!.content = 'Current content';
    const first = view.messages(current);
    expect(first[0]).toMatchObject({ content: 'Current content', timestamp: 123 });
    expect(first[0]!.attachments!.map(({ id }) => id)).toEqual(['preview-1', 'file-1', 'preview-2', 'file-2']);
    expect(first[0]!.attachments!.map(({ url }) => url)).toEqual([
      'blob:caller-first',
      'blob:preview-1',
      'https://example.com/image.png',
      'blob:preview-2'
    ]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    first[0]!.attachments![0]!.name = 'Mutated output';
    expect(view.messages(current)[0]!.attachments![0]!.name).toBe('First preview');
    expect(view.messages([])).toEqual([]);
    expect(vi.mocked(URL.revokeObjectURL).mock.calls).toEqual([['blob:preview-1'], ['blob:preview-2']]);
    expect(view.messages(current)[0]!.attachments![0]!.url).toBe('blob:caller-first');
    view.dispose();
    expect(vi.mocked(URL.revokeObjectURL).mock.calls).toEqual([
      ['blob:preview-1'],
      ['blob:preview-2'],
      ['blob:preview-3'],
      ['blob:preview-4']
    ]);
    expect(view.messages(current)[0]!.attachments!.map(({ id }) => id)).toEqual(['file-1', 'file-2']);
    view.dispose();
  });

  it('uses current native attachments once when they replace initial previews and keeps added files last', () => {
    const preview = { id: 'replaced', name: 'Preview', type: 'image/png', url: 'blob:caller' };
    const initial = [
      {
        id: 'message',
        role: 'user' as const,
        content: 'Source',
        attachments: [preview, { ...preview, id: 'retained' }, { ...preview, id: 'retained' }]
      }
    ];
    const view = createConversationView(initial);
    const file = new File(['Current'], 'current.png', { type: 'image/png' });
    const output = view.messages([
      message([
        { id: 'extra-1', value: 'First extra' },
        { id: 'replaced', name: 'Current attachment', value: file },
        { id: 'extra-2', value: 'Second extra' }
      ])
    ]);
    expect(output[0]!.attachments!.map(({ id }) => id)).toEqual(['replaced', 'retained', 'extra-1', 'extra-2']);
    expect(output[0]!.attachments![0]).toMatchObject({ name: 'Current attachment', file, url: 'blob:preview-1' });
    expect(output[0]!.attachments![1]).toEqual({ ...preview, id: 'retained' });
    expect(view.messages([{ ...message(), id: 'different' }])[0]).not.toHaveProperty('attachments');
    view.dispose();
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:preview-1');
  });

  it('renders initial URL-only metadata without browser Blob APIs and forgets it on disposal', () => {
    const initial: ConversationMessageView[] = [
      {
        id: 'message',
        role: 'assistant',
        content: 'Saved answer',
        timestamp: 7,
        attachments: [{ id: 'saved', name: 'Saved image', type: 'image/png', url: 'https://example.com/image.png' }]
      }
    ];
    const view = createConversationView(initial);
    const current = conversationMessages(initial);
    vi.stubGlobal('File', undefined);
    vi.stubGlobal('Blob', undefined);
    expect(view.messages(current)).toEqual(initial);
    view.dispose();
    expect(view.messages(current)[0]).not.toHaveProperty('attachments');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe('chat reading position', () => {
  it('follows new output while pinned, preserves reading position, and jumps when requested', () => {
    const viewport = createChatViewport();
    const element = { scrollHeight: 1000, scrollTop: 0, clientHeight: 400 };
    expect(viewport.update(element)).toBe(false);
    expect(element.scrollTop).toBe(1000);
    element.scrollTop = 200;
    expect(viewport.scroll(element)).toBe(false);
    element.scrollHeight = 1200;
    expect(viewport.update(element)).toBe(true);
    expect(element.scrollTop).toBe(200);
    expect(viewport.scroll(element)).toBe(true);
    expect(viewport.update(element, true, true)).toBe(false);
    expect(element.scrollTop).toBe(1200);
    element.scrollTop = 800;
    expect(viewport.scroll(element)).toBe(false);
  });

  it('ignores absent or disabled viewports and respects the near-bottom threshold', () => {
    const viewport = createChatViewport();
    const element = { scrollHeight: 1000, scrollTop: 528, clientHeight: 400 };
    expect(viewport.update(null)).toBe(false);
    expect(viewport.update(undefined)).toBe(false);
    expect(viewport.update(element, false, true)).toBe(false);
    expect(element.scrollTop).toBe(528);
    viewport.scroll(element);
    expect(viewport.update(element)).toBe(true);
    element.scrollTop = 529;
    expect(viewport.scroll(element)).toBe(false);
    element.scrollHeight = 1100;
    expect(viewport.update(element)).toBe(false);
    expect(element.scrollTop).toBe(1100);
  });
});

describe('chat timestamps', () => {
  const now = Date.UTC(2026, 8, 19, 12);
  it.each([
    [undefined, 'just now'],
    [now + 60_000, 'just now'],
    [now - 59_999, 'just now'],
    [now - 60_000, '1m ago'],
    [now - 3_600_000, '1h ago'],
    [now - 86_400_000, '1d ago'],
    [now - 6 * 86_400_000, '6d ago'],
    [now - 7 * 86_400_000, 'Sep 12']
  ])('formats timestamp %s as %s', (timestamp, expected) => {
    expect(formatRelativeTime(timestamp, now)).toBe(expected);
  });

  it('uses current time by default and emits ISO timestamps for accessible time elements', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(formatRelativeTime(now - 60_000)).toBe('1m ago');
    expect(toDateTime()).toBe('2026-09-19T12:00:00.000Z');
    expect(toDateTime(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(formatRelativeTime(0, now)).toBe(
      new Date(0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
  });

  it.each([NaN, Infinity, -Infinity, 8.64e15 + 1, -8.64e15 - 1])(
    'renders invalid stored timestamp %s without throwing',
    (timestamp) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(timestamp, now)).toBe('just now');
      expect(toDateTime(timestamp)).toBe('2026-09-19T12:00:00.000Z');
    }
  );
});
