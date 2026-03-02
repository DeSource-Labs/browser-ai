<template>
  <div class="prompt-api">
    <ChatSidebar
      :chats="chatItems"
      :active-chat-id="activeChatId"
      :disabled="isSidebarDisabled"
      @create="createAndSwitchChat"
      @select="handleSelectChat"
      @rename="handleRenameChat"
      @delete="requestDeleteChat"
    />

    <div class="prompt-api__main">
      <header class="prompt-api__header">
        <div class="prompt-api__heading">
          <h3 class="prompt-api__title">{{ activeChatTitle }}</h3>
          <span
            class="prompt-api__availability"
            :class="{
              'prompt-api__availability--available': availability === 'available',
              'prompt-api__availability--downloadable': availability === 'downloadable',
              'prompt-api__availability--downloading': availability === 'downloading',
              'prompt-api__availability--unavailable': availability === 'unavailable'
            }"
          >
            {{ availability || 'unknown' }}
          </span>
        </div>

        <div class="prompt-api__meta">
          <span>Tokens: {{ tokensUsedLabel }} used / {{ tokensLeftLabel }} left</span>
          <span v-if="contextPartiallyLoaded" class="prompt-api__warning">
            Context partially loaded to fit model quota.
          </span>
        </div>
      </header>

      <ChatHistory :messages="messages" :is-typing="isTyping" :auto-scroll="autoScroll" />

      <PromptInput
        v-model="draft"
        v-model:attachments="attachments"
        :placeholder="placeholder"
        :send-on-enter="sendOnEnter"
        :allow-attachments="allowAttachments"
        :accept="accept"
        :max-attachments="maxAttachments"
        :disabled="isInputDisabled"
        :busy="isTyping"
        @send="handleSend"
        @voice="handleVoice"
      />
    </div>

    <div v-if="showOverflowDialog" class="prompt-api__overlay" role="dialog" aria-modal="true">
      <div class="prompt-api__dialog">
        <h4>Context limit reached</h4>
        <p>
          Browser LLM may truncate older context to continue. You can continue with possible truncation,
          or start a new chat.
        </p>
        <div class="prompt-api__dialog-actions">
          <button type="button" class="prompt-api__button prompt-api__button--primary" @click="continueAfterOverflow">
            Continue
          </button>
          <button type="button" class="prompt-api__button" @click="startNewChatAfterOverflow">
            Start new chat
          </button>
        </div>
      </div>
    </div>

    <div v-if="pendingDeleteChat" class="prompt-api__overlay" role="dialog" aria-modal="true">
      <div class="prompt-api__dialog">
        <h4>Delete chat?</h4>
        <p>
          "{{ pendingDeleteChat.title }}" will be removed. You can undo this action for a few seconds.
        </p>
        <div class="prompt-api__dialog-actions">
          <button type="button" class="prompt-api__button" @click="cancelDeleteChat">
            Cancel
          </button>
          <button type="button" class="prompt-api__button prompt-api__button--danger" @click="confirmDeleteChat">
            Delete
          </button>
        </div>
      </div>
    </div>

    <div v-if="undoState" class="prompt-api__toast" role="status" aria-live="polite">
      <span>Chat deleted.</span>
      <button type="button" class="prompt-api__toast-action" @click="undoDeleteChat">
        Undo
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from './ChatHistory.vue';
import type { PromptAttachment } from './PromptInput.vue';
import type { ChatSidebarItem } from './ChatSidebar.vue';
import type { AiChatMessage, AiChatRecord } from '../composables/useAiChats';

type LLMPromptOptions = Omit<LanguageModelPromptOptions, 'signal'>;
type PromptProcessingState = 'availability' | 'create' | 'measure' | 'prompt' | '';

type PromptOptionsContext = {
  text: string;
  attachments: PromptAttachment[];
  messages: ChatMessage[];
  streaming: boolean;
};

interface Props {
  modelOptions?: LanguageModelCreateCoreOptions;
  autoInit?: boolean;
  autoCreate?: boolean;
  disposeOnUnmount?: boolean;
  streaming?: boolean;
  promptOptions?: LLMPromptOptions | ((context: PromptOptionsContext) => LLMPromptOptions);
  systemPrompt?: string;
  initialMessages?: ChatMessage[];
  maxMessages?: number;
  disabled?: boolean;
  placeholder?: string;
  sendOnEnter?: boolean;
  allowAttachments?: boolean;
  accept?: string;
  maxAttachments?: number;
  clearOnSend?: boolean;
  autoScroll?: boolean;
  notReadyMessage?: string;
  emptyResponseMessage?: string;
  errorMessage?: string | ((error: unknown) => string);
}

const props = withDefaults(defineProps<Props>(), {
  autoInit: true,
  autoCreate: true,
  disposeOnUnmount: true,
  streaming: true,
  systemPrompt: '',
  initialMessages: () => [],
  maxMessages: undefined,
  disabled: false,
  placeholder: 'Ask the assistant... ',
  sendOnEnter: true,
  allowAttachments: true,
  accept: 'image/*',
  maxAttachments: undefined,
  clearOnSend: true,
  autoScroll: true,
  notReadyMessage: 'Model is not ready yet. Please try again in a moment.',
  emptyResponseMessage: 'No response received. Try again.',
  errorMessage: undefined
});

const emit = defineEmits<{
  'init-start': [];
  'init-complete': [];
  'availability-change': [availability: Availability];
  'create-start': [];
  'create-complete': [];
  'ready-change': [ready: boolean];
  'processing-change': [state: PromptProcessingState];
  'download-progress': [progress: number];
  'quota-overflow': [];
  'usage-change': [usage: { inputUsage: number | null; inputQuota: number | null }];
  send: [payload: { text: string; attachments: PromptAttachment[] }];
  'prompt-start': [payload: { streaming: boolean; input: LanguageModelPrompt }];
  'stream-chunk': [payload: { chunk: string; accumulated: string }];
  'prompt-complete': [payload: { response: string; streaming: boolean }];
  interrupt: [];
  error: [error: unknown];
  'message-added': [message: ChatMessage];
  'update:messages': [messages: ChatMessage[]];
  'update:draft': [draft: string];
  'update:attachments': [attachments: PromptAttachment[]];
  clear: [];
}>();

const DEFAULT_CHAT_TITLE = 'New chat';
const TITLE_MAX_WORDS = 6;

const chatStore = useAiChats('prompt-api');
const draft = ref('');
const attachments = ref<PromptAttachment[]>([]);
const messages = ref<ChatMessage[]>([]);

const isHydrating = ref(false);
const isSwitchingChat = ref(false);
const contextPartiallyLoaded = ref(false);

const showOverflowDialog = ref(false);
const pendingDeleteChatId = ref<string | null>(null);
const undoState = ref<{ chat: AiChatRecord } | null>(null);

let titleGenerationQueue = new Set<string>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistPayload: { chatId: string; messages: ChatMessage[] } | null = null;
let undoTimer: ReturnType<typeof setTimeout> | null = null;
let switchVersion = 0;

const {
  availability,
  init,
  create,
  dispose,
  prompt,
  promptStreaming,
  append,
  measureInputUsage,
  isReady,
  processing,
  downloadProgress,
  inputUsage,
  inputQuota,
  interrupt: interruptOperation,
} = usePromptApi({
  onQuotaOverflow: () => {
    showOverflowDialog.value = true;
    emit('quota-overflow');
  }
});

const isTyping = computed(() => processing.value === 'prompt' && !isHydrating.value);
const isSidebarDisabled = computed(() => props.disabled || isTyping.value || isSwitchingChat.value || isHydrating.value);
const isInputDisabled = computed(() => {
  return props.disabled || !isReady.value || isSwitchingChat.value || isHydrating.value;
});

const activeChatId = computed(() => chatStore.activeChatId.value);
const activeChatTitle = computed(() => chatStore.activeChat.value?.title ?? DEFAULT_CHAT_TITLE);
const pendingDeleteChat = computed(() => {
  if (!pendingDeleteChatId.value) return null;
  return chatStore.getChatById(pendingDeleteChatId.value);
});

const tokensUsedLabel = computed(() => {
  return inputUsage.value ?? 0;
});

const tokensLeftLabel = computed(() => {
  if (inputQuota.value == null || inputUsage.value == null) return '—';
  return Math.max(inputQuota.value - inputUsage.value, 0);
});

const chatItems = computed<ChatSidebarItem[]>(() => {
  return chatStore.chats.value.map((chat) => {
    const previewSource = chat.messages[chat.messages.length - 1]?.content || '';
    const preview = previewSource.replace(/\s+/g, ' ').trim().slice(0, 70);
    return {
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
      preview: preview || undefined
    };
  });
});

const generateMessageId = () => {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
};

const normalizeProcessingState = (state: string): PromptProcessingState => {
  if (state === 'new-session') {
    return 'create';
  }
  return state as PromptProcessingState;
};

const resolvePromptOptions = (
  text: string,
  selectedAttachments: PromptAttachment[]
): LLMPromptOptions | undefined => {
  if (typeof props.promptOptions === 'function') {
    return props.promptOptions({
      text,
      attachments: selectedAttachments,
      messages: messages.value,
      streaming: props.streaming
    });
  }
  return props.promptOptions;
};

const resolveErrorMessage = (error: unknown) => {
  if (typeof props.errorMessage === 'function') {
    return props.errorMessage(error);
  }
  if (typeof props.errorMessage === 'string' && props.errorMessage.length > 0) {
    return props.errorMessage;
  }
  return 'Something went wrong while sending your message.';
};

const buildPromptInput = (userContent: string): LanguageModelPrompt => {
  if (!props.systemPrompt.trim()) {
    return userContent;
  }

  return `System instructions:\n${props.systemPrompt.trim()}\n\nUser:\n${userContent}`;
};

const cloneAttachments = (items: PromptAttachment[]) => {
  return items.map((item) => ({ ...item }));
};

const applyMessageLimit = (next: ChatMessage[]) => {
  if (!props.maxMessages || props.maxMessages <= 0) {
    return next;
  }
  return next.slice(-props.maxMessages);
};

const toStoredMessages = (items: ChatMessage[]): AiChatMessage[] => {
  return items.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp ?? Date.now()
  }));
};

const fromStoredMessages = (items: AiChatMessage[]): ChatMessage[] => {
  return items.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp
  }));
};

const queuePersistMessages = (
  chatId: string,
  nextMessages: ChatMessage[],
  immediate = false
) => {
  persistPayload = {
    chatId,
    messages: nextMessages.map((message) => ({ ...message }))
  };

  const flush = () => {
    const payload = persistPayload;
    persistPayload = null;

    if (!payload) return;
    void chatStore.updateMessages(payload.chatId, toStoredMessages(payload.messages));
  };

  if (immediate) {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    flush();
    return;
  }

  if (persistTimer) {
    return;
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    flush();
  }, 250);
};

const setMessages = (
  next: ChatMessage[],
  options: { persist?: boolean; chatId?: string; immediatePersist?: boolean } = {}
) => {
  const { persist = true, chatId = chatStore.activeChatId.value, immediatePersist = false } = options;
  messages.value = applyMessageLimit(next);
  emit('update:messages', messages.value);

  if (persist && chatId) {
    queuePersistMessages(chatId, messages.value, immediatePersist);
  }
};

const addMessage = (
  message: ChatMessage,
  options: { persist?: boolean; chatId?: string; immediatePersist?: boolean } = {}
) => {
  setMessages([...messages.value, message], options);
  emit('message-added', message);
};

const updateMessageContent = (
  messageId: string,
  content: string,
  options: { persist?: boolean; chatId?: string; immediatePersist?: boolean } = {}
) => {
  const next = messages.value.map((message) => {
    if (message.id !== messageId) {
      return message;
    }
    return {
      ...message,
      content
    };
  });

  setMessages(next, options);
};

const interruptPrompt = () => {
  interruptOperation();
  emit('interrupt');
};

const clearConversation = () => {
  setMessages([], { immediatePersist: true });
  emit('clear');
};

const runInit = async () => {
  emit('init-start');
  try {
    if (props.modelOptions) {
      await init(props.modelOptions);
    } else {
      await init();
    }
    emit('init-complete');
  } catch (error) {
    emit('error', error);
    throw error;
  }
};

const runCreate = async () => {
  emit('create-start');
  try {
    await create();
    emit('create-complete');
  } catch (error) {
    emit('error', error);
    throw error;
  }
};

const pickMessagesForHydration = async (history: LanguageModelMessage[]) => {
  const quota = inputQuota.value;
  const budget = quota ? Math.floor(quota * 0.88) : null;

  let selected: LanguageModelMessage[] = [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const candidate = [history[index], ...selected] as LanguageModelMessage[];

    if (!budget) {
      selected = candidate;
      continue;
    }

    try {
      const usage = await measureInputUsage(candidate);
      if (usage <= budget || selected.length === 0) {
        selected = candidate;
      } else {
        break;
      }
    } catch {
      selected = candidate;
    }
  }

  return selected;
};

const hydrateSessionFromMessages = async (historyMessages: ChatMessage[], currentSwitchVersion: number) => {
  const mapped = historyMessages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content
    })) as LanguageModelMessage[];

  if (mapped.length === 0) {
    contextPartiallyLoaded.value = false;
    return;
  }

  isHydrating.value = true;

  try {
    const selected = await pickMessagesForHydration(mapped);
    if (currentSwitchVersion !== switchVersion) return;

    if (selected.length > 0) {
      await append(selected);
    }

    contextPartiallyLoaded.value = selected.length < mapped.length;
  } catch (error) {
    emit('error', error);
  } finally {
    if (currentSwitchVersion === switchVersion) {
      isHydrating.value = false;
    }
  }
};

const switchToChat = async (chatId: string) => {
  const target = chatStore.getChatById(chatId);
  if (!target) return;

  switchVersion += 1;
  const currentSwitchVersion = switchVersion;

  if (processing.value === 'prompt') {
    interruptPrompt();
  }

  isSwitchingChat.value = true;
  isHydrating.value = false;
  contextPartiallyLoaded.value = false;

  chatStore.selectChat(chatId);

  draft.value = '';
  attachments.value = [];
  setMessages(fromStoredMessages(target.messages), { persist: false });

  try {
    await runInit();
    if (currentSwitchVersion !== switchVersion) return;

    await runCreate();
    if (currentSwitchVersion !== switchVersion) return;

    await hydrateSessionFromMessages(messages.value, currentSwitchVersion);
  } catch {
    // Errors are already emitted
  } finally {
    if (currentSwitchVersion === switchVersion) {
      isSwitchingChat.value = false;
    }
  }
};

const createAndSwitchChat = async () => {
  const created = await chatStore.createChat(DEFAULT_CHAT_TITLE);
  await switchToChat(created.id);
};

const handleSelectChat = async (chatId: string) => {
  if (chatStore.activeChatId.value === chatId) {
    return;
  }
  await switchToChat(chatId);
};

const requestDeleteChat = (chatId: string) => {
  pendingDeleteChatId.value = chatId;
};

const cancelDeleteChat = () => {
  pendingDeleteChatId.value = null;
};

const showUndoToast = (chat: AiChatRecord) => {
  undoState.value = { chat };

  if (undoTimer) {
    clearTimeout(undoTimer);
  }

  undoTimer = setTimeout(() => {
    undoState.value = null;
    undoTimer = null;
  }, 5000);
};

const confirmDeleteChat = async () => {
  if (!pendingDeleteChatId.value) return;

  const wasActiveChat = chatStore.activeChatId.value === pendingDeleteChatId.value;
  const removed = await chatStore.deleteChat(pendingDeleteChatId.value);
  pendingDeleteChatId.value = null;

  if (!removed) return;

  showUndoToast(removed);

  if (!wasActiveChat) {
    return;
  }

  if (chatStore.activeChatId.value) {
    await switchToChat(chatStore.activeChatId.value);
  } else {
    await createAndSwitchChat();
  }
};

const undoDeleteChat = async () => {
  if (!undoState.value) return;

  const chat = undoState.value.chat;
  undoState.value = null;

  if (undoTimer) {
    clearTimeout(undoTimer);
    undoTimer = null;
  }

  await chatStore.restoreChat(chat);
  await switchToChat(chat.id);
};

const sanitizeGeneratedTitle = (rawTitle: string, fallback: string) => {
  const normalized = rawTitle
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();

  if (!normalized) {
    return fallback;
  }

  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0) {
    return fallback;
  }

  return words.slice(0, TITLE_MAX_WORDS).join(' ');
};

const fallbackTitleFromPrompt = (input: string) => {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return DEFAULT_CHAT_TITLE;
  }

  return normalized
    .split(' ')
    .slice(0, TITLE_MAX_WORDS)
    .join(' ');
};

const generateChatTitle = async (firstPrompt: string) => {
  const fallback = fallbackTitleFromPrompt(firstPrompt);

  if (typeof LanguageModel?.availability !== 'function' || typeof LanguageModel?.create !== 'function') {
    return fallback;
  }

  try {
    const status = await LanguageModel.availability(props.modelOptions ?? {});
    if (status === 'unavailable') {
      return fallback;
    }

    const titleSession = await LanguageModel.create(props.modelOptions ?? {});

    try {
      const title = await titleSession.prompt(
        [
          {
            role: 'assistant',
            content: 'Create a concise chat title in the same language as the input. Use 4 to 6 words. Return only the title text.'
          },
          {
            role: 'user',
            content: firstPrompt
          }
        ]
      );

      return sanitizeGeneratedTitle(title, fallback);
    } finally {
      titleSession.destroy();
    }
  } catch {
    return fallback;
  }
};

const maybeGenerateTitleForChat = (chatId: string, promptText: string) => {
  if (titleGenerationQueue.has(chatId)) {
    return;
  }

  const target = chatStore.getChatById(chatId);
  if (!target || target.title !== DEFAULT_CHAT_TITLE) {
    return;
  }

  titleGenerationQueue.add(chatId);

  void (async () => {
    const generated = await generateChatTitle(promptText);
    titleGenerationQueue.delete(chatId);

    const current = chatStore.getChatById(chatId);
    if (!current || current.title !== DEFAULT_CHAT_TITLE) {
      return;
    }

    await chatStore.renameChat(chatId, generated);
  })();
};

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  if (error instanceof Error) {
    return error.name === 'AbortError';
  }
  return false;
};

const handleSend = async () => {
  if (props.disabled) {
    return;
  }

  const text = draft.value.trim();
  if (!text && attachments.value.length === 0) return;

  const activeChatId = chatStore.activeChatId.value;
  if (!activeChatId) {
    await createAndSwitchChat();
  }

  const currentChatId = chatStore.activeChatId.value;
  if (!currentChatId) return;

  const selectedAttachments = cloneAttachments(attachments.value);
  emit('send', { text, attachments: selectedAttachments });

  const userMessage: ChatMessage = {
    id: generateMessageId(),
    role: 'user',
    content: text || 'Describe the attached image.',
    timestamp: Date.now()
  };

  addMessage(userMessage, { chatId: currentChatId });

  const userMessageCount = messages.value.filter((message) => message.role === 'user').length;
  if (userMessageCount === 1) {
    maybeGenerateTitleForChat(currentChatId, userMessage.content);
  }

  if (props.clearOnSend) {
    draft.value = '';
    attachments.value = [];
  }

  if (!isReady.value) {
    addMessage({
      id: generateMessageId(),
      role: 'assistant',
      content: props.notReadyMessage,
      timestamp: Date.now()
    }, {
      persist: false
    });
    return;
  }

  const input = buildPromptInput(userMessage.content);
  const options = resolvePromptOptions(text, selectedAttachments);
  emit('prompt-start', {
    streaming: props.streaming,
    input
  });

  try {
    if (props.streaming) {
      const assistantMessageId = generateMessageId();
      addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }, {
        chatId: currentChatId
      });

      const stream = promptStreaming(input, options);
      const reader = stream.getReader();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += value;
        updateMessageContent(assistantMessageId, accumulated, {
          chatId: currentChatId
        });

        emit('stream-chunk', {
          chunk: value,
          accumulated
        });
      }

      const response = accumulated || props.emptyResponseMessage;
      if (!accumulated) {
        updateMessageContent(assistantMessageId, response, {
          chatId: currentChatId,
          immediatePersist: true
        });
      } else {
        queuePersistMessages(currentChatId, messages.value, true);
      }

      emit('prompt-complete', {
        response,
        streaming: true
      });
      return;
    }

    const response = await prompt(input, options);
    const output = response || props.emptyResponseMessage;

    addMessage({
      id: generateMessageId(),
      role: 'assistant',
      content: output,
      timestamp: Date.now()
    }, {
      chatId: currentChatId,
      immediatePersist: true
    });

    emit('prompt-complete', {
      response: output,
      streaming: false
    });
  } catch (error) {
    if (isAbortError(error)) {
      emit('interrupt');
      return;
    }

    addMessage({
      id: generateMessageId(),
      role: 'assistant',
      content: resolveErrorMessage(error),
      timestamp: Date.now()
    }, {
      persist: false
    });

    emit('error', error);
  }
};

const handleVoice = () => {
  addMessage({
    id: generateMessageId(),
    role: 'assistant',
    content: 'Voice input is not wired yet, but the UI is ready.',
    timestamp: Date.now()
  }, {
    persist: false
  });
};

const handleRenameChat = async (chatId: string) => {
  const target = chatStore.getChatById(chatId);
  if (!target) return;

  const nextTitle = typeof window !== 'undefined'
    ? window.prompt('Rename chat', target.title)
    : target.title;

  if (nextTitle === null) return;

  await chatStore.renameChat(chatId, nextTitle);
};

const continueAfterOverflow = () => {
  showOverflowDialog.value = false;
};

const startNewChatAfterOverflow = async () => {
  showOverflowDialog.value = false;
  await createAndSwitchChat();
};

watch(draft, (value) => {
  emit('update:draft', value);
}, { immediate: true });

watch(attachments, (value) => {
  emit('update:attachments', cloneAttachments(value));
}, { deep: true, immediate: true });

watch(availability, (value) => {
  if (!value) return;
  emit('availability-change', value);
}, { immediate: true });

watch(isReady, (value) => {
  emit('ready-change', value);
}, { immediate: true });

watch(processing, (value) => {
  emit('processing-change', normalizeProcessingState(value));
}, { immediate: true });

watch(downloadProgress, (value) => {
  emit('download-progress', value);
}, { immediate: true });

watch([inputUsage, inputQuota], ([usage, quota]) => {
  emit('usage-change', {
    inputUsage: usage,
    inputQuota: quota
  });
}, { immediate: true });

onMounted(async () => {
  emit('update:messages', messages.value);

  await chatStore.loadChats();

  let targetChat = chatStore.activeChat.value;
  if (!targetChat) {
    targetChat = await chatStore.createChat(
      DEFAULT_CHAT_TITLE,
      toStoredMessages(props.initialMessages)
    );
  }

  await switchToChat(targetChat.id);
});

onBeforeUnmount(() => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  if (undoTimer) {
    clearTimeout(undoTimer);
    undoTimer = null;
  }

  if (persistPayload) {
    const payload = persistPayload;
    persistPayload = null;
    void chatStore.updateMessages(payload.chatId, toStoredMessages(payload.messages));
  }

  if (!props.disposeOnUnmount) {
    return;
  }

  if (processing.value === 'prompt') {
    interruptPrompt();
  }

  dispose();
});

defineExpose({
  init: runInit,
  create: runCreate,
  clear: clearConversation,
  interrupt: interruptPrompt,
  dispose,
  send: handleSend,
  createChat: createAndSwitchChat,
  selectChat: switchToChat
});
</script>

<style scoped lang="scss">
.prompt-api {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0.75rem;
  overflow: hidden;
  height: 100%;
  pointer-events: auto;
  position: relative;
}

.prompt-api__main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.prompt-api__header {
  border-radius: 0.9rem;
  border: 1px solid rgba(120, 120, 120, 0.24);
  background: rgba(20, 20, 20, 0.35);
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.prompt-api__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.prompt-api__title {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.2;
  color: var(--color-primary);
  font-weight: 600;
}

.prompt-api__availability {
  font-size: 0.74rem;
  line-height: 1;
  padding: 0.3rem 0.45rem;
  border-radius: 999px;
  border: 1px solid rgba(120, 120, 120, 0.35);
  text-transform: capitalize;
}

.prompt-api__availability--available {
  background: rgba(34, 197, 94, 0.15);
  color: rgba(134, 239, 172, 1);
  border-color: rgba(34, 197, 94, 0.3);
}

.prompt-api__availability--downloadable {
  background: rgba(59, 130, 246, 0.15);
  color: rgba(147, 197, 253, 1);
  border-color: rgba(59, 130, 246, 0.3);
}

.prompt-api__availability--downloading {
  background: rgba(251, 146, 60, 0.15);
  color: rgba(254, 215, 170, 1);
  border-color: rgba(251, 146, 60, 0.3);
}

.prompt-api__availability--unavailable {
  background: rgba(239, 68, 68, 0.15);
  color: rgba(252, 165, 165, 1);
  border-color: rgba(239, 68, 68, 0.3);
}

.prompt-api__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
  color: var(--color-secondary);
  font-size: 0.78rem;
}

.prompt-api__warning {
  color: rgba(253, 224, 71, 0.95);
}

.prompt-api__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 20;
}

.prompt-api__dialog {
  width: min(480px, 100%);
  border-radius: 0.9rem;
  border: 1px solid rgba(120, 120, 120, 0.35);
  background: rgba(20, 20, 20, 0.95);
  padding: 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.prompt-api__dialog h4 {
  margin: 0;
  font-size: 0.95rem;
}

.prompt-api__dialog p {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--color-secondary);
}

.prompt-api__dialog-actions {
  display: flex;
  gap: 0.55rem;
  justify-content: flex-end;
}

.prompt-api__button {
  border: 1px solid rgba(120, 120, 120, 0.35);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-primary);
  border-radius: 0.6rem;
  padding: 0.45rem 0.65rem;
  cursor: pointer;
}

.prompt-api__button--primary {
  background: rgba(120, 120, 120, 0.35);
}

.prompt-api__button--danger {
  border-color: rgba(239, 68, 68, 0.5);
  color: rgba(252, 165, 165, 1);
}

.prompt-api__toast {
  position: absolute;
  bottom: 0.9rem;
  right: 0.9rem;
  border-radius: 0.65rem;
  border: 1px solid rgba(120, 120, 120, 0.35);
  background: rgba(20, 20, 20, 0.95);
  padding: 0.55rem 0.7rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8rem;
  z-index: 30;
}

.prompt-api__toast-action {
  border: none;
  background: transparent;
  color: rgba(147, 197, 253, 1);
  text-decoration: underline;
  cursor: pointer;
}

@media (max-width: 900px) {
  .prompt-api {
    flex-direction: column;
  }

  .prompt-api__main {
    min-height: 320px;
  }
}
</style>
