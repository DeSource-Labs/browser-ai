import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { flushPromises } from './helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiChatRecord, AiChatSummaryRecord } from '../src/chats';

const loadController = async () => {
  vi.resetModules();
  return (await import('../src/chats')).createAiChats;
};

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const openDatabase = (factory: IDBFactory) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('browser-ai', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('chats', { keyPath: 'id' });
      store.createIndex('tool', 'tool');
      store.createIndex('updatedAt', 'updatedAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

describe('createAiChats', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('indexedDB', undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates isolated in-memory chats and returns defensive clones', async () => {
    const createAiChats = await loadController();
    const prompt = createAiChats('prompt');
    const writer = createAiChats('writer');
    await prompt.loadChats();
    await writer.loadChats();
    expect(prompt.state.getSnapshot().loaded).toBe(true);
    expect(prompt.state.getSnapshot().activeChat).toBeNull();

    const first = await prompt.createChat('First', [{ id: 'm1', role: 'user', content: 'Hello', timestamp: 10 }]);
    await writer.createChat('Writer');
    first.messages[0]!.content = 'mutated clone';
    expect(prompt.getChatById(first.id)?.messages[0]?.content).toBe('Hello');
    expect(prompt.state.getSnapshot().chats).toHaveLength(1);
    expect(writer.state.getSnapshot().chats).toHaveLength(1);
    expect(localStorage.getItem('browser-ai.active-chat.prompt')).toBe(first.id);

    prompt.clearActiveChat();
    expect(prompt.state.getSnapshot().activeChat).toBeNull();
    expect(localStorage.getItem('browser-ai.active-chat.prompt')).toBeNull();
    prompt.selectChat('missing');
    expect(prompt.state.getSnapshot().activeChatId).toBeNull();
    prompt.selectChat(first.id);
    expect(prompt.state.getSnapshot().activeChat?.id).toBe(first.id);
    prompt.setActiveChatId('missing');
    expect(prompt.state.getSnapshot().activeChat).toBeNull();
  });

  it('normalizes malformed records, messages, summaries, and chronology', async () => {
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    const createAiChats = await loadController();
    const store = createAiChats('prompt');
    const malformed = {
      id: '',
      tool: '',
      title: '   ',
      createdAt: Number.NaN,
      updatedAt: undefined,
      messages: [
        null,
        { id: '', role: 'invalid', content: 42, timestamp: -1 },
        { id: 'assistant', role: 'assistant', content: 'Done', timestamp: 50 }
      ],
      summaries: [
        null,
        { startIndex: -1, endIndex: 1, hash: 'bad', summary: 'bad' },
        { startIndex: 0, endIndex: 99, hash: 'bad', summary: 'bad' },
        { startIndex: 0, endIndex: 2, hash: '', summary: 'bad' },
        { startIndex: 0, endIndex: 2, hash: 'h', summary: '   ' },
        {
          id: '',
          startIndex: 0,
          endIndex: 2,
          messageIds: ['m1', '', 2],
          hash: 'h',
          summary: 'Summary',
          tokenUsage: Number.NaN,
          level: -1,
          createdAt: 0,
          updatedAt: 0
        },
        {
          id: 'duplicate',
          startIndex: 0,
          endIndex: 2,
          messageIds: [],
          hash: 'h',
          summary: 'Duplicate',
          tokenUsage: 2,
          level: 0,
          createdAt: 2,
          updatedAt: 2
        },
        {
          id: 'later',
          startIndex: 1,
          endIndex: 3,
          messageIds: ['assistant'],
          hash: 'later',
          summary: 'Later',
          tokenUsage: 3,
          level: 1,
          createdAt: 3,
          updatedAt: 4
        },
        {
          id: 'same-level-a',
          startIndex: 0,
          endIndex: 1,
          hash: 'same-a',
          summary: 'Same A',
          tokenUsage: 1,
          level: 2,
          createdAt: 5,
          updatedAt: 5
        },
        {
          id: 'same-level-b',
          startIndex: 0,
          endIndex: 2,
          hash: 'same-b',
          summary: 'Same B',
          tokenUsage: 1,
          level: 2,
          createdAt: 6,
          updatedAt: 6
        },
        {
          id: 'same-level-c',
          startIndex: 1,
          endIndex: 3,
          hash: 'same-c',
          summary: 'Same C',
          tokenUsage: 1,
          level: 2,
          createdAt: 7,
          updatedAt: 7
        }
      ]
    } as unknown as AiChatRecord;

    await store.restoreChat(malformed);
    expect(store.state.getSnapshot().chats).toHaveLength(1);
    const normalized = store.state.getSnapshot().chats[0]!;
    expect(normalized.id).not.toBe('');
    expect(normalized.tool).toBe('prompt');
    expect(normalized.title).toBe('New chat');
    expect(normalized.messages).toHaveLength(3);
    expect(normalized.messages[1]).toMatchObject({ role: 'user', content: '42' });
    expect(normalized.messages[0]!.timestamp).toBeGreaterThan(0);
    expect(normalized.updatedAt).toBeGreaterThanOrEqual(normalized.messages.at(-1)!.timestamp);
    expect(normalized.summaries).toHaveLength(5);
    expect(normalized.summaries[0]).toMatchObject({ level: 0, tokenUsage: null, messageIds: ['m1'] });
    expect(normalized.summaries[1]?.id).toBe('later');
    expect(normalized.summaries.slice(2).map((summary) => summary.id)).toEqual([
      'same-level-a',
      'same-level-b',
      'same-level-c'
    ]);
    vi.useRealTimers();
  });

  it('updates, sorts, renames, deletes, and restores chats', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const createAiChats = await loadController();
    const store = createAiChats('prompt');
    const first = await store.createChat('First');
    vi.setSystemTime(2_000);
    const second = await store.createChat('Second');
    expect(store.state.getSnapshot().chats.map((chat) => chat.id)).toEqual([second.id, first.id]);

    await store.renameChat(first.id, '  Renamed  ');
    await store.renameChat(first.id, '   ');
    await store.renameChat('missing', 'Ignored');
    expect(store.getChatById(first.id)?.title).toBe('Renamed');
    expect(store.getChatById('missing')).toBeNull();

    const messages = [{ id: 'm', role: 'user' as const, content: 'Message', timestamp: 3_000 }];
    await store.updateMessages(first.id, messages);
    await store.updateMessages('missing', messages);
    const summary: AiChatSummaryRecord = {
      id: 's',
      startIndex: 0,
      endIndex: 1,
      messageIds: ['m'],
      hash: 'hash',
      summary: 'Summary',
      tokenUsage: 5,
      level: 0,
      createdAt: 3_000,
      updatedAt: 3_000
    };
    await store.updateSummaries(first.id, [summary]);
    await store.updateSummaries('missing', [summary]);
    expect(store.getChatById(first.id)).toMatchObject({ messages, summaries: [summary] });

    expect(await store.deleteChat('missing')).toBeNull();
    store.selectChat(second.id);
    const removedInactive = await store.deleteChat(first.id);
    expect(removedInactive?.id).toBe(first.id);
    expect(store.state.getSnapshot().activeChatId).toBe(second.id);
    await store.restoreChat(removedInactive!);
    expect(store.getChatById(first.id)).not.toBeNull();

    const removedActive = await store.deleteChat(second.id);
    expect(removedActive?.id).toBe(second.id);
    expect(store.state.getSnapshot().activeChatId).toBe(first.id);
    await store.deleteChat(first.id);
    expect(store.state.getSnapshot().activeChatId).toBeNull();
    vi.useRealTimers();
  });

  it('loads the persisted active chat and falls back when preference is stale', async () => {
    const createAiChats = await loadController();
    const initial = createAiChats('prompt');
    const first = await initial.createChat('First');
    await initial.createChat('Second');

    localStorage.setItem('browser-ai.active-chat.prompt', first.id);
    const preferred = createAiChats('prompt');
    await preferred.loadChats();
    expect(preferred.state.getSnapshot().activeChatId).toBe(first.id);

    localStorage.setItem('browser-ai.active-chat.prompt', 'missing');
    const fallback = createAiChats('prompt');
    await fallback.loadChats();
    expect(fallback.state.getSnapshot().activeChatId).toBe(fallback.state.getSnapshot().chats[0]?.id);
  });

  it('works without localStorage and falls back when randomUUID is unavailable', async () => {
    const createAiChats = await loadController();
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(Date, 'now').mockReturnValue(123);
    const store = createAiChats('prompt');
    const chat = await store.createChat();
    expect(chat.id).toBe('123-0.5');
    store.clearActiveChat();
    await store.loadChats();
    expect(store.state.getSnapshot().loaded).toBe(true);
  });

  it('uses IndexedDB for durable CRUD', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const createAiChats = await loadController();
    const store = createAiChats('prompt');
    const created = await store.createChat('Indexed');
    await store.updateMessages(created.id, [{ id: 'm', role: 'user', content: 'Stored', timestamp: 10 }]);

    const loaded = createAiChats('prompt');
    await loaded.loadChats();
    expect(loaded.getChatById(created.id)?.messages[0]?.content).toBe('Stored');
    await loaded.deleteChat(created.id);
    const empty = createAiChats('prompt');
    await empty.loadChats();
    expect(empty.state.getSnapshot().chats).toHaveLength(0);
  });

  it('migrates malformed IndexedDB rows and sorts multiple records', async () => {
    const factory = new IDBFactory();
    vi.stubGlobal('indexedDB', factory);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open('browser-ai', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('chats', { keyPath: 'id' });
        store.createIndex('tool', 'tool');
        store.createIndex('updatedAt', 'updatedAt');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');
    store.put({ id: 'older', tool: 'prompt', title: 'Older', createdAt: 1, updatedAt: 2, messages: [], summaries: [] });
    store.put({
      id: 'newer',
      tool: 'prompt',
      title: '',
      createdAt: 3,
      updatedAt: undefined,
      messages: undefined,
      summaries: undefined
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();

    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    await chats.loadChats();
    expect(chats.state.getSnapshot().chats).toHaveLength(2);
    expect(chats.getChatById('newer')).toMatchObject({ title: 'New chat', messages: [], summaries: [] });
  });
  it('isolates server requests and clears only owned server memory on disposal', async () => {
    vi.stubGlobal('window', undefined);
    const storage = localStorage;
    const readPreference = vi.spyOn(storage, 'getItem');
    const writePreference = vi.spyOn(storage, 'setItem');
    const createAiChats = await loadController();
    const firstRequest = createAiChats('prompt');
    await firstRequest.createChat('Private request');
    const secondRequest = createAiChats('prompt');
    await secondRequest.loadChats();
    expect(secondRequest.state.getSnapshot().chats).toEqual([]);
    expect(firstRequest.state.getSnapshot().chats).toHaveLength(1);
    expect(readPreference).not.toHaveBeenCalled();
    expect(writePreference).not.toHaveBeenCalled();
    firstRequest.dispose();
    await firstRequest.loadChats();
    expect(firstRequest.state.getSnapshot().chats).toEqual([]);
  });

  it.each(['create', 'rename', 'delete'] as const)(
    'rejects a %s transaction aborted after request success without publishing phantom state',
    async (operation) => {
      vi.stubGlobal('indexedDB', new IDBFactory());
      const createAiChats = await loadController();
      const chats = createAiChats('prompt');
      const original = await chats.createChat('Original');
      const nativePut = IDBObjectStore.prototype.put;
      const nativeDelete = IDBObjectStore.prototype.delete;
      const abortOnSuccess = <Value>(store: IDBObjectStore, request: IDBRequest<Value>) => {
        request.addEventListener('success', () => store.transaction.abort(), { once: true });
        return request;
      };
      const write =
        operation === 'delete'
          ? vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, key) {
              return abortOnSuccess(this, nativeDelete.call(this, key));
            })
          : vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value) {
              return abortOnSuccess(this, nativePut.call(this, value));
            });
      const result =
        operation === 'create'
          ? chats.createChat('Unsaved')
          : operation === 'rename'
            ? chats.renameChat(original.id, 'Unsaved')
            : chats.deleteChat(original.id);
      await expect(result).rejects.toMatchObject({ name: 'AbortError' });
      expect(chats.state.getSnapshot()).toMatchObject({
        chats: [original],
        activeChatId: original.id,
        processing: '',
        error: expect.objectContaining({ name: 'AbortError' })
      });
      write.mockRestore();
      const reloaded = createAiChats('prompt');
      await reloaded.loadChats();
      expect(reloaded.state.getSnapshot().chats).toEqual([original]);
    }
  );

  it('retains committed data on quota failure and continues processing later writes', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    const original = await chats.createChat('Original');
    const quota = new DOMException('Storage quota exceeded.', 'QuotaExceededError');
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw quota;
    });
    await expect(chats.createChat('Unsaved')).rejects.toBe(quota);
    expect(chats.state.getSnapshot()).toMatchObject({ chats: [original], error: quota, processing: '' });
    await chats.renameChat(original.id, 'Saved');
    expect(chats.getChatById(original.id)?.title).toBe('Saved');
    expect(chats.state.getSnapshot().error).toBeNull();
  });

  it('reports an asynchronous IndexedDB request failure without publishing the rejected write', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    const original = await chats.createChat('Original');
    // add() reproduces a native asynchronous constraint error for an existing key.
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (this: IDBObjectStore, value: unknown) {
      return this.add(value);
    });
    await expect(chats.renameChat(original.id, 'Rejected')).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(chats.getChatById(original.id)).toEqual(original);
    expect(chats.state.getSnapshot().processing).toBe('');
    await flushPromises();
  });

  it('keeps chat CRUD usable when reading or writing the active preference is denied', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(localStorage, method).mockImplementation(() => {
        throw new DOMException('Denied', 'SecurityError');
      });
    }
    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    const created = await chats.createChat('Persisted');
    expect(chats.state.getSnapshot().activeChatId).toBe(created.id);
    expect(() => chats.clearActiveChat()).not.toThrow();
    const reloaded = createAiChats('prompt');
    await reloaded.loadChats();
    expect(reloaded.getChatById(created.id)).toEqual(created);
    expect(reloaded.state.getSnapshot().activeChatId).toBe(created.id);
  });

  it('repairs malformed stored summaries before cloning and persists the repaired record', async () => {
    const factory = new IDBFactory();
    vi.stubGlobal('indexedDB', factory);
    const database = await openDatabase(factory);
    const transaction = database.transaction('chats', 'readwrite');
    transaction.objectStore('chats').put({
      id: 'malformed',
      tool: 'prompt',
      title: 'Saved',
      createdAt: 1,
      updatedAt: 2,
      messages: [{ id: 'm', role: 'user', content: 'Text', timestamp: 1 }],
      summaries: [null, { startIndex: 0, endIndex: 1, hash: 'h', summary: 'Summary' }]
    });
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });
    database.close();
    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    await chats.loadChats();
    const repaired = chats.getChatById('malformed')!;
    expect(repaired.summaries).toHaveLength(1);
    expect(repaired.summaries[0]).toMatchObject({ messageIds: [], tokenUsage: null, level: 0 });
    repaired.summaries[0]!.messageIds.push('caller mutation');
    const next = createAiChats('prompt');
    await next.loadChats();
    expect(next.getChatById('malformed')?.summaries[0]?.messageIds).toEqual([]);
  });

  it.each([new DOMException('Denied', 'SecurityError'), null])('retries a failed database open (%s)', async (error) => {
    const request = { error } as IDBOpenDBRequest;
    const open = vi.fn().mockReturnValue(request);
    vi.stubGlobal('indexedDB', { open });
    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    const loading = chats.loadChats();
    const rejected = expect(loading).rejects.toThrow(error?.message ?? 'Failed to open IndexedDB');
    await flushPromises();
    request.onerror?.(new Event('error'));
    await rejected;
    vi.stubGlobal('indexedDB', new IDBFactory());
    await chats.loadChats();
    expect(chats.state.getSnapshot()).toMatchObject({ loaded: true, error: null });
    expect(open).toHaveBeenCalledOnce();
  });

  it('rejects blocked opens and closes connections delivered after that rejection', async () => {
    const database = await openDatabase(new IDBFactory());
    const close = vi.spyOn(database, 'close');
    const request = { result: database } as IDBOpenDBRequest;
    vi.stubGlobal('indexedDB', { open: vi.fn().mockReturnValue(request) });
    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    const loading = chats.loadChats();
    const rejected = expect(loading).rejects.toThrow('Chat storage is blocked');
    await flushPromises();
    request.onblocked?.(new Event('blocked') as IDBVersionChangeEvent);
    await rejected;
    request.onsuccess?.(new Event('success'));
    expect(close).toHaveBeenCalledOnce();
    expect(chats.state.getSnapshot().loaded).toBe(false);
    vi.stubGlobal('indexedDB', new IDBFactory());
    await chats.loadChats();
    expect(chats.state.getSnapshot().loaded).toBe(true);
  });

  it('closes on versionchange and reopens after external deletion', async () => {
    const factory = new IDBFactory();
    vi.stubGlobal('indexedDB', factory);
    const open = vi.spyOn(factory, 'open');
    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    await chats.createChat('Previous database');
    const deletion = factory.deleteDatabase('browser-ai');
    await new Promise<void>((resolve, reject) => {
      deletion.onsuccess = () => resolve();
      deletion.onerror = () => reject(deletion.error);
      deletion.onblocked = () => reject(new Error('The library connection blocked database deletion.'));
    });
    await chats.loadChats();
    expect(chats.state.getSnapshot()).toMatchObject({ loaded: true, chats: [] });
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('rejects disposed pending work without clearing a reused controller or closing its shared connection', async () => {
    const database = await openDatabase(new IDBFactory());
    const close = vi.spyOn(database, 'close');
    const request = { result: database } as IDBOpenDBRequest;
    const open = vi.fn().mockReturnValue(request);
    vi.stubGlobal('indexedDB', { open });
    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    const stale = chats.loadChats();
    const rejected = expect(stale).rejects.toMatchObject({ name: 'AbortError' });
    await flushPromises();
    chats.dispose();
    const current = chats.loadChats();
    await flushPromises();
    request.onsuccess?.(new Event('success'));
    await rejected;
    expect(chats.state.getSnapshot()).toMatchObject({ processing: 'load', error: null });
    await current;
    expect(chats.state.getSnapshot()).toMatchObject({ loaded: true, processing: '', error: null });
    expect(open).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    database.close();
  });

  it('cancels queued mutations before they start and preserves browser fallback data on disposal', async () => {
    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    const saved = await chats.createChat('Saved');
    const pending = chats.createChat('Never saved');
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    chats.dispose();
    await rejected;
    await chats.loadChats();
    expect(chats.state.getSnapshot().chats).toEqual([saved]);
  });

  it('serializes loads and writes and snapshots queued caller data', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const createAiChats = await loadController();
    const chats = createAiChats('prompt');
    const loading = chats.loadChats();
    const creating = chats.createChat('Concurrent');
    const [, created] = await Promise.all([loading, creating]);
    expect(chats.state.getSnapshot()).toMatchObject({ loaded: true, chats: [created] });
    const messages = [{ id: 'm', role: 'user' as const, content: 'Queued', timestamp: 10 }];
    const updating = chats.updateMessages(created.id, messages);
    messages[0]!.content = 'Mutated later';
    await updating;
    expect(chats.getChatById(created.id)?.messages[0]?.content).toBe('Queued');
  });
});
