<template>
  <div class="prompt-api">
    <ChatSidebar
      :chats="chatItems"
      :active-chat-id="activeChatId"
      :disabled="isSidebarDisabled"
      @create="createAndSwitchChat"
      @select="switchToChat"
      @rename="renameChat"
      @delete="requestDeleteChat"
    />

    <div class="prompt-api__main">
      <header class="prompt-api__header">
        <div class="prompt-api__heading">
          <h3 class="prompt-api__title">{{ activeChatTitle }}</h3>
          <span class="prompt-api__availability" :class="`prompt-api__availability--${availability ?? 'unknown'}`">
            {{ availability ?? 'checking' }}
          </span>
        </div>
        <div class="prompt-api__meta">
          <span>Tokens: {{ contextUsage ?? 0 }} used / {{ contextWindowAvailable ?? '—' }} left</span>
          <span v-if="contextRestoreState.phase === 'summarizing'" class="prompt-api__warning">
            Compressing earlier messages locally…
          </span>
          <button
            type="button"
            class="prompt-api__button"
            data-browser-ai-action="clear"
            :disabled="isSidebarDisabled"
            @click="clearConversation"
          >
            Clear chat
          </button>
          <button
            v-if="snapshot.isProcessing"
            type="button"
            class="prompt-api__button"
            data-browser-ai-action="stop"
            @click="interruptPrompt"
          >
            Stop
          </button>
        </div>
      </header>

      <progress
        v-if="downloadProgress > 0 && downloadProgress < 100"
        :value="downloadProgress"
        max="100"
        aria-label="Model download progress"
      />
      <p v-if="requestError != null" class="prompt-api__warning" role="alert">{{ errorText }}</p>

      <ChatHistory :messages="messages" :is-typing="isTyping" :auto-scroll="autoScroll" />

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
        @voice="emit('voice')"
      />
    </div>

    <div v-if="pendingDeleteChat" class="prompt-api__overlay" role="dialog" aria-modal="true" aria-label="Delete chat">
      <div class="prompt-api__dialog">
        <h4>Delete chat?</h4>
        <p>“{{ pendingDeleteChat.title }}” and its local history will be removed.</p>
        <div class="prompt-api__dialog-actions">
          <button type="button" class="prompt-api__button" @click="pendingDeleteChatId = null">Cancel</button>
          <button type="button" class="prompt-api__button prompt-api__button--danger" @click="confirmDeleteChat">
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  conversationAttachments,
  conversationMessages,
  createConversation,
  createConversationView,
  type ConversationMessage,
  type ConversationOptions
} from '@desource/browser-ai/conversation';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type {
  LLMContextRestoreState,
  LLMContextSummaryMode,
  LLMContextStrategy,
  LLMPromptOptions
} from '@desource/browser-ai/workflows';
import ChatHistory, { type ChatMessage } from './ChatHistory.vue';
import ChatSidebar from './ChatSidebar.vue';
import PromptInput, { type PromptAttachment } from './PromptInput.vue';

type PromptProcessingState = 'availability' | 'create' | 'measure' | 'prompt' | '';

type PromptOptionsContext = {
  text: string;
  attachments: PromptAttachment[];
  messages: ChatMessage[];
  streaming: boolean;
};

interface Props {
  modelOptions?: LanguageModelCreateCoreOptions;
  chatKey?: string;
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
  modelOptions: () => ({}),
  chatKey: 'prompt-api',
  autoInit: true,
  autoCreate: true,
  disposeOnUnmount: true,
  streaming: true,
  promptOptions: undefined,
  systemPrompt: '',
  initialMessages: () => [],
  maxMessages: undefined,
  disabled: false,
  placeholder: 'Ask the assistant...',
  sendOnEnter: true,
  allowAttachments: true,
  allowVoice: false,
  accept: 'image/*,audio/*,.txt,.md,.markdown,.json,.jsonl,.csv,.tsv,.html,.xml',
  maxAttachments: 6,
  clearOnSend: true,
  autoScroll: true,
  notReadyMessage: 'Browser AI is unavailable or not ready. Check Chrome support, flags, and model availability.',
  emptyResponseMessage: 'No response received. Try again.',
  errorMessage: undefined,
  contextStrategy: 'summarize',
  contextSummaryMode: 'cache-first',
  contextBudgetRatio: 0.88,
  contextSummaryChunkBudgetRatio: 0.18,
  contextSummaryMaxCharacters: 0,
  contextSummaryTimeoutMs: 15_000,
  contextSummaryBackgroundTimeoutMs: 60_000,
  autoCompactContext: true,
  contextCompactionThresholdRatio: 0.22,
  contextCompactionSummaryMode: 'eager',
  contextLoadingMessage: 'Restoring previous messages for the local AI session...'
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
  'context-overflow': [];
  'context-load-start': [state: LLMContextRestoreState];
  'context-load-progress': [state: LLMContextRestoreState];
  'context-load-complete': [state: LLMContextRestoreState];
  'summary-cache-error': [error: unknown];
  'usage-change': [
    usage: { contextUsage: number | null; contextWindow: number | null; contextWindowAvailable: number | null }
  ];
  send: [payload: { text: string; attachments: PromptAttachment[] }];
  voice: [];
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

const draft = ref('');
const attachments = ref<PromptAttachment[]>([]);
const pendingDeleteChatId = ref<string | null>(null);
const localError = shallowRef<unknown>(null);
const view = createConversationView(props.initialMessages);
let sendingAttachments: PromptAttachment[] = [];
const toViewMessages = (items: readonly ConversationMessage[]): ChatMessage[] =>
  view.messages(items).map((message) => ({
    ...message,
    attachments: message.attachments?.map((attachment) => ({ ...attachment, url: attachment.url ?? '' }))
  }));
const controllerOptions = (): ConversationOptions => {
  const promptOptions = props.promptOptions;
  return {
    modelOptions: props.modelOptions,
    autoInit: props.autoInit,
    autoCreate: props.autoCreate,
    streaming: props.streaming,
    systemPrompt: props.systemPrompt,
    maxMessages: props.maxMessages,
    contextStrategy: props.contextStrategy,
    contextSummaryMode: props.contextSummaryMode,
    contextBudgetRatio: props.contextBudgetRatio,
    contextSummaryChunkBudgetRatio: props.contextSummaryChunkBudgetRatio,
    contextSummaryMaxCharacters: props.contextSummaryMaxCharacters,
    contextSummaryTimeoutMs: props.contextSummaryTimeoutMs,
    contextSummaryBackgroundTimeoutMs: props.contextSummaryBackgroundTimeoutMs,
    autoCompactContext: props.autoCompactContext,
    contextCompactionThresholdRatio: props.contextCompactionThresholdRatio,
    contextCompactionSummaryMode: props.contextCompactionSummaryMode,
    promptOptions:
      typeof promptOptions === 'function'
        ? (context) =>
            promptOptions({
              ...context,
              attachments: sendingAttachments,
              messages: toViewMessages(context.messages)
            })
        : promptOptions,
    onInitStart: () => emit('init-start'),
    onInitComplete: () => emit('init-complete'),
    onCreateStart: () => emit('create-start'),
    onCreateComplete: () => emit('create-complete'),
    onContextOverflow: () => emit('context-overflow'),
    onSummaryCacheError: (error) => emit('summary-cache-error', error),
    onContextStateChange: (state, event) => {
      if (event === 'start') emit('context-load-start', state);
      else if (event === 'complete') emit('context-load-complete', state);
      else emit('context-load-progress', state);
    },
    onPromptStart: (event) => emit('prompt-start', event),
    onStreamChunk: (event) => emit('stream-chunk', event),
    onPromptComplete: (event) =>
      emit('prompt-complete', { ...event, response: event.response || props.emptyResponseMessage })
  };
};
const controller = createConversation({
  ...controllerOptions(),
  chatKey: props.chatKey,
  initialMessages: conversationMessages(props.initialMessages)
});
const snapshot = shallowRef(controller.state.getSnapshot());
const unsubscribe = controller.state.subscribe(() => {
  snapshot.value = controller.state.getSnapshot();
});
const availability = computed(() => snapshot.value.availability);
const contextRestoreState = computed(() => snapshot.value.contextRestoreState);
const contextUsage = computed(() => snapshot.value.contextUsage);
const contextWindow = computed(() => snapshot.value.contextWindow);
const contextWindowAvailable = computed(() => snapshot.value.contextWindowAvailable);
const downloadProgress = computed(() => snapshot.value.downloadProgress);
const isReady = computed(() => snapshot.value.isReady);
const processing = computed(() => snapshot.value.modelProcessing);
const coreMessages = computed(() => snapshot.value.messages);
const messages = computed(() =>
  toViewMessages(coreMessages.value).map((message) =>
    message.role === 'assistant' && !message.content && !snapshot.value.isProcessing
      ? { ...message, content: props.emptyResponseMessage }
      : message
  )
);
const activeChatId = computed(() => snapshot.value.activeChatId);
const activeChatTitle = computed(
  () => snapshot.value.chats.find((chat) => chat.id === activeChatId.value)?.title ?? 'New chat'
);
const pendingDeleteChat = computed(() => snapshot.value.chats.find((chat) => chat.id === pendingDeleteChatId.value));
const isTyping = computed(() => snapshot.value.processing === 'send');
const isSidebarDisabled = computed(() => props.disabled || snapshot.value.isProcessing);
const isInputDisabled = computed(() => props.disabled || (snapshot.value.isProcessing && !isTyping.value));
const inputPlaceholder = computed(() =>
  snapshot.value.processing === 'load' || snapshot.value.processing === 'restore'
    ? props.contextLoadingMessage
    : props.placeholder
);
const chatItems = computed(() =>
  snapshot.value.chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt,
    preview: chat.messages[chat.messages.length - 1]?.content ?? ''
  }))
);
const requestError = computed(() => localError.value ?? snapshot.value.error);
const errorText = computed(() => {
  if (typeof props.errorMessage === 'function') return props.errorMessage(requestError.value);
  if (props.errorMessage) return props.errorMessage;
  if (availability.value === 'unavailable') return props.notReadyMessage;
  return requestError.value instanceof Error ? requestError.value.message : 'Browser AI request failed.';
});
const reportError = (error: unknown) => {
  localError.value = error;
  emit('error', error);
};
const rethrowError = (error: unknown): never => {
  reportError(error);
  throw error;
};
const handleSend = async () => {
  const draftBeforeSend = draft.value;
  const attachmentsBeforeSend = attachments.value;
  const text = draftBeforeSend.trim();
  const selected = [...attachmentsBeforeSend];
  if (props.disabled || snapshot.value.isProcessing || (!text && !selected.length)) return;
  localError.value = null;
  try {
    const files = conversationAttachments(selected);
    sendingAttachments = selected;
    const result = controller.send(text, files);
    emit('send', { text, attachments: selected });
    if ((await result) !== null && props.clearOnSend) {
      if (draft.value === draftBeforeSend) draft.value = '';
      attachments.value = attachments.value.filter((attachment) => !attachmentsBeforeSend.includes(attachment));
    }
  } catch (error) {
    reportError(error);
  } finally {
    if (sendingAttachments === selected) sendingAttachments = [];
  }
};
const runInit = () => controller.init().catch(rethrowError);
const runCreate = () => controller.create().catch(rethrowError);
const interruptPrompt = () => {
  controller.interrupt();
  emit('interrupt');
};
const clearConversation = async () => {
  localError.value = null;
  try {
    const result = await controller.clear();
    if (result !== null) emit('clear');
  } catch (error) {
    reportError(error);
  }
};
const switchToChat = (id: string) => {
  localError.value = null;
  return controller.selectChat(id).catch(reportError);
};
const createAndSwitchChat = () => {
  localError.value = null;
  return controller.createChat().catch(reportError);
};
const renameChat = (id: string, title: string) => controller.renameChat(id, title).catch(reportError);
const requestDeleteChat = (id: string) => {
  pendingDeleteChatId.value = id;
};
const confirmDeleteChat = () => {
  const id = pendingDeleteChatId.value;
  pendingDeleteChatId.value = null;
  if (id) return controller.deleteChat(id).catch(reportError);
};
const dispose = () => {
  controller.dispose();
  view.dispose();
  localError.value = null;
};

watch(controllerOptions, (options) => controller.configure(options), { deep: true });
watch(draft, (value) => emit('update:draft', value));
watch(attachments, (value) => emit('update:attachments', value));
watch(
  messages,
  (value, previous) => {
    emit('update:messages', value);
    if (isTyping.value) {
      const known = new Set(previous.map((message) => message.id));
      value.filter((message) => !known.has(message.id)).forEach((message) => emit('message-added', message));
    }
  },
  { flush: 'sync' }
);
watch(availability, (value) => {
  if (value) emit('availability-change', value);
});
watch(isReady, (value) => emit('ready-change', value));
watch(processing, (value) => emit('processing-change', value));
watch(downloadProgress, (value) => emit('download-progress', value));
watch([contextUsage, contextWindow, contextWindowAvailable], () =>
  emit('usage-change', {
    contextUsage: contextUsage.value,
    contextWindow: contextWindow.value,
    contextWindowAvailable: contextWindowAvailable.value
  })
);
onMounted(() => {
  void controller.load().catch(reportError);
});
onBeforeUnmount(() => {
  unsubscribe();
  if (snapshot.value.isProcessing) controller.interrupt();
  if (props.disposeOnUnmount) controller.dispose();
  view.dispose();
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
