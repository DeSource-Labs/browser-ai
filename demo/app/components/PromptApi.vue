<template>
  <div class="prompt-api">
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
</template>

<script setup lang="ts">
import type { ChatAttachment, ChatMessage } from './ChatHistory.vue';
import type { PromptAttachment } from './PromptInput.vue';

type LLMPromptOptions = Omit<LanguageModelPromptOptions, 'signal'>;
type ProcessingState = 'availability' | 'create' | 'measure' | 'prompt' | '';

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
  'processing-change': [state: ProcessingState];
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

const {
  availability,
  init,
  create,
  dispose,
  prompt,
  promptStreaming,
  append,
  isReady,
  processing,
  downloadProgress,
  inputUsage,
  inputQuota,
  quotaOverflowCount,
  interrupt: interruptOperation,
} = usePromptApi();

const draft = ref('');
const attachments = ref<PromptAttachment[]>([]);
const messages = ref<ChatMessage[]>(props.initialMessages.map((message) => ({ ...message })));

const isTyping = computed(() => processing.value === 'prompt');
const isInputDisabled = computed(() => props.disabled || !isReady.value);

const normalizeProcessingState = (state: string): ProcessingState => {
  if (state === 'new-session') {
    return 'create';
  }
  return state as ProcessingState;
};

const generateMessageId = () => {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
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

const applyMessageLimit = (next: ChatMessage[]) => {
  if (!props.maxMessages || props.maxMessages <= 0) {
    return next;
  }
  return next.slice(-props.maxMessages);
};

const setMessages = (next: ChatMessage[]) => {
  messages.value = applyMessageLimit(next);
  emit('update:messages', messages.value);
};

const addMessage = (message: ChatMessage) => {
  messages.value = applyMessageLimit([...messages.value, message]);
  emit('update:messages', messages.value);
  emit('message-added', message);
};

const updateMessageContent = (messageId: string, content: string) => {
  messages.value = applyMessageLimit(
    messages.value.map((message) => {
      if (message.id !== messageId) {
        return message;
      }
      return {
        ...message,
        content
      };
    })
  );
  emit('update:messages', messages.value);
};

const cloneAttachments = (items: PromptAttachment[]) => {
  return items.map((item) => ({ ...item }));
};

const toChatAttachments = (items: PromptAttachment[]): ChatAttachment[] => {
  return items.map((attachment) => ({
    id: attachment.id,
    url: attachment.url,
    name: attachment.name,
    type: attachment.type
  }));
};

const buildPromptInput = (userContent: string): LanguageModelPrompt => {
  if (!props.systemPrompt.trim()) {
    return userContent;
  }

  return `System instructions:\n${props.systemPrompt.trim()}\n\nUser:\n${userContent}`;
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

const seedInitialMessages = async () => {
  if (props.initialMessages.length === 0) {
    return;
  }

  const payload: LanguageModelPrompt = props.initialMessages.map((message) => ({
    role: message.role,
    content: message.content
  }));
  await append(payload);
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
    await seedInitialMessages();
    emit('create-complete');
  } catch (error) {
    emit('error', error);
    throw error;
  }
};

const interruptPrompt = () => {
  interruptOperation();
  emit('interrupt');
};

const clearConversation = () => {
  setMessages([]);
  emit('clear');
};

const handleSend = async () => {
  if (props.disabled) {
    return;
  }

  const text = draft.value.trim();
  if (!text && attachments.value.length === 0) return;

  const selectedAttachments = cloneAttachments(attachments.value);
  emit('send', { text, attachments: selectedAttachments });

  const userMessage: ChatMessage = {
    id: generateMessageId(),
    role: 'user',
    content: text || 'Describe the attached image.',
    timestamp: Date.now(),
    attachments: toChatAttachments(selectedAttachments)
  };

  addMessage(userMessage);

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
      });

      const stream = promptStreaming(input, options);
      const reader = stream.getReader();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += value;
        updateMessageContent(assistantMessageId, accumulated);
        emit('stream-chunk', {
          chunk: value,
          accumulated
        });
      }

      const response = accumulated || props.emptyResponseMessage;
      if (!accumulated) {
        updateMessageContent(assistantMessageId, response);
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
  });
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

watch(quotaOverflowCount, (value, previous) => {
  if (value > (previous ?? 0)) {
    emit('quota-overflow');
  }
});

onMounted(async () => {
  emit('update:messages', messages.value);
  if (!props.autoInit && !props.autoCreate) {
    return;
  }

  try {
    await runInit();
    if (props.autoCreate) {
      await runCreate();
    }
  } catch {
    // Errors are already propagated via events
  }
});

onBeforeUnmount(() => {
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
  send: handleSend
});
</script>

<style scoped lang="scss">
.prompt-api {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: hidden;
  height: 100%;
  pointer-events: auto;
}</style>
