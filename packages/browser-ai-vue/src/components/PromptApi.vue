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
              'prompt-api__availability--available':
                availability === 'available',
              'prompt-api__availability--downloadable':
                availability === 'downloadable',
              'prompt-api__availability--downloading':
                availability === 'downloading',
              'prompt-api__availability--unavailable':
                availability === 'unavailable',
            }"
          >
            {{ availability || "unknown" }}
          </span>
        </div>

        <div class="prompt-api__meta">
          <span>
            Tokens: {{ tokensUsedLabel }} used / {{ tokensLeftLabel }} left
          </span>
          <div
            v-if="isContextLoading"
            class="prompt-api__header-loader"
            role="status"
            aria-live="polite"
            :aria-label="contextLoadingDescription"
          >
            <div class="prompt-api__header-loader-heading">
              <span>{{ contextLoadingTitle }}</span>
              <span>{{ contextLoadProgressLabel }}</span>
            </div>
            <div class="prompt-api__header-loader-bar" aria-hidden="true">
              <span :style="{ width: `${contextLoadProgress}%` }"></span>
            </div>
          </div>
          <span v-if="contextPartiallyLoaded" class="prompt-api__warning">
            {{ contextFitLabel }}
          </span>
        </div>
      </header>

      <ChatHistory
        :messages="messages"
        :is-typing="isTyping"
        :auto-scroll="autoScroll"
      />

      <PromptInput
        v-model="draft"
        v-model:attachments="attachments"
        :placeholder="inputPlaceholder"
        :send-on-enter="sendOnEnter"
        :allow-attachments="allowAttachments"
        :allow-voice="allowVoice"
        :accept="accept"
        :max-attachments="maxAttachments"
        :disabled="isInputDisabled"
        :busy="isTyping"
        @send="handleSend"
        @voice="handleVoice"
      />
    </div>

    <div
      v-if="pendingDeleteChat"
      class="prompt-api__overlay"
      role="dialog"
      aria-modal="true"
    >
      <div class="prompt-api__dialog">
        <h4>Delete chat?</h4>
        <p>
          "{{ pendingDeleteChat.title }}" will be removed. You can undo this
          action for a few seconds.
        </p>
        <div class="prompt-api__dialog-actions">
          <button
            type="button"
            class="prompt-api__button"
            @click="cancelDeleteChat"
          >
            Cancel
          </button>
          <button
            type="button"
            class="prompt-api__button prompt-api__button--danger"
            @click="confirmDeleteChat"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="undoState"
      class="prompt-api__toast"
      role="status"
      aria-live="polite"
    >
      <span>Chat deleted.</span>
      <button
        type="button"
        class="prompt-api__toast-action"
        @click="undoDeleteChat"
      >
        Undo
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ChatHistory from "./ChatHistory.vue";
import PromptInput from "./PromptInput.vue";
import ChatSidebar from "./ChatSidebar.vue";
import type { ChatMessage } from "./ChatHistory.vue";
import type { PromptAttachment } from "./PromptInput.vue";
import type { ChatSidebarItem } from "./ChatSidebar.vue";
import type { AiChatMessage, AiChatRecord } from "../composables/useAiChats";
import { useAiChats } from "../composables/useAiChats";
import {
  usePromptApi,
  type LLMContextRestoreState,
  type LLMContextSummaryMode,
  type LLMContextStrategy,
  type LLMRestoreSessionOptions,
} from "../composables/usePromptApi";

type LLMPromptOptions = Omit<LanguageModelPromptOptions, "signal">;
type PromptProcessingState =
  "availability" | "create" | "measure" | "prompt" | "";

type PromptOptionsContext = {
  text: string;
  attachments: PromptAttachment[];
  messages: ChatMessage[];
  streaming: boolean;
};

type RestoreSessionOverrides = Partial<
  Pick<
    LLMRestoreSessionOptions,
    | "autoCreate"
    | "strategy"
    | "summaryMode"
    | "budgetRatio"
    | "summaryChunkBudgetRatio"
    | "summaryMaxCharacters"
    | "summaryTimeoutMs"
    | "summaryBackgroundTimeoutMs"
  >
>;

interface Props {
  modelOptions?: LanguageModelCreateCoreOptions;
  autoInit?: boolean;
  autoCreate?: boolean;
  disposeOnUnmount?: boolean;
  streaming?: boolean;
  promptOptions?:
    LLMPromptOptions | ((context: PromptOptionsContext) => LLMPromptOptions);
  systemPrompt?: string;
  initialMessages?: ChatMessage[];
  maxMessages?: number;
  disabled?: boolean;
  placeholder?: string;
  sendOnEnter?: boolean;
  allowAttachments?: boolean;
  allowVoice?: boolean;
  accept?: string;
  maxAttachments?: number;
  clearOnSend?: boolean;
  autoScroll?: boolean;
  notReadyMessage?: string;
  emptyResponseMessage?: string;
  errorMessage?: string | ((error: unknown) => string);
  contextStrategy?: LLMContextStrategy;
  contextSummaryMode?: LLMContextSummaryMode;
  contextBudgetRatio?: number;
  contextSummaryChunkBudgetRatio?: number;
  contextSummaryMaxCharacters?: number;
  contextSummaryTimeoutMs?: number;
  contextSummaryBackgroundTimeoutMs?: number;
  autoCompactContext?: boolean;
  contextCompactionThresholdRatio?: number;
  contextCompactionSummaryMode?: LLMContextSummaryMode;
  contextLoadingMessage?: string;
}

const props = withDefaults(defineProps<Props>(), {
  autoInit: true,
  autoCreate: true,
  disposeOnUnmount: true,
  streaming: true,
  systemPrompt: "",
  initialMessages: () => [],
  maxMessages: undefined,
  disabled: false,
  placeholder: "Ask the assistant... ",
  sendOnEnter: true,
  allowAttachments: false,
  allowVoice: false,
  accept: "image/*",
  maxAttachments: undefined,
  clearOnSend: true,
  autoScroll: true,
  notReadyMessage: "Model is not ready yet. Please try again in a moment.",
  emptyResponseMessage: "No response received. Try again.",
  errorMessage: undefined,
  contextStrategy: "summarize",
  contextSummaryMode: "cache-first",
  contextBudgetRatio: 0.88,
  contextSummaryChunkBudgetRatio: 0.18,
  contextSummaryMaxCharacters: 0,
  contextSummaryTimeoutMs: 15000,
  contextSummaryBackgroundTimeoutMs: 60000,
  autoCompactContext: true,
  contextCompactionThresholdRatio: 0.22,
  contextCompactionSummaryMode: "eager",
  contextLoadingMessage:
    "Restoring previous messages for the local AI session...",
});

const emit = defineEmits<{
  "init-start": [];
  "init-complete": [];
  "availability-change": [availability: Availability];
  "create-start": [];
  "create-complete": [];
  "ready-change": [ready: boolean];
  "processing-change": [state: PromptProcessingState];
  "download-progress": [progress: number];
  "context-overflow": [];
  "context-load-start": [state: LLMContextRestoreState];
  "context-load-progress": [state: LLMContextRestoreState];
  "context-load-complete": [state: LLMContextRestoreState];
  "summary-cache-error": [error: unknown];
  "usage-change": [
    usage: {
      contextUsage: number | null;
      contextWindow: number | null;
      contextWindowAvailable: number | null;
    },
  ];
  send: [payload: { text: string; attachments: PromptAttachment[] }];
  voice: [];
  "prompt-start": [payload: { streaming: boolean; input: LanguageModelPrompt }];
  "stream-chunk": [payload: { chunk: string; accumulated: string }];
  "prompt-complete": [payload: { response: string; streaming: boolean }];
  interrupt: [];
  error: [error: unknown];
  "message-added": [message: ChatMessage];
  "update:messages": [messages: ChatMessage[]];
  "update:draft": [draft: string];
  "update:attachments": [attachments: PromptAttachment[]];
  clear: [];
}>();

const DEFAULT_CHAT_TITLE = "New chat";
const TITLE_MAX_WORDS = 6;

const chatStore = useAiChats("prompt-api");
const draft = ref("");
const attachments = ref<PromptAttachment[]>([]);
const messages = ref<ChatMessage[]>([]);

const isHydrating = ref(false);
const isSwitchingChat = ref(false);
const contextPartiallyLoaded = ref(false);
const contextOverflowPending = ref(false);
const isCompactingContext = ref(false);
const isAssistantPending = ref(false);
const lastContextUsage = ref<number | null>(null);
const lastContextWindowAvailable = ref<number | null>(null);
const contextLoadState = ref<LLMContextRestoreState>({
  phase: "idle",
  loadedMessages: 0,
  totalMessages: 0,
  summarizedMessages: 0,
  includedMessages: 0,
  measuredTokens: null,
  cachedSummaries: 0,
  createdSummaries: 0,
  summaryChunks: 0,
});

const pendingDeleteChatId = ref<string | null>(null);
const undoState = ref<{ chat: AiChatRecord } | null>(null);

let titleGenerationQueue = new Set<string>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistPayload: { chatId: string; messages: ChatMessage[] } | null = null;
let undoTimer: ReturnType<typeof setTimeout> | null = null;
let switchVersion = 0;
let lastAutoCompactMessageCount = 0;

const {
  availability,
  init,
  create,
  dispose,
  prompt,
  promptStreaming,
  promptWithTemporarySession,
  restoreSession,
  checkAvailability,
  isReady,
  processing,
  downloadProgress,
  contextUsage,
  contextWindow,
  contextWindowAvailable,
  interrupt: interruptOperation,
} = usePromptApi({
  onContextOverflow: () => {
    contextOverflowPending.value = true;
    emit("context-overflow");
  },
});

const isTyping = computed(
  () =>
    isAssistantPending.value ||
    (processing.value === "prompt" && !isHydrating.value),
);
const isSidebarDisabled = computed(
  () =>
    props.disabled ||
    isTyping.value ||
    isSwitchingChat.value ||
    isHydrating.value,
);
const isInputDisabled = computed(() => {
  return (
    props.disabled ||
    isSwitchingChat.value ||
    isHydrating.value ||
    processing.value === "create" ||
    availability.value === "unavailable"
  );
});
const isContextLoading = computed(() => {
  return (
    isHydrating.value &&
    contextLoadState.value.phase !== "idle" &&
    contextLoadState.value.phase !== "ready"
  );
});

const inputPlaceholder = computed(() => {
  if (isCompactingContext.value) {
    return "Compressing chat context...";
  }

  if (isContextLoading.value) {
    return "Restoring chat context...";
  }

  return props.placeholder;
});

const activeChatId = computed(() => chatStore.activeChatId.value);
const activeChatTitle = computed(
  () => chatStore.activeChat.value?.title ?? DEFAULT_CHAT_TITLE,
);
const pendingDeleteChat = computed(() => {
  if (!pendingDeleteChatId.value) return null;
  return chatStore.getChatById(pendingDeleteChatId.value);
});

const tokensUsedLabel = computed(() => {
  if (isHydrating.value || isCompactingContext.value) {
    return lastContextUsage.value ?? "—";
  }

  return contextUsage.value ?? lastContextUsage.value ?? 0;
});

const tokensLeftLabel = computed(() => {
  if (isHydrating.value || isCompactingContext.value) {
    return lastContextWindowAvailable.value ?? "—";
  }

  return (
    contextWindowAvailable.value ?? lastContextWindowAvailable.value ?? "—"
  );
});

const contextLoadProgress = computed(() => {
  const total = contextLoadState.value.totalMessages;
  if (!isContextLoading.value) return 0;
  if (total <= 0) return contextLoadState.value.phase === "creating" ? 70 : 35;

  const baseProgress = Math.round(
    (contextLoadState.value.loadedMessages / total) * 100,
  );
  if (contextLoadState.value.phase === "summarizing") {
    return Math.min(Math.max(baseProgress, 55), 85);
  }
  if (contextLoadState.value.phase === "restoring") {
    return 92;
  }

  return Math.min(baseProgress, 95);
});

const contextLoadProgressLabel = computed(() => {
  const total = contextLoadState.value.totalMessages;
  if (total <= 0) {
    return contextLoadState.value.phase === "creating"
      ? "Starting"
      : "Checking";
  }

  return `${Math.min(contextLoadState.value.loadedMessages, total)} / ${total}`;
});

const contextLoadingTitle = computed(() => {
  if (isCompactingContext.value) {
    return "Compressing chat context";
  }

  if (contextLoadState.value.phase === "summarizing") {
    return "Summarizing older messages";
  }
  if (contextLoadState.value.phase === "restoring") {
    return "Starting local AI session";
  }
  if (contextLoadState.value.phase === "measuring") {
    return "Fitting chat history";
  }
  if (contextLoadState.value.phase === "creating") {
    return "Preparing local AI";
  }
  return "Restoring chat context";
});

const contextLoadingDescription = computed(() => {
  if (isCompactingContext.value) {
    return "Compressing older turns into a fresh local AI session so future prompts keep more useful context.";
  }

  if (contextLoadState.value.phase === "summarizing") {
    return "Older messages are being compressed into a short memory so the latest turns stay available.";
  }
  if (contextLoadState.value.phase === "measuring") {
    return "Checking how much of this chat fits in the browser model context window.";
  }
  if (contextLoadState.value.phase === "restoring") {
    return "Loading the selected history into a fresh local browser AI session.";
  }
  return props.contextLoadingMessage;
});

const contextFitLabel = computed(() => {
  if (contextLoadState.value.summarizedMessages > 0) {
    return `${contextLoadState.value.summarizedMessages} older messages summarized to fit context.`;
  }

  return "Older context trimmed to fit the model window.";
});

const chatItems = computed<ChatSidebarItem[]>(() => {
  return chatStore.chats.value.map((chat) => {
    const previewSource =
      chat.messages[chat.messages.length - 1]?.content || "";
    const preview = previewSource.replace(/\s+/g, " ").trim().slice(0, 70);
    return {
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
      preview: preview || undefined,
    };
  });
});

const generateMessageId = () => {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
};

const normalizeProcessingState = (state: string): PromptProcessingState => {
  if (state === "new-session") {
    return "create";
  }
  return state as PromptProcessingState;
};

const resolvePromptOptions = (
  text: string,
  selectedAttachments: PromptAttachment[],
): LLMPromptOptions | undefined => {
  if (typeof props.promptOptions === "function") {
    return props.promptOptions({
      text,
      attachments: selectedAttachments,
      messages: messages.value,
      streaming: props.streaming,
    });
  }
  return props.promptOptions;
};

const resolveErrorMessage = (error: unknown) => {
  if (typeof props.errorMessage === "function") {
    return props.errorMessage(error);
  }
  if (typeof props.errorMessage === "string" && props.errorMessage.length > 0) {
    return props.errorMessage;
  }
  return "Something went wrong while sending your message.";
};

const hasExpectedInputType = (
  expectedInputs: LanguageModelCreateCoreOptions["expectedInputs"],
  type: LanguageModelMessageType,
) => {
  return expectedInputs?.some((item) => item.type === type) ?? false;
};

const resolveModelOptions = (): LanguageModelCreateCoreOptions => {
  const options: LanguageModelCreateCoreOptions = {
    ...(props.modelOptions ?? {}),
  };

  if (
    props.allowAttachments &&
    !hasExpectedInputType(options.expectedInputs, "image")
  ) {
    options.expectedInputs = [
      ...(options.expectedInputs ?? [{ type: "text" }]),
      { type: "image" },
    ];
  }

  return options;
};

const buildPromptInput = async (
  userContent: string,
  selectedAttachments: PromptAttachment[],
): Promise<LanguageModelPrompt> => {
  if (!selectedAttachments.length) {
    return userContent;
  }

  const content: LanguageModelMessageContent[] = [
    {
      type: "text",
      value: userContent || "Describe the attached image.",
    },
    ...selectedAttachments
      .filter((attachment) => attachment.type.startsWith("image/"))
      .map((attachment) => ({
        type: "image" as const,
        value: attachment.file,
      })),
  ];

  return [
    {
      role: "user",
      content,
    },
  ];
};

const cloneAttachments = (items: PromptAttachment[]) => {
  return items.map((item) => ({ ...item }));
};

const createMessageAttachments = (
  items: PromptAttachment[],
): ChatMessage["attachments"] => {
  return items.map((item) => ({
    id: generateMessageId(),
    url: URL.createObjectURL(item.file),
    name: item.name,
    type: item.type,
  }));
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
    timestamp: message.timestamp ?? Date.now(),
  }));
};

const fromStoredMessages = (items: AiChatMessage[]): ChatMessage[] => {
  return items.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  }));
};

const queuePersistMessages = (
  chatId: string,
  nextMessages: ChatMessage[],
  immediate = false,
) => {
  persistPayload = {
    chatId,
    messages: nextMessages.map((message) => ({ ...message })),
  };

  const flush = () => {
    const payload = persistPayload;
    persistPayload = null;

    if (!payload) return;
    void chatStore.updateMessages(
      payload.chatId,
      toStoredMessages(payload.messages),
    );
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
  options: {
    persist?: boolean;
    chatId?: string;
    immediatePersist?: boolean;
  } = {},
) => {
  const {
    persist = true,
    chatId = chatStore.activeChatId.value,
    immediatePersist = false,
  } = options;
  messages.value = applyMessageLimit(next);
  emit("update:messages", messages.value);

  if (persist && chatId) {
    queuePersistMessages(chatId, messages.value, immediatePersist);
  }
};

const addMessage = (
  message: ChatMessage,
  options: {
    persist?: boolean;
    chatId?: string;
    immediatePersist?: boolean;
  } = {},
) => {
  setMessages([...messages.value, message], options);
  emit("message-added", message);
};

const updateMessageContent = (
  messageId: string,
  content: string,
  options: {
    persist?: boolean;
    chatId?: string;
    immediatePersist?: boolean;
  } = {},
) => {
  const next = messages.value.map((message) => {
    if (message.id !== messageId) {
      return message;
    }
    return {
      ...message,
      content,
    };
  });

  setMessages(next, options);
};

const interruptPrompt = () => {
  isAssistantPending.value = false;
  interruptOperation();
  emit("interrupt");
};

const clearConversation = () => {
  setMessages([], { immediatePersist: true });
  emit("clear");
};

const runInit = async () => {
  emit("init-start");
  try {
    await init(resolveModelOptions());
    emit("init-complete");
  } catch (error) {
    emit("error", error);
    throw error;
  }
};

const runCreate = async (
  createOptions: {
    initialPrompts?: LanguageModelCreateOptions["initialPrompts"];
  } = {},
) => {
  emit("create-start");
  try {
    await create(createOptions);
    emit("create-complete");
  } catch (error) {
    emit("error", error);
    throw error;
  }
};

const cloneContextLoadState = (): LLMContextRestoreState => ({
  ...contextLoadState.value,
});

const setContextLoadState = (
  patch: Partial<LLMContextRestoreState>,
  event: "start" | "progress" | "complete" | null = "progress",
) => {
  contextLoadState.value = {
    ...contextLoadState.value,
    ...patch,
  };

  const payload = cloneContextLoadState();
  if (event === "start") {
    emit("context-load-start", payload);
  } else if (event === "complete") {
    emit("context-load-complete", payload);
  } else if (event === "progress") {
    emit("context-load-progress", payload);
  }
};

const buildInitialPrompts = (historyMessages: ChatMessage[]) => {
  const initialPrompts: Array<
    LanguageModelSystemMessage | LanguageModelMessage
  > = [];
  const systemPrompt = props.systemPrompt.trim();

  if (systemPrompt) {
    initialPrompts.push({
      role: "system",
      content: systemPrompt,
    });
  }

  historyMessages
    .filter((message) => message.content.trim().length > 0)
    .forEach((message) => {
      initialPrompts.push({
        role: message.role,
        content: message.content,
      });
    });

  return initialPrompts;
};

const buildMessageMetadata = (historyMessages: ChatMessage[]) => {
  return historyMessages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      id: message.id,
      timestamp: message.timestamp,
    }));
};

const createSessionFromMessages = async (
  historyMessages: ChatMessage[],
  currentSwitchVersion: number,
  allowDownloadCreate = false,
  chatId = chatStore.activeChatId.value,
  restoreOverrides: RestoreSessionOverrides = {},
) => {
  isHydrating.value = true;

  try {
    const targetChat = chatId ? chatStore.getChatById(chatId) : null;
    const result = await restoreSession(buildInitialPrompts(historyMessages), {
      modelOptions: resolveModelOptions(),
      allowDownloadCreate,
      autoCreate:
        restoreOverrides.autoCreate ??
        (props.autoCreate || allowDownloadCreate),
      strategy: restoreOverrides.strategy ?? props.contextStrategy,
      summaryMode: restoreOverrides.summaryMode ?? props.contextSummaryMode,
      budgetRatio: restoreOverrides.budgetRatio ?? props.contextBudgetRatio,
      summaryChunkBudgetRatio:
        restoreOverrides.summaryChunkBudgetRatio ??
        props.contextSummaryChunkBudgetRatio,
      summaryMaxCharacters:
        restoreOverrides.summaryMaxCharacters ??
        props.contextSummaryMaxCharacters,
      summaryTimeoutMs:
        restoreOverrides.summaryTimeoutMs ?? props.contextSummaryTimeoutMs,
      summaryBackgroundTimeoutMs:
        restoreOverrides.summaryBackgroundTimeoutMs ??
        props.contextSummaryBackgroundTimeoutMs,
      messageMetadata: buildMessageMetadata(historyMessages),
      summaryCache: targetChat?.summaries ?? [],
      onSummaryCacheUpdate: async (summaries) => {
        if (!chatId) {
          return;
        }
        await chatStore.updateSummaries(chatId, summaries);
      },
      onSummaryCacheError: (error) => emit("summary-cache-error", error),
      shouldContinue: () => currentSwitchVersion === switchVersion,
      onInitStart: () => emit("init-start"),
      onInitComplete: () => emit("init-complete"),
      onCreateStart: () => emit("create-start"),
      onCreateComplete: () => emit("create-complete"),
      onStateChange: (state, event) => {
        contextLoadState.value = state;
        if (event === "start") {
          emit("context-load-start", state);
        } else if (event === "complete") {
          emit("context-load-complete", state);
        } else {
          emit("context-load-progress", state);
        }
      },
    });

    if (currentSwitchVersion !== switchVersion) return false;

    contextPartiallyLoaded.value = result.partiallyLoaded;
    return result.ready;
  } catch (error) {
    setContextLoadState({ phase: "error" });
    emit("error", error);
    return false;
  } finally {
    if (currentSwitchVersion === switchVersion) {
      isHydrating.value = false;
    }
  }
};

const getCompactionThresholdTokens = () => {
  if (!contextWindow.value) return null;

  const ratio = Number.isFinite(props.contextCompactionThresholdRatio)
    ? Math.min(Math.max(props.contextCompactionThresholdRatio, 0.05), 0.8)
    : 0.22;

  return Math.floor(contextWindow.value * ratio);
};

const shouldCompactBeforePrompt = () => {
  if (
    !props.autoCompactContext ||
    !isReady.value ||
    isCompactingContext.value
  ) {
    return false;
  }
  if (contextWindowAvailable.value == null || messages.value.length <= 1) {
    return false;
  }

  const threshold = getCompactionThresholdTokens();
  if (!threshold || contextWindowAvailable.value > threshold) {
    return false;
  }

  return lastAutoCompactMessageCount !== messages.value.length;
};

const compactActiveChatContext = async (
  chatId: string,
  force = false,
  sourceMessagesOverride?: ChatMessage[],
) => {
  if (!props.autoCompactContext || isCompactingContext.value) {
    return false;
  }
  if (!force && !shouldCompactBeforePrompt()) {
    return false;
  }

  const target = chatStore.getChatById(chatId);
  let sourceMessages: ChatMessage[] = [];

  if (sourceMessagesOverride) {
    sourceMessages = sourceMessagesOverride.map((message) => ({ ...message }));
  } else if (chatStore.activeChatId.value === chatId) {
    sourceMessages = messages.value.map((message) => ({ ...message }));
  } else if (target) {
    sourceMessages = fromStoredMessages(target.messages);
  }

  if (
    sourceMessages.filter((message) => message.content.trim().length > 0)
      .length <= 1
  ) {
    return false;
  }

  const currentSwitchVersion = switchVersion;
  isCompactingContext.value = true;
  contextOverflowPending.value = false;

  try {
    const ready = await createSessionFromMessages(
      sourceMessages,
      currentSwitchVersion,
      false,
      chatId,
      {
        autoCreate: true,
        strategy: "summarize",
        summaryMode: props.contextCompactionSummaryMode,
      },
    );

    if (ready && currentSwitchVersion === switchVersion) {
      lastAutoCompactMessageCount =
        sourceMessagesOverride && chatStore.activeChatId.value === chatId
          ? messages.value.length
          : sourceMessages.length;
    }

    return ready;
  } finally {
    if (currentSwitchVersion === switchVersion) {
      isCompactingContext.value = false;
    }
  }
};

const switchToChat = async (chatId: string) => {
  const target = chatStore.getChatById(chatId);
  if (!target) return;

  switchVersion += 1;
  const currentSwitchVersion = switchVersion;

  if (processing.value === "prompt") {
    interruptPrompt();
  }

  isSwitchingChat.value = true;
  isHydrating.value = false;
  isCompactingContext.value = false;
  isAssistantPending.value = false;
  contextOverflowPending.value = false;
  contextPartiallyLoaded.value = false;
  lastAutoCompactMessageCount = 0;

  chatStore.selectChat(chatId);

  draft.value = "";
  attachments.value = [];
  setMessages(fromStoredMessages(target.messages), { persist: false });

  try {
    if (props.autoInit) {
      await createSessionFromMessages(
        messages.value,
        currentSwitchVersion,
        false,
        chatId,
      );
    }
  } catch {
    // Errors are already emitted
  } finally {
    if (currentSwitchVersion === switchVersion) {
      isSwitchingChat.value = false;
    }
  }
};

const createAndSwitchChat = async () => {
  switchVersion += 1;
  const currentSwitchVersion = switchVersion;

  if (processing.value === "prompt") {
    interruptPrompt();
  }

  chatStore.clearActiveChat();
  draft.value = "";
  attachments.value = [];
  isCompactingContext.value = false;
  isAssistantPending.value = false;
  contextOverflowPending.value = false;
  contextPartiallyLoaded.value = false;
  lastAutoCompactMessageCount = 0;
  setMessages(props.initialMessages, { persist: false });

  if (props.autoInit) {
    await createSessionFromMessages(messages.value, currentSwitchVersion);
  }
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

  const wasActiveChat =
    chatStore.activeChatId.value === pendingDeleteChatId.value;
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
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .trim();

  if (!normalized) {
    return fallback;
  }

  const words = normalized.split(" ").filter(Boolean);
  if (words.length === 0) {
    return fallback;
  }

  return words.slice(0, TITLE_MAX_WORDS).join(" ");
};

const fallbackTitleFromPrompt = (input: string) => {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return DEFAULT_CHAT_TITLE;
  }

  return normalized.split(" ").slice(0, TITLE_MAX_WORDS).join(" ");
};

const generateChatTitle = async (firstPrompt: string) => {
  const fallback = fallbackTitleFromPrompt(firstPrompt);

  try {
    const status = await checkAvailability(props.modelOptions ?? {});
    if (status !== "available") {
      return fallback;
    }

    const title = await promptWithTemporarySession(
      [
        {
          role: "user",
          content: `Create a concise chat title in the same language as the input. Use 4 to 6 words. Return only the title text.\n\n${firstPrompt}`,
        },
      ],
      {
        modelOptions: props.modelOptions ?? {},
        timeoutMs: 8000,
      },
    );

    return sanitizeGeneratedTitle(title, fallback);
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
    return error.name === "AbortError";
  }
  if (error instanceof Error) {
    return error.name === "AbortError";
  }
  return false;
};

const handleSend = async () => {
  if (props.disabled) {
    return;
  }

  const text = draft.value.trim();
  if (!text && attachments.value.length === 0) return;

  const historyBeforeSend = messages.value.map((message) => ({ ...message }));
  const shouldCompactHistoryBeforePrompt = shouldCompactBeforePrompt();
  const selectedAttachments = cloneAttachments(attachments.value);
  emit("send", { text, attachments: selectedAttachments });

  let currentChatId = chatStore.activeChatId.value;
  if (!currentChatId) {
    const created = await chatStore.createChat(
      DEFAULT_CHAT_TITLE,
      toStoredMessages(historyBeforeSend),
    );
    currentChatId = created.id;
  }

  const userMessage: ChatMessage = {
    id: generateMessageId(),
    role: "user",
    content: text || "Describe the attached image.",
    timestamp: Date.now(),
    attachments: createMessageAttachments(selectedAttachments),
  };

  addMessage(userMessage, { chatId: currentChatId });

  const assistantMessageId = generateMessageId();
  addMessage(
    {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    },
    {
      persist: false,
    },
  );
  isAssistantPending.value = true;

  const userMessageCount = messages.value.filter(
    (message) => message.role === "user",
  ).length;
  if (userMessageCount === 1) {
    maybeGenerateTitleForChat(currentChatId, userMessage.content);
  }

  if (props.clearOnSend) {
    draft.value = "";
    attachments.value = [];
  }

  if (shouldCompactHistoryBeforePrompt) {
    await compactActiveChatContext(currentChatId, true, historyBeforeSend);
  }

  if (!isReady.value) {
    const ready = await createSessionFromMessages(
      historyBeforeSend,
      switchVersion,
      true,
      currentChatId,
    );
    if (!ready || !isReady.value) {
      updateMessageContent(assistantMessageId, props.notReadyMessage, {
        persist: false,
      });
      isAssistantPending.value = false;
      return;
    }
  }

  const input = await buildPromptInput(
    userMessage.content,
    selectedAttachments,
  );
  const options = resolvePromptOptions(text, selectedAttachments);
  emit("prompt-start", {
    streaming: props.streaming,
    input,
  });

  try {
    if (props.streaming) {
      const stream = promptStreaming(input, options);
      isAssistantPending.value = false;
      const reader = stream.getReader();
      let accumulated = "";
      let renderFrame: number | null = null;
      let pendingContent = "";

      const renderPendingContent = () => {
        renderFrame = null;
        updateMessageContent(assistantMessageId, pendingContent, {
          persist: false,
        });
      };
      const scheduleRender = (content: string) => {
        pendingContent = content;
        if (renderFrame === null) {
          renderFrame = window.requestAnimationFrame(renderPendingContent);
        }
      };
      const flushRender = () => {
        if (renderFrame !== null) {
          window.cancelAnimationFrame(renderFrame);
          renderFrame = null;
        }
        renderPendingContent();
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          accumulated += value;
          scheduleRender(accumulated);

          emit("stream-chunk", {
            chunk: value,
            accumulated,
          });
        }
      } finally {
        pendingContent = accumulated;
        flushRender();
      }

      const response = accumulated || props.emptyResponseMessage;
      updateMessageContent(assistantMessageId, response, {
        chatId: currentChatId,
        immediatePersist: true,
      });

      emit("prompt-complete", {
        response,
        streaming: true,
      });

      if (contextOverflowPending.value) {
        await compactActiveChatContext(currentChatId, true);
      }
      return;
    }

    const response = await prompt(input, options);
    isAssistantPending.value = false;
    const output = response || props.emptyResponseMessage;

    updateMessageContent(assistantMessageId, output, {
      chatId: currentChatId,
      immediatePersist: true,
    });

    emit("prompt-complete", {
      response: output,
      streaming: false,
    });

    if (contextOverflowPending.value) {
      await compactActiveChatContext(currentChatId, true);
    }
  } catch (error) {
    isAssistantPending.value = false;

    if (isAbortError(error)) {
      emit("interrupt");
      return;
    }

    updateMessageContent(assistantMessageId, resolveErrorMessage(error), {
      persist: false,
    });

    emit("error", error);

    if (contextOverflowPending.value) {
      await compactActiveChatContext(currentChatId, true);
    }
  }
};

const handleVoice = () => {
  emit("voice");
};

const handleRenameChat = async (chatId: string, title: string) => {
  await chatStore.renameChat(chatId, title);
};

watch(
  draft,
  (value) => {
    emit("update:draft", value);
  },
  { immediate: true },
);

watch(
  attachments,
  (value) => {
    emit("update:attachments", cloneAttachments(value));
  },
  { deep: true, immediate: true },
);

watch(
  availability,
  (value) => {
    if (!value) return;
    emit("availability-change", value);
  },
  { immediate: true },
);

watch(
  isReady,
  (value) => {
    emit("ready-change", value);
  },
  { immediate: true },
);

watch(
  processing,
  (value) => {
    emit("processing-change", normalizeProcessingState(value));
  },
  { immediate: true },
);

watch(
  downloadProgress,
  (value) => {
    emit("download-progress", value);
  },
  { immediate: true },
);

watch(
  [
    contextUsage,
    contextWindow,
    contextWindowAvailable,
    isHydrating,
    isCompactingContext,
  ],
  ([usage, window, available, hydrating, compacting]) => {
    emit("usage-change", {
      contextUsage: usage,
      contextWindow: window,
      contextWindowAvailable: available,
    });

    if (!hydrating && !compacting) {
      if (usage !== null) {
        lastContextUsage.value = usage;
      }
      if (available !== null) {
        lastContextWindowAvailable.value = available;
      }
    }
  },
  { immediate: true },
);

onMounted(async () => {
  emit("update:messages", messages.value);

  await chatStore.loadChats();

  const targetChat = chatStore.activeChat.value;
  if (targetChat) {
    await switchToChat(targetChat.id);
    return;
  }

  chatStore.clearActiveChat();
  setMessages(props.initialMessages, { persist: false });

  if (props.autoInit) {
    await createSessionFromMessages(messages.value, switchVersion);
  }
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
    void chatStore.updateMessages(
      payload.chatId,
      toStoredMessages(payload.messages),
    );
  }

  messages.value.forEach((message) => {
    message.attachments?.forEach((attachment) =>
      URL.revokeObjectURL(attachment.url),
    );
  });

  if (!props.disposeOnUnmount) {
    return;
  }

  if (processing.value === "prompt") {
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
  selectChat: switchToChat,
});
</script>

<style scoped>
.prompt-api {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0.75rem;
  overflow: hidden;
  height: 100%;
  position: relative;
  pointer-events: auto;
}

.prompt-api__main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.prompt-api__header {
  padding: 0.7rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 0.9rem;
  background:
    radial-gradient(
      circle at 100% 0%,
      rgba(124, 92, 228, 0.09),
      transparent 36%
    ),
    rgba(5, 8, 17, 0.62);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.045);
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
  font-size: 0.9rem;
  line-height: 1.2;
  color: var(--color-primary);
  font-weight: 740;
}

.prompt-api__availability {
  font-size: 0.69rem;
  line-height: 1;
  padding: 0.32rem 0.5rem;
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
  gap: 0.65rem;
  flex-wrap: wrap;
  color: var(--color-secondary);
  font-size: 0.78rem;
}

.prompt-api__warning {
  color: rgba(253, 224, 71, 0.95);
}

.prompt-api__header-loader {
  flex: 1 1 210px;
  max-width: 360px;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  color: rgba(147, 197, 253, 1);
}

.prompt-api__header-loader-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
  font-size: 0.76rem;
  font-weight: 600;
}

.prompt-api__header-loader-bar {
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}

.prompt-api__header-loader-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(147, 197, 253, 0.88);
  transition: width 0.2s ease;
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
