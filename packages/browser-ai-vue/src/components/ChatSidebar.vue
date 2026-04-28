<template>
  <aside class="chat-sidebar">
    <button type="button" class="chat-sidebar__new" :disabled="disabled" @click="emit('create')">
      New Chat
    </button>

    <div class="chat-sidebar__list">
      <div
        v-for="chat in chats"
        :key="chat.id"
        class="chat-sidebar__item"
        :class="{ 'chat-sidebar__item--active': chat.id === activeChatId }"
      >
        <button
          type="button"
          class="chat-sidebar__item-main"
          :disabled="disabled"
          @click="emit('select', chat.id)"
        >
          <span class="chat-sidebar__title">{{ chat.title }}</span>
          <span class="chat-sidebar__meta">{{ formatTime(chat.updatedAt) }}</span>
          <span v-if="chat.preview" class="chat-sidebar__preview">{{ chat.preview }}</span>
        </button>

        <div class="chat-sidebar__actions">
          <button
            type="button"
            class="chat-sidebar__action"
            :disabled="disabled"
            @click.stop="emit('rename', chat.id)"
          >
            Rename
          </button>
          <button
            type="button"
            class="chat-sidebar__action chat-sidebar__action--danger"
            :disabled="disabled"
            @click.stop="emit('delete', chat.id)"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
export interface ChatSidebarItem {
  id: string;
  title: string;
  updatedAt: number;
  preview?: string;
}

interface Props {
  chats: ChatSidebarItem[];
  activeChatId: string | null;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  disabled: false
});

const emit = defineEmits<{
  create: [];
  select: [chatId: string];
  rename: [chatId: string];
  delete: [chatId: string];
}>();

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 1000 / 60);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
</script>

<style scoped>
.chat-sidebar {
  width: 250px;
  min-width: 250px;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(120, 120, 120, 0.2);
  background: rgba(20, 20, 20, 0.45);
}

.chat-sidebar__new {
  border: 1px solid rgba(120, 120, 120, 0.4);
  background: rgba(80, 80, 80, 0.32);
  color: var(--color-primary);
  border-radius: 0.7rem;
  padding: 0.5rem 0.7rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.chat-sidebar__new:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-sidebar__list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
  min-height: 0;
}

.chat-sidebar__item {
  width: 100%;
  border: 1px solid rgba(120, 120, 120, 0.22);
  background: rgba(60, 60, 60, 0.3);
  color: var(--color-primary);
  border-radius: 0.7rem;
  padding: 0.5rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.chat-sidebar__item--active {
  border-color: rgba(120, 120, 120, 0.55);
  background: rgba(100, 100, 100, 0.35);
}

.chat-sidebar__item-main {
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  cursor: pointer;
}

.chat-sidebar__item-main:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.chat-sidebar__title {
  font-size: 0.83rem;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-sidebar__meta {
  font-size: 0.73rem;
  color: var(--color-secondary);
}

.chat-sidebar__preview {
  font-size: 0.75rem;
  color: var(--color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-sidebar__actions {
  display: flex;
  gap: 0.6rem;
}

.chat-sidebar__action {
  border: none;
  background: transparent;
  font-size: 0.72rem;
  color: rgba(220, 220, 220, 0.92);
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}

.chat-sidebar__action:focus {
  outline: 1px solid rgba(180, 180, 180, 0.7);
  outline-offset: 2px;
}

.chat-sidebar__action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-sidebar__action--danger {
  color: rgba(252, 165, 165, 0.95);
}

@media (max-width: 900px) {
  .chat-sidebar {
    width: 100%;
    min-width: 0;
    max-height: 210px;
  }
}
</style>
