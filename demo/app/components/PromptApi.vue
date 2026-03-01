<template>
  <div class="prompt-api">
    <ChatHistory :messages="messages" :is-typing="isTyping" />
    <PromptInput
      v-model="draft"
      v-model:attachments="attachments"
      :disabled="!isReady"
      :busy="isTyping"
      @send="handleSend"
      @voice="handleVoice"
    />
  </div>
</template>

<script setup lang="ts">
import type { ChatAttachment, ChatMessage } from './ChatHistory.vue';
import type { PromptAttachment } from './PromptInput.vue';

interface Props {
  prompt: (input: string) => Promise<string>;
  isReady: boolean;
  processing: string;
}

const props = defineProps<Props>();

const draft = ref('');
const attachments = ref<PromptAttachment[]>([]);
const messages = ref<ChatMessage[]>([]);

const isTyping = computed(() => props.processing === 'prompt');

const handleSend = async () => {
  const text = draft.value.trim();
  if (!text && attachments.value.length === 0) return;

  const userMessage: ChatMessage = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    role: 'user',
    content: text || 'Describe the attached image.',
    attachments: attachments.value.map((attachment) => ({
      id: attachment.id,
      url: attachment.url,
      name: attachment.name,
      type: attachment.type
    }))
  };

  messages.value.push(userMessage);
  draft.value = '';
  attachments.value = [];

  if (!props.isReady) {
    messages.value.push({
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      role: 'assistant',
      content: 'Model is not ready yet. Please try again in a moment.'
    });
    return;
  }

  try {
    const response = await props.prompt(userMessage.content);
    messages.value.push({
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      role: 'assistant',
      content: response || 'No response received. Try again.'
    });
  } catch {
    messages.value.push({
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      role: 'assistant',
      content: 'Something went wrong while sending your message.'
    });
  }
};

const handleVoice = () => {
  messages.value.push({
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    role: 'assistant',
    content: 'Voice input is not wired yet, but the UI is ready.'
  });
};
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
