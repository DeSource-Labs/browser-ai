export type AiChatTool = string;

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AiChatRecord {
  id: string;
  tool: AiChatTool;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AiChatMessage[];
}

const DB_NAME = 'browser-ai-demo';
const DB_VERSION = 1;
const CHATS_STORE = 'chats';

const inMemoryChats = new Map<string, AiChatRecord>();
let dbPromise: Promise<IDBDatabase> | null = null;

const canUseIndexedDB = () => {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
};

const cloneMessage = (message: AiChatMessage): AiChatMessage => ({ ...message });

const cloneChat = (chat: AiChatRecord): AiChatRecord => ({
  ...chat,
  messages: chat.messages.map(cloneMessage)
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
  const items = await requestToPromise(index.getAll(tool)) as AiChatRecord[];
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
    chats.value = records;

    const key = getActiveChatStorageKey(tool);
    const preferred = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);

    if (preferred && records.some((chat) => chat.id === preferred)) {
      activeChatId.value = preferred;
    } else {
      activeChatId.value = records[0]?.id ?? null;
    }

    loaded.value = true;
  };

  const createChat = async (title = 'New chat', initialMessages: AiChatMessage[] = []) => {
    const now = Date.now();
    const record: AiChatRecord = {
      id: generateId(),
      tool,
      title,
      createdAt: now,
      updatedAt: now,
      messages: initialMessages.map(cloneMessage)
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

  const getChatById = (chatId: string) => {
    const target = chats.value.find((chat) => chat.id === chatId);
    return target ? cloneChat(target) : null;
  };

  const upsertChat = async (chat: AiChatRecord) => {
    const current = chats.value.find((item) => item.id === chat.id);
    if (current) {
      chats.value = chats.value.map((item) => {
        if (item.id !== chat.id) return item;
        return cloneChat(chat);
      });
    } else {
      chats.value = [cloneChat(chat), ...chats.value];
    }

    await putChat(chat);
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

    const next: AiChatRecord = {
      ...target,
      messages: messages.map(cloneMessage),
      updatedAt: Date.now()
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
    renameChat,
    updateMessages,
    deleteChat,
    restoreChat,
    getChatById,
  };
}
