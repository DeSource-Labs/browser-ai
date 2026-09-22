import { createBrowserAiStore } from './store.js';
import { projectWorkflow } from './workflows/state.js';

export type AiChatTool = string;

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AiChatSummaryRecord {
  id: string;
  startIndex: number;
  endIndex: number;
  messageIds: string[];
  hash: string;
  summary: string;
  tokenUsage: number | null;
  level: number;
  createdAt: number;
  updatedAt: number;
}

export interface AiChatRecord {
  id: string;
  tool: AiChatTool;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AiChatMessage[];
  summaries: AiChatSummaryRecord[];
}

const DB_NAME = 'browser-ai';
const DB_VERSION = 1;
const CHATS_STORE = 'chats';

// Browser instances share a fallback; server requests receive their own map.
const browserMemoryChats = new Map<string, AiChatRecord>();
let dbPromise: Promise<IDBDatabase> | null = null;

const cloneMessage = (message: AiChatMessage): AiChatMessage => ({
  ...message
});

const cloneSummary = (summary: AiChatSummaryRecord): AiChatSummaryRecord => ({
  ...summary,
  messageIds: [...summary.messageIds]
});

const cloneChat = (chat: AiChatRecord): AiChatRecord => ({
  ...chat,
  messages: Array.isArray(chat.messages) ? chat.messages.map(cloneMessage) : [],
  summaries: Array.isArray(chat.summaries) ? chat.summaries.map(cloneSummary) : []
});

const getDatabase = async (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null;
  if (dbPromise) return dbPromise;

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let failed = false;
    const fail = (error: unknown) => {
      failed = true;
      reject(error);
    };
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CHATS_STORE)) {
        const store = database.createObjectStore(CHATS_STORE, { keyPath: 'id' });
        store.createIndex('tool', 'tool', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      if (failed) {
        database.close();
        return;
      }
      const invalidate = () => {
        if (dbPromise === pending) dbPromise = null;
      };
      database.onversionchange = () => {
        database.close();
        invalidate();
      };
      database.onclose = invalidate;
      resolve(database);
    };
    request.onerror = () => fail(request.error ?? new Error('Failed to open IndexedDB'));
    request.onblocked = () => fail(new Error('Chat storage is blocked by another open database connection.'));
  });
  const pending = opening.catch((error: unknown) => {
    if (dbPromise === pending) dbPromise = null;
    throw error;
  });
  dbPromise = pending;
  return pending;
};

const transact = <Value>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  request: (store: IDBObjectStore) => IDBRequest<Value>
): Promise<Value> => {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CHATS_STORE, mode);
    let result: Value;
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () =>
      reject(transaction.error ?? new DOMException('Chat transaction aborted.', 'AbortError'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Chat transaction failed.'));
    try {
      const operation = request(transaction.objectStore(CHATS_STORE));
      operation.onsuccess = () => {
        result = operation.result;
      };
      operation.onerror = () => reject(operation.error ?? new Error('IndexedDB request failed'));
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
};

const readActiveChatId = (tool: AiChatTool): string | null => {
  try {
    return typeof window === 'undefined' || typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem(getActiveChatStorageKey(tool));
  } catch {
    return null;
  }
};

const persistActiveChatId = (tool: AiChatTool, chatId: string | null) => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const key = getActiveChatStorageKey(tool);
    if (chatId) localStorage.setItem(key, chatId);
    else localStorage.removeItem(key);
  } catch {
    // Selection is optional metadata; denied storage must not prevent chat CRUD.
  }
};

const generateId = () => {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
};

const getActiveChatStorageKey = (tool: AiChatTool) => {
  return `browser-ai.active-chat.${tool}`;
};

const isValidTimestamp = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

const isValidRole = (value: unknown): value is 'user' | 'assistant' => {
  return value === 'user' || value === 'assistant';
};

const normalizeMessages = (source: unknown, baseTimestamp: number): { messages: AiChatMessage[]; changed: boolean } => {
  const rawMessages = Array.isArray(source) ? source : [];
  let changed = !Array.isArray(source);
  let previousTimestamp = baseTimestamp;

  const messages = rawMessages.map((rawMessage, index) => {
    const entry = (rawMessage ?? {}) as Partial<AiChatMessage>;

    const fallbackTimestamp = previousTimestamp + Math.max(index === 0 ? 0 : 1000, 1);
    const timestamp = isValidTimestamp(entry.timestamp) ? entry.timestamp : fallbackTimestamp;
    if (!isValidTimestamp(entry.timestamp)) {
      changed = true;
    }

    previousTimestamp = Math.max(previousTimestamp, timestamp);

    const id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : generateId();
    if (id !== entry.id) {
      changed = true;
    }

    const role = isValidRole(entry.role) ? entry.role : 'user';
    if (role !== entry.role) {
      changed = true;
    }

    const content = typeof entry.content === 'string' ? entry.content : String(entry.content ?? '');
    if (content !== entry.content) {
      changed = true;
    }

    return {
      id,
      role,
      content,
      timestamp
    };
  });

  return { messages, changed };
};

const normalizeSummaries = (
  source: unknown,
  messageCount: number
): { summaries: AiChatSummaryRecord[]; changed: boolean } => {
  const rawSummaries = Array.isArray(source) ? source : [];
  let changed = !Array.isArray(source);
  const seen = new Set<string>();
  const summaries: AiChatSummaryRecord[] = [];

  rawSummaries.forEach((rawSummary) => {
    const entry = (rawSummary ?? {}) as Partial<AiChatSummaryRecord>;
    const startIndex = Number.isInteger(entry.startIndex) ? (entry.startIndex as number) : -1;
    const endIndex = Number.isInteger(entry.endIndex) ? (entry.endIndex as number) : -1;
    const hash = typeof entry.hash === 'string' ? entry.hash : '';
    const summary = typeof entry.summary === 'string' ? entry.summary : '';

    if (
      startIndex < 0 ||
      endIndex <= startIndex ||
      endIndex > messageCount ||
      hash.length === 0 ||
      summary.trim().length === 0
    ) {
      changed = true;
      return;
    }

    const level = Number.isInteger(entry.level) && entry.level! >= 0 ? entry.level! : 0;
    const key = `${level}:${startIndex}:${endIndex}:${hash}`;
    if (seen.has(key)) {
      changed = true;
      return;
    }
    seen.add(key);

    const id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : generateId();
    const createdAt = isValidTimestamp(entry.createdAt) ? entry.createdAt : Date.now();
    const updatedAt = isValidTimestamp(entry.updatedAt) ? entry.updatedAt : createdAt;
    const messageIds = Array.isArray(entry.messageIds)
      ? entry.messageIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
    const tokenUsage =
      typeof entry.tokenUsage === 'number' && Number.isFinite(entry.tokenUsage) ? entry.tokenUsage : null;

    if (
      id !== entry.id ||
      createdAt !== entry.createdAt ||
      updatedAt !== entry.updatedAt ||
      level !== entry.level ||
      tokenUsage !== entry.tokenUsage ||
      messageIds.length !== entry.messageIds?.length
    ) {
      changed = true;
    }

    summaries.push({
      id,
      startIndex,
      endIndex,
      messageIds,
      hash,
      summary,
      tokenUsage,
      level,
      createdAt,
      updatedAt
    });
  });

  return {
    summaries: summaries.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
      return a.endIndex - b.endIndex;
    }),
    changed
  };
};

const normalizeChatRecord = (
  source: Partial<AiChatRecord>,
  tool: AiChatTool
): { chat: AiChatRecord; changed: boolean } => {
  const now = Date.now();
  let changed = false;

  const id = typeof source.id === 'string' && source.id.length > 0 ? source.id : generateId();
  if (id !== source.id) {
    changed = true;
  }

  const createdAt = isValidTimestamp(source.createdAt) ? source.createdAt : now;
  if (!isValidTimestamp(source.createdAt)) {
    changed = true;
  }

  const toolValue = typeof source.tool === 'string' && source.tool.length > 0 ? source.tool : tool;
  if (toolValue !== source.tool) {
    changed = true;
  }

  const normalizedMessages = normalizeMessages(source.messages, createdAt);
  changed = changed || normalizedMessages.changed;
  const normalizedSummaries = normalizeSummaries(source.summaries, normalizedMessages.messages.length);
  changed = changed || normalizedSummaries.changed;

  const lastMessageTimestamp =
    normalizedMessages.messages[normalizedMessages.messages.length - 1]?.timestamp ?? createdAt;

  let updatedAt = isValidTimestamp(source.updatedAt) ? source.updatedAt : Math.max(createdAt, lastMessageTimestamp);
  if (!isValidTimestamp(source.updatedAt)) {
    changed = true;
  }
  if (updatedAt < lastMessageTimestamp) {
    updatedAt = lastMessageTimestamp;
    changed = true;
  }

  const title = typeof source.title === 'string' && source.title.trim().length > 0 ? source.title.trim() : 'New chat';
  if (title !== source.title) {
    changed = true;
  }

  return {
    chat: {
      id,
      tool: toolValue,
      title,
      createdAt,
      updatedAt,
      messages: normalizedMessages.messages,
      summaries: normalizedSummaries.summaries
    },
    changed
  };
};

export function createAiChats(tool: AiChatTool) {
  const server = typeof window === 'undefined';
  const memory = server ? new Map<string, AiChatRecord>() : browserMemoryChats;
  let current = {
    chats: [] as AiChatRecord[],
    activeChatId: null as string | null,
    loaded: false,
    processing: '' as '' | 'load' | 'save',
    error: null as unknown
  };
  const store = createBrowserAiStore(current);
  let generation = 0;
  let queue = Promise.resolve();
  const update = (patch: Partial<typeof current>) => {
    current = { ...current, ...patch };
    store.update(current);
  };
  const assertCurrent = (owner: number) => {
    if (owner !== generation) throw new DOMException('Chat operation was disposed.', 'AbortError');
  };
  const enqueue = <Value>(phase: 'load' | 'save', action: (owner: number) => Promise<Value>): Promise<Value> => {
    const owner = generation;
    const result = queue.then(async () => {
      assertCurrent(owner);
      update({ processing: phase, error: null });
      try {
        const value = await action(owner);
        assertCurrent(owner);
        return value;
      } catch (error) {
        if (owner === generation) update({ error });
        throw error;
      } finally {
        if (owner === generation) update({ processing: '' });
      }
    });
    queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
  const sortedChats = () => [...current.chats].sort((a, b) => b.updatedAt - a.updatedAt);
  const setActiveChatId = (chatId: string | null) => update({ activeChatId: chatId });
  const select = (chatId: string | null) => {
    setActiveChatId(chatId);
    persistActiveChatId(tool, chatId);
  };
  const putChat = async (chat: AiChatRecord, owner: number) => {
    const value = cloneChat(chat);
    const database = await getDatabase();
    assertCurrent(owner);
    if (database) await transact(database, 'readwrite', (store) => store.put(value));
    else memory.set(value.id, value);
    assertCurrent(owner);
  };
  const upsert = async (chat: AiChatRecord, owner: number) => {
    const normalized = normalizeChatRecord(chat, tool).chat;
    await putChat(normalized, owner);
    const exists = current.chats.some((item) => item.id === normalized.id);
    update({
      chats: exists
        ? current.chats.map((item) => (item.id === normalized.id ? cloneChat(normalized) : item))
        : [cloneChat(normalized), ...current.chats]
    });
  };
  const loadChats = () =>
    enqueue('load', async (owner) => {
      const database = await getDatabase();
      assertCurrent(owner);
      const records = database
        ? ((await transact(database, 'readonly', (store) => store.index('tool').getAll(tool))) as AiChatRecord[])
        : Array.from(memory.values()).filter((chat) => chat.tool === tool);
      assertCurrent(owner);
      // Normalize raw database values before cloning nested message and summary data.
      const normalized = records.map((record) => normalizeChatRecord(record, tool));
      await Promise.all(normalized.filter((item) => item.changed).map((item) => putChat(item.chat, owner)));
      assertCurrent(owner);
      const chats = normalized.map((item) => cloneChat(item.chat)).sort((a, b) => b.updatedAt - a.updatedAt);
      const preferred = readActiveChatId(tool);
      update({
        chats,
        activeChatId: preferred && chats.some((chat) => chat.id === preferred) ? preferred : (chats[0]?.id ?? null),
        loaded: true
      });
    });
  const createChat = (title = 'New chat', initialMessages: AiChatMessage[] = []) => {
    // Detach caller-owned data before the asynchronous write is queued.
    const messages = normalizeMessages(initialMessages, Date.now()).messages;
    return enqueue('save', async (owner) => {
      const now = Date.now();
      const record = normalizeChatRecord(
        {
          id: generateId(),
          tool,
          title,
          createdAt: now,
          updatedAt: now,
          messages,
          summaries: []
        },
        tool
      ).chat;
      await putChat(record, owner);
      update({ chats: [record, ...current.chats] });
      select(record.id);
      return cloneChat(record);
    });
  };
  const selectChat = (chatId: string) => {
    if (current.chats.some((chat) => chat.id === chatId)) select(chatId);
  };
  const clearActiveChat = () => select(null);
  const getChatById = (chatId: string) => {
    const target = current.chats.find((chat) => chat.id === chatId);
    return target ? cloneChat(target) : null;
  };
  const renameChat = (chatId: string, title: string) =>
    enqueue('save', async (owner) => {
      const normalizedTitle = title.trim();
      if (!normalizedTitle) return;
      const target = current.chats.find((chat) => chat.id === chatId);
      if (target) await upsert({ ...target, title: normalizedTitle, updatedAt: Date.now() }, owner);
    });
  const updateMessages = (chatId: string, messages: AiChatMessage[]) => {
    const copied = messages.map((message) => ({ ...message }));
    return enqueue('save', async (owner) => {
      const target = current.chats.find((chat) => chat.id === chatId);
      if (!target) return;
      await upsert(
        {
          ...target,
          messages: normalizeMessages(copied, target.createdAt).messages,
          updatedAt: Date.now()
        },
        owner
      );
    });
  };
  const updateSummaries = (chatId: string, summaries: AiChatSummaryRecord[]) => {
    const copied = normalizeSummaries(summaries, Number.MAX_SAFE_INTEGER).summaries;
    return enqueue('save', async (owner) => {
      const target = current.chats.find((chat) => chat.id === chatId);
      if (!target) return;
      await upsert({ ...target, summaries: normalizeSummaries(copied, target.messages.length).summaries }, owner);
    });
  };
  const deleteChat = (chatId: string) =>
    enqueue('save', async (owner) => {
      const target = current.chats.find((chat) => chat.id === chatId);
      if (!target) return null;
      const database = await getDatabase();
      assertCurrent(owner);
      if (database) await transact(database, 'readwrite', (store) => store.delete(chatId));
      else memory.delete(chatId);
      assertCurrent(owner);
      update({ chats: current.chats.filter((chat) => chat.id !== chatId) });
      if (current.activeChatId === chatId) select(sortedChats()[0]?.id ?? null);
      return cloneChat(target);
    });
  const restoreChat = (chat: AiChatRecord) => {
    const copied = normalizeChatRecord(chat, tool).chat;
    return enqueue('save', (owner) => upsert(copied, owner));
  };
  const dispose = () => {
    generation += 1;
    queue = Promise.resolve();
    if (server) memory.clear();
    update({ chats: [], activeChatId: null, loaded: false, processing: '', error: null });
  };
  return projectWorkflow(
    store,
    () => ({
      ...current,
      chats: sortedChats(),
      activeChat: current.chats.find((chat) => chat.id === current.activeChatId) ?? null,
      isReady: current.loaded,
      isProcessing: current.processing !== ''
    }),
    {
      loadChats,
      createChat,
      selectChat,
      clearActiveChat,
      renameChat,
      updateMessages,
      updateSummaries,
      deleteChat,
      restoreChat,
      getChatById,
      setActiveChatId,
      dispose
    }
  );
}
