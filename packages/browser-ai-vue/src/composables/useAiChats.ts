import { computed, ref } from 'vue';

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

const inMemoryChats = new Map<string, AiChatRecord>();
let dbPromise: Promise<IDBDatabase> | null = null;

const canUseIndexedDB = () => {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
};

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

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
};

const getDatabase = async (): Promise<IDBDatabase | null> => {
  if (!canUseIndexedDB()) {
    return null;
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CHATS_STORE)) {
          const store = db.createObjectStore(CHATS_STORE, { keyPath: 'id' });
          store.createIndex('tool', 'tool', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to open IndexedDB'));
      };
    });
  }

  return dbPromise;
};

const getChatsByTool = async (tool: AiChatTool): Promise<AiChatRecord[]> => {
  const db = await getDatabase();
  if (!db) {
    return Array.from(inMemoryChats.values())
      .filter((chat) => chat.tool === tool)
      .map(cloneChat)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const tx = db.transaction(CHATS_STORE, 'readonly');
  const store = tx.objectStore(CHATS_STORE);
  const index = store.index('tool');
  const items = (await requestToPromise(index.getAll(tool))) as AiChatRecord[];
  return items.map(cloneChat).sort((a, b) => b.updatedAt - a.updatedAt);
};

const putChat = async (chat: AiChatRecord): Promise<void> => {
  const value = cloneChat(chat);
  const db = await getDatabase();
  if (!db) {
    inMemoryChats.set(value.id, value);
    return;
  }

  const tx = db.transaction(CHATS_STORE, 'readwrite');
  const store = tx.objectStore(CHATS_STORE);
  await requestToPromise(store.put(value));
};

const deleteChatRecord = async (id: string): Promise<void> => {
  const db = await getDatabase();
  if (!db) {
    inMemoryChats.delete(id);
    return;
  }

  const tx = db.transaction(CHATS_STORE, 'readwrite');
  const store = tx.objectStore(CHATS_STORE);
  await requestToPromise(store.delete(id));
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

export function useAiChats(tool: AiChatTool) {
  const chats = ref<AiChatRecord[]>([]);
  const activeChatId = ref<string | null>(null);
  const loaded = ref(false);

  const chatList = computed(() => {
    return [...chats.value].sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const activeChat = computed(() => {
    if (!activeChatId.value) return null;
    return chats.value.find((chat) => chat.id === activeChatId.value) ?? null;
  });

  const persistActiveChatId = (chatId: string | null) => {
    if (typeof localStorage === 'undefined') return;

    const key = getActiveChatStorageKey(tool);
    if (chatId) {
      localStorage.setItem(key, chatId);
    } else {
      localStorage.removeItem(key);
    }
  };

  const setActiveChat = (chatId: string | null) => {
    activeChatId.value = chatId;
    persistActiveChatId(chatId);
  };

  const loadChats = async () => {
    const records = await getChatsByTool(tool);
    const normalized = records.map((record) => normalizeChatRecord(record, tool));
    chats.value = normalized.map((item) => cloneChat(item.chat));

    await Promise.all(normalized.filter((item) => item.changed).map((item) => putChat(item.chat)));

    const key = getActiveChatStorageKey(tool);
    const preferred = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);

    if (preferred && chats.value.some((chat) => chat.id === preferred)) {
      activeChatId.value = preferred;
    } else {
      activeChatId.value = chats.value[0]?.id ?? null;
    }

    loaded.value = true;
  };

  const createChat = async (title = 'New chat', initialMessages: AiChatMessage[] = []) => {
    const now = Date.now();
    const normalizedMessages = normalizeMessages(initialMessages, now).messages;
    const record: AiChatRecord = {
      id: generateId(),
      tool,
      title,
      createdAt: now,
      updatedAt: now,
      messages: normalizedMessages,
      summaries: []
    };

    chats.value = [record, ...chats.value];
    await putChat(record);
    setActiveChat(record.id);

    return cloneChat(record);
  };

  const selectChat = (chatId: string) => {
    if (!chats.value.some((chat) => chat.id === chatId)) {
      return;
    }
    setActiveChat(chatId);
  };

  const clearActiveChat = () => {
    setActiveChat(null);
  };

  const getChatById = (chatId: string) => {
    const target = chats.value.find((chat) => chat.id === chatId);
    return target ? cloneChat(target) : null;
  };

  const upsertChat = async (chat: AiChatRecord) => {
    const normalized = normalizeChatRecord(chat, tool).chat;
    const current = chats.value.find((item) => item.id === chat.id);
    if (current) {
      chats.value = chats.value.map((item) => {
        if (item.id !== normalized.id) return item;
        return cloneChat(normalized);
      });
    } else {
      chats.value = [cloneChat(normalized), ...chats.value];
    }

    await putChat(normalized);
  };

  const renameChat = async (chatId: string, title: string) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;

    const target = chats.value.find((chat) => chat.id === chatId);
    if (!target) return;

    const next: AiChatRecord = {
      ...target,
      title: normalizedTitle,
      updatedAt: Date.now()
    };

    await upsertChat(next);
  };

  const updateMessages = async (chatId: string, messages: AiChatMessage[]) => {
    const target = chats.value.find((chat) => chat.id === chatId);
    if (!target) return;

    const normalizedMessages = normalizeMessages(messages, target.createdAt).messages;
    const next: AiChatRecord = {
      ...target,
      messages: normalizedMessages,
      summaries: target.summaries,
      updatedAt: Date.now()
    };

    await upsertChat(next);
  };

  const updateSummaries = async (chatId: string, summaries: AiChatSummaryRecord[]) => {
    const target = chats.value.find((chat) => chat.id === chatId);
    if (!target) return;

    const normalizedSummaries = normalizeSummaries(summaries, target.messages.length).summaries;
    const next: AiChatRecord = {
      ...target,
      summaries: normalizedSummaries
    };

    await upsertChat(next);
  };

  const deleteChat = async (chatId: string) => {
    const target = chats.value.find((chat) => chat.id === chatId);
    if (!target) return null;

    chats.value = chats.value.filter((chat) => chat.id !== chatId);
    await deleteChatRecord(chatId);

    if (activeChatId.value === chatId) {
      const next = chatList.value[0] ?? null;
      setActiveChat(next?.id ?? null);
    }

    return cloneChat(target);
  };

  const restoreChat = async (chat: AiChatRecord) => {
    await upsertChat(chat);
  };

  return {
    chats: chatList,
    activeChat,
    activeChatId,
    loaded,
    loadChats,
    createChat,
    selectChat,
    clearActiveChat,
    renameChat,
    updateMessages,
    updateSummaries,
    deleteChat,
    restoreChat,
    getChatById
  };
}
