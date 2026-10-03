<template>
  <div class="chat-history-shell">
    <div
      ref="historyEl"
      class="chat-history"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      @scroll.passive="handleScroll"
    >
      <div v-if="messages.length === 0" class="chat-history__empty">
        <span aria-hidden="true">✦</span>
        <strong>Start a private, on-device conversation</strong>
        <p>Your prompt and the model response stay in this browser.</p>
      </div>

      <article
        v-for="message in messages"
        :key="message.id"
        v-memo="[message.content, message.timestamp, message.attachments, isActiveTypingMessage(message)]"
        class="chat-message"
        :class="{
          'chat-message--user': message.role === 'user',
          'chat-message--assistant': message.role === 'assistant',
          'chat-message--typing': isActiveTypingMessage(message)
        }"
      >
        <header class="chat-message__header">
          <span class="chat-message__role">
            <i aria-hidden="true" />
            {{ message.role === 'user' ? 'You' : 'Local AI' }}
          </span>
          <time class="chat-message__time" :datetime="toDateTime(message.timestamp)">
            {{ formatRelativeTime(message.timestamp) }}
          </time>
        </header>

        <div v-if="message.attachments?.length" class="chat-message__attachments">
          <div v-for="attachment in message.attachments" :key="attachment.id" class="chat-message__attachment">
            <img v-if="attachment.type.startsWith('image/')" :src="attachment.url" :alt="attachment.name" />
            <div v-else class="chat-message__file">
              {{ attachment.name }}
            </div>
          </div>
        </div>

        <div
          class="chat-message__text"
          :class="{
            'chat-message__text--typing': isActiveTypingMessage(message)
          }"
        >
          <span v-if="isActiveTypingMessage(message)" class="browser-ai-visually-hidden" role="status">
            Generating locally…
          </span>
          <span
            v-if="isActiveTypingMessage(message) && !message.content.trim()"
            class="chat-message__dots"
            aria-label="Local AI is responding"
          >
            <span class="typing-dot" />
            <span class="typing-dot" />
            <span class="typing-dot" />
          </span>
          <template v-else>
            <MarkdownRenderer class="chat-message__content" :content="message.content" />
            <span v-if="isActiveTypingMessage(message)" class="typing-cursor" aria-hidden="true" />
          </template>
        </div>
      </article>

      <article v-if="showStandaloneTyping" class="chat-message chat-message--assistant chat-message--typing">
        <header class="chat-message__header">
          <span class="chat-message__role"><i aria-hidden="true" />Local AI</span>
        </header>
        <div class="chat-message__dots" role="status" aria-label="Local AI is responding">
          <span class="browser-ai-visually-hidden">Generating locally…</span>
          <span class="typing-dot" />
          <span class="typing-dot" />
          <span class="typing-dot" />
        </div>
      </article>
    </div>

    <button v-if="showJumpToLatest" type="button" class="chat-history__latest" @click="scrollToBottom(true)">
      Latest response ↓
    </button>
  </div>
</template>

<script setup lang="ts">
import { createChatViewport } from '@desource/browser-ai/conversation';
import { computed, onMounted, ref, watch } from 'vue';
import { formatRelativeTime, toDateTime } from '../utils/display';
import MarkdownRenderer from './MarkdownRenderer.vue';

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
const viewport = createChatViewport();
const hasUnseenContent = ref(false);

const activeTypingMessageId = computed<string | null>(() => {
  if (!props.isTyping || props.messages.length === 0) return null;
  const lastMessage = props.messages[props.messages.length - 1];
  return lastMessage?.role === 'assistant' ? lastMessage.id : null;
});

const showStandaloneTyping = computed(() => props.isTyping && activeTypingMessageId.value === null);
const showJumpToLatest = computed(() => props.autoScroll && hasUnseenContent.value);

const isActiveTypingMessage = (message: ChatMessage) => props.isTyping && activeTypingMessageId.value === message.id;

const handleScroll = () => {
  if (historyEl.value) hasUnseenContent.value = viewport.scroll(historyEl.value);
};
const scrollToBottom = (force = false) => {
  hasUnseenContent.value = viewport.update(historyEl.value, props.autoScroll, force);
};

watch(
  [() => props.messages.length, () => props.messages[props.messages.length - 1]?.content, () => props.isTyping],
  () => scrollToBottom(),
  { flush: 'post' }
);

watch(
  () => props.autoScroll,
  (enabled) => {
    if (enabled) scrollToBottom(true);
  },
  { flush: 'post' }
);

onMounted(() => scrollToBottom(true));
</script>
