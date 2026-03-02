<template>
  <div ref="historyEl" class="chat-history">
    <div v-if="messages.length === 0" class="chat-history__empty">
      Ask a question to get started.
    </div>

    <div
      v-for="message in messages"
      :key="message.id"
      class="chat-message"
      :class="{
        'chat-message--user': message.role === 'user',
        'chat-message--assistant': message.role === 'assistant',
        'chat-message--typing': isActiveTypingMessage(message)
      }"
    >
      <div class="chat-message__header">
        <span class="chat-message__role">{{ message.role === 'user' ? 'You' : 'Assistant' }}</span>
        <span class="chat-message__time">{{ formatTime(message.timestamp) }}</span>
      </div>
      
      <div v-if="message.attachments?.length" class="chat-message__attachments">
        <div v-for="attachment in message.attachments" :key="attachment.id" class="chat-message__attachment">
          <img v-if="attachment.type.startsWith('image/')" :src="attachment.url" :alt="attachment.name" />
          <div v-else class="chat-message__file">
            {{ attachment.name }}
          </div>
        </div>
      </div>
      <div class="chat-message__text" :class="{ 'chat-message__text--typing': isActiveTypingMessage(message) }">
        <template v-if="isActiveTypingMessage(message) && !message.content.trim()">
          <span class="chat-message__dots" aria-live="polite" aria-label="Assistant is typing">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </span>
        </template>
        <template v-else>
          <div class="chat-message__content" v-html="formatMessage(message.content)"></div>
          <span v-if="isActiveTypingMessage(message)" class="typing-cursor" aria-hidden="true"></span>
        </template>
      </div>
    </div>

    <div v-if="showStandaloneTyping" class="chat-message chat-message--assistant chat-message--typing">
      <div class="chat-message__header">
        <span class="chat-message__role">Assistant</span>
      </div>
      <div class="chat-message__dots">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export type ChatAttachment = {
  id: string;
  url: string;
  name: string;
  type: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  attachments?: ChatAttachment[];
};

interface Props {
  messages: ChatMessage[];
  isTyping?: boolean;
  autoScroll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isTyping: false,
  autoScroll: true
});

const historyEl = ref<HTMLDivElement | null>(null);

const activeTypingMessageId = computed<string | null>(() => {
  if (!props.isTyping || props.messages.length === 0) {
    return null;
  }

  const lastMessage = props.messages[props.messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'assistant') {
    return null;
  }

  return lastMessage.id;
});

const showStandaloneTyping = computed(() => {
  return props.isTyping && activeTypingMessageId.value === null;
});

const isActiveTypingMessage = (message: ChatMessage) => {
  return props.isTyping && activeTypingMessageId.value === message.id;
};

const scrollToBottom = () => {
  if (!props.autoScroll) return;
  if (!historyEl.value) return;
  nextTick(() => {
    historyEl.value!.scrollTop = historyEl.value!.scrollHeight;
  });
};

watch([() => props.messages, () => props.isTyping, () => props.autoScroll], () => {
  scrollToBottom();
}, { deep: true });

onMounted(() => {
  scrollToBottom();
});

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatMessage = (value: string) => {
  let html = escapeHtml(value);

  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
    return `<pre class="chat-message__code"><code>${code}</code></pre>`;
  });

  html = html.replace(/`([^`\n]+)`/g, '<code class="chat-message__inline">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  html = html.replace(/\n/g, '<br />');
  return html;
};

const formatTime = (timestamp?: number) => {
  if (!timestamp) return 'just now';

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
</script>

<style scoped lang="scss">
.chat-history {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem;
  border-radius: 1rem;
  background: rgba(20, 20, 20, 0.35);
  border: 1px solid rgba(120, 120, 120, 0.2);
  backdrop-filter: blur(6px);

  /* Custom scrollbar styles */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 120, 120, 0.5) transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(120, 120, 120, 0.4);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: content-box;

    &:hover {
      background: rgba(120, 120, 120, 0.6);
      background-clip: content-box;
    }
  }
}

.chat-history__empty {
  color: var(--color-secondary);
  text-align: center;
  font-size: 0.9rem;
}

.chat-message {
  max-width: 80%;
  padding: 0.6rem 0.8rem;
  border-radius: 0.9rem;
  line-height: 1.45;
  font-size: 0.95rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--color-primary);
}

.chat-message--user {
  align-self: flex-end;
  background: rgba(120, 120, 120, 0.35);
  border-color: rgba(160, 160, 160, 0.35);
}

.chat-message--assistant {
  align-self: flex-start;
  background: rgba(60, 60, 60, 0.35);
  border-color: rgba(120, 120, 120, 0.3);
}

.chat-message__attachments {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.chat-message__attachment {
  border-radius: 0.5rem;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);

  img {
    width: 100%;
    height: 80px;
    object-fit: cover;
    display: block;
  }
}

.chat-message__file {
  padding: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-secondary);
}

.chat-message__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
  font-size: 0.85rem;
}

.chat-message__role {
  font-weight: 500;
  opacity: 0.9;
}

.chat-message__time {
  font-size: 0.75rem;
  opacity: 0.6;
  color: var(--color-secondary);
  font-weight: 400;
  letter-spacing: 0.3px;
}

.chat-message__text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.5;
}

.chat-message__text--typing {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
  min-height: 1.2rem;
}

.chat-message__text--typing .chat-message__dots {
  padding: 0;
}

.chat-message__content {
  min-width: 0;
}

.chat-message__text :deep(code) {
  font-family: "SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", monospace;
}

.chat-message__inline {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 0.05rem 0.35rem;
  border-radius: 0.4rem;
  font-size: 0.85rem;
}

.chat-message__code {
  margin: 0.5rem 0 0;
  padding: 0.65rem 0.75rem;
  border-radius: 0.6rem;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 0.85rem;
  overflow-x: auto;
}

.chat-message__code code {
  display: block;
  white-space: pre-wrap;
}

.chat-message--typing {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

.chat-message__dots {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0;
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  opacity: 0.6;
  animation: typing 1.2s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.75;
  animation: cursor-blink 1s steps(1, end) infinite;
  flex-shrink: 0;
}

@keyframes typing {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

@keyframes cursor-blink {
  0%,
  49% {
    opacity: 0.75;
  }
  50%,
  100% {
    opacity: 0.2;
  }
}
</style>
