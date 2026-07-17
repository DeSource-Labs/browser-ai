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
        <strong>Start a private conversation</strong>
        <p>Your prompt and the model response stay in this browser.</p>
      </div>

      <article
        v-for="message in messages"
        :key="message.id"
        v-memo="[
          message.content,
          message.timestamp,
          message.attachments,
          isActiveTypingMessage(message),
        ]"
        class="chat-message"
        :class="{
          'chat-message--user': message.role === 'user',
          'chat-message--assistant': message.role === 'assistant',
          'chat-message--typing': isActiveTypingMessage(message),
        }"
      >
        <header class="chat-message__header">
          <span class="chat-message__role">
            <i aria-hidden="true" />
            {{ message.role === "user" ? "You" : "Local AI" }}
          </span>
          <time
            class="chat-message__time"
            :datetime="toDateTime(message.timestamp)"
          >
            {{ formatRelativeTime(message.timestamp) }}
          </time>
        </header>

        <div
          v-if="message.attachments?.length"
          class="chat-message__attachments"
        >
          <div
            v-for="attachment in message.attachments"
            :key="attachment.id"
            class="chat-message__attachment"
          >
            <img
              v-if="attachment.type.startsWith('image/')"
              :src="attachment.url"
              :alt="attachment.name"
            />
            <div v-else class="chat-message__file">
              {{ attachment.name }}
            </div>
          </div>
        </div>

        <div
          class="chat-message__text"
          :class="{
            'chat-message__text--typing': isActiveTypingMessage(message),
          }"
        >
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
            <MarkdownRenderer
              class="chat-message__content"
              :content="message.content"
            />
            <span
              v-if="isActiveTypingMessage(message)"
              class="typing-cursor"
              aria-hidden="true"
            />
          </template>
        </div>
      </article>

      <article
        v-if="showStandaloneTyping"
        class="chat-message chat-message--assistant chat-message--typing"
      >
        <header class="chat-message__header">
          <span class="chat-message__role"
            ><i aria-hidden="true" />Local AI</span
          >
        </header>
        <div class="chat-message__dots" aria-label="Local AI is responding">
          <span class="typing-dot" />
          <span class="typing-dot" />
          <span class="typing-dot" />
        </div>
      </article>
    </div>

    <button
      v-if="showJumpToLatest"
      type="button"
      class="chat-history__latest"
      @click="scrollToBottom(true)"
    >
      Latest response ↓
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { formatRelativeTime, toDateTime } from "../utils/display";
import MarkdownRenderer from "./MarkdownRenderer.vue";

export type ChatAttachment = {
  id: string;
  url: string;
  name: string;
  type: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
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
  autoScroll: true,
});

const historyEl = ref<HTMLDivElement | null>(null);
const isPinnedToBottom = ref(true);
const hasUnseenContent = ref(false);

const activeTypingMessageId = computed<string | null>(() => {
  if (!props.isTyping || props.messages.length === 0) return null;
  const lastMessage = props.messages[props.messages.length - 1];
  return lastMessage?.role === "assistant" ? lastMessage.id : null;
});

const showStandaloneTyping = computed(
  () => props.isTyping && activeTypingMessageId.value === null,
);
const showJumpToLatest = computed(
  () => props.autoScroll && !isPinnedToBottom.value && hasUnseenContent.value,
);

const isActiveTypingMessage = (message: ChatMessage) =>
  props.isTyping && activeTypingMessageId.value === message.id;

const handleScroll = () => {
  const element = historyEl.value;
  if (!element) return;
  isPinnedToBottom.value =
    element.scrollHeight - element.scrollTop - element.clientHeight < 72;
  if (isPinnedToBottom.value) hasUnseenContent.value = false;
};

const scrollToBottom = (force = false) => {
  if (!props.autoScroll || !historyEl.value) return;
  if (!force && !isPinnedToBottom.value) {
    hasUnseenContent.value = true;
    return;
  }

  void nextTick(() => {
    const element = historyEl.value;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    isPinnedToBottom.value = true;
    hasUnseenContent.value = false;
  });
};

watch(
  [
    () => props.messages.length,
    () => props.messages[props.messages.length - 1]?.content,
    () => props.isTyping,
  ],
  () => scrollToBottom(),
);

watch(
  () => props.autoScroll,
  (enabled) => {
    if (enabled) scrollToBottom(true);
  },
);

onMounted(() => scrollToBottom(true));
</script>

<style scoped>
.chat-history-shell {
  position: relative;
  flex: 1;
  min-height: 0;
}

.chat-history {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: clamp(0.65rem, 1.4vw, 1rem);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 1rem;
  background:
    radial-gradient(
      circle at 15% 0%,
      rgba(91, 124, 255, 0.07),
      transparent 28%
    ),
    rgba(4, 7, 15, 0.58);
  user-select: text;
  scrollbar-width: thin;
  scrollbar-color: rgba(167, 139, 250, 0.35) transparent;
}

.chat-history__empty {
  flex: 1;
  min-height: 210px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.35rem;
  padding: 2rem;
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  text-align: center;
}

.chat-history__empty > span {
  width: 2.3rem;
  height: 2.3rem;
  display: grid;
  place-items: center;
  margin-bottom: 0.35rem;
  color: #d8ccff;
  border: 1px solid rgba(167, 139, 250, 0.24);
  border-radius: 0.75rem;
  background: rgba(124, 92, 228, 0.12);
}

.chat-history__empty strong {
  color: var(--color-primary, #fff);
  font-size: 0.95rem;
}

.chat-history__empty p {
  margin: 0;
  font-size: 0.8rem;
}

.chat-message {
  width: fit-content;
  max-width: min(88%, 860px);
  padding: 0.75rem 0.9rem;
  color: var(--color-primary, #fff);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
  background: rgba(13, 17, 31, 0.72);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.04);
  overflow-wrap: anywhere;
}

.chat-message--user {
  align-self: flex-end;
  max-width: min(76%, 680px);
  border-color: rgba(124, 145, 255, 0.26);
  border-bottom-right-radius: 0.35rem;
  background: linear-gradient(
    145deg,
    rgba(91, 94, 170, 0.34),
    rgba(91, 66, 132, 0.3)
  );
}

.chat-message--assistant {
  align-self: flex-start;
  border-bottom-left-radius: 0.35rem;
}

.chat-message__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.45rem;
}

.chat-message__role {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.73rem;
  font-weight: 760;
}

.chat-message__role i {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: #8fded2;
  box-shadow: 0 0 0.55rem rgba(94, 234, 212, 0.65);
}

.chat-message--user .chat-message__role i {
  background: #b7a3ff;
  box-shadow: 0 0 0.55rem rgba(167, 139, 250, 0.65);
}

.chat-message__time {
  color: var(--color-secondary, rgba(255, 255, 255, 0.56));
  font-size: 0.69rem;
  white-space: nowrap;
}

.chat-message__attachments {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.65rem;
}

.chat-message__attachment {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.6rem;
  background: rgba(0, 0, 0, 0.3);
}

.chat-message__attachment img {
  width: 100%;
  height: 86px;
  display: block;
  object-fit: cover;
}

.chat-message__file {
  padding: 0.55rem;
  color: var(--color-secondary, rgba(255, 255, 255, 0.62));
  font-size: 0.75rem;
}

.chat-message__text {
  min-width: 0;
  line-height: 1.55;
}

.chat-message__text--typing {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
}

.chat-message__content {
  min-width: 0;
  font-size: 0.92rem;
}

.chat-message--typing {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
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
  background: #a9c7ff;
  opacity: 0.55;
  animation: typing 1.2s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

.typing-cursor {
  width: 2px;
  height: 1em;
  flex-shrink: 0;
  border-radius: 2px;
  background: currentColor;
  animation: cursor-blink 1s steps(1, end) infinite;
}

.chat-history__latest {
  position: absolute;
  left: 50%;
  bottom: 0.8rem;
  transform: translateX(-50%);
  min-height: 2.2rem;
  padding: 0.42rem 0.72rem;
  color: #fff;
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 999px;
  background: rgba(18, 20, 38, 0.94);
  box-shadow: 0 0.7rem 2rem rgba(0, 0, 0, 0.35);
  font-size: 0.72rem;
  font-weight: 720;
  cursor: pointer;
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

@media (max-width: 600px) {
  .chat-message,
  .chat-message--user {
    max-width: 92%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing-dot,
  .typing-cursor {
    animation: none;
  }
}
</style>
