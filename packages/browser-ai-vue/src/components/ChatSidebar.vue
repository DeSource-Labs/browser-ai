<template>
  <aside class="chat-sidebar" aria-label="Saved conversations">
    <div class="chat-sidebar__heading">
      <span>Conversations</span>
      <span>{{ chats.length }}</span>
    </div>

    <button type="button" class="chat-sidebar__new" :disabled="disabled" @click="emit('create')">
      <span aria-hidden="true">＋</span>
      New conversation
    </button>

    <div class="chat-sidebar__list">
      <p v-if="chats.length === 0" class="chat-sidebar__empty">
        Chats you start here are stored locally in this browser.
      </p>

      <article
        v-for="chat in chats"
        :key="chat.id"
        class="chat-sidebar__item"
        :class="{ 'chat-sidebar__item--active': chat.id === activeChatId }"
      >
        <form v-if="editingChatId === chat.id" class="chat-sidebar__rename" @submit.prevent="saveRename(chat.id)">
          <label :for="`rename-${chat.id}`">Conversation name</label>
          <input
            :id="`rename-${chat.id}`"
            ref="renameInput"
            v-model="renameDraft"
            type="text"
            maxlength="80"
            @keydown.esc="cancelRename"
          />
          <div>
            <button type="submit" :disabled="!renameDraft.trim()">Save</button>
            <button type="button" @click="cancelRename">Cancel</button>
          </div>
        </form>

        <template v-else>
          <button type="button" class="chat-sidebar__item-main" :disabled="disabled" @click="emit('select', chat.id)">
            <span class="chat-sidebar__title">{{ chat.title }}</span>
            <span v-if="chat.preview" class="chat-sidebar__preview">
              {{ chat.preview }}
            </span>
            <time class="chat-sidebar__meta" :datetime="toDateTime(chat.updatedAt)">
              {{ formatRelativeTime(chat.updatedAt) }}
            </time>
          </button>

          <div class="chat-sidebar__actions">
            <button
              type="button"
              class="chat-sidebar__action"
              :disabled="disabled"
              :aria-label="`Rename ${chat.title}`"
              @click="startRename(chat)"
            >
              Rename
            </button>
            <button
              type="button"
              class="chat-sidebar__action chat-sidebar__action--danger"
              :disabled="disabled"
              :aria-label="`Delete ${chat.title}`"
              @click="emit('delete', chat.id)"
            >
              Delete
            </button>
          </div>
        </template>
      </article>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { formatRelativeTime, toDateTime } from '../utils/display';

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
  rename: [chatId: string, title: string];
  delete: [chatId: string];
}>();

const editingChatId = ref<string | null>(null);
const renameDraft = ref('');
const renameInput = ref<HTMLInputElement[] | null>(null);

const startRename = (chat: ChatSidebarItem) => {
  editingChatId.value = chat.id;
  renameDraft.value = chat.title;
  void nextTick(() => renameInput.value?.[0]?.select());
};

const cancelRename = () => {
  editingChatId.value = null;
  renameDraft.value = '';
};

const saveRename = (chatId: string) => {
  const title = renameDraft.value.trim();
  if (!title) return;
  emit('rename', chatId, title);
  cancelRename();
};
</script>

<style scoped>
.chat-sidebar {
  width: 244px;
  min-width: 244px;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.72rem;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 1rem;
  background: radial-gradient(circle at 0% 0%, rgba(124, 92, 228, 0.08), transparent 34%), rgba(5, 8, 17, 0.62);
}

.chat-sidebar__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.2rem 0.2rem 0.1rem;
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.69rem;
  font-weight: 760;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.chat-sidebar__heading span:last-child {
  min-width: 1.35rem;
  min-height: 1.35rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.62rem;
}

.chat-sidebar__new {
  min-height: 2.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.42rem;
  padding: 0.55rem 0.7rem;
  color: #f5f2ff;
  border: 1px solid rgba(167, 139, 250, 0.24);
  border-radius: 0.75rem;
  background: linear-gradient(135deg, rgba(124, 92, 228, 0.2), rgba(82, 112, 224, 0.14));
  font-size: 0.78rem;
  font-weight: 740;
  cursor: pointer;
}

.chat-sidebar__new span {
  font-size: 1rem;
  line-height: 1;
}

.chat-sidebar__new:disabled,
.chat-sidebar button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.chat-sidebar__list {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  overflow-y: auto;
  scrollbar-width: thin;
}

.chat-sidebar__empty {
  margin: 0;
  padding: 0.8rem 0.45rem;
  color: var(--color-secondary, rgba(255, 255, 255, 0.6));
  font-size: 0.72rem;
  line-height: 1.5;
}

.chat-sidebar__item {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.56rem;
  color: var(--color-primary, #fff);
  border: 1px solid transparent;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.025);
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}

.chat-sidebar__item:hover,
.chat-sidebar__item--active {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.055);
}

.chat-sidebar__item--active {
  box-shadow: inset 2px 0 #9f8bff;
}

.chat-sidebar__item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  padding: 0;
  color: inherit;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.chat-sidebar__title,
.chat-sidebar__preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-sidebar__title {
  font-size: 0.79rem;
  font-weight: 690;
  line-height: 1.35;
}

.chat-sidebar__preview,
.chat-sidebar__meta {
  color: var(--color-secondary, rgba(255, 255, 255, 0.58));
  font-size: 0.69rem;
}

.chat-sidebar__actions {
  display: flex;
  gap: 0.65rem;
}

.chat-sidebar__action {
  padding: 0;
  color: rgba(255, 255, 255, 0.5);
  border: 0;
  background: transparent;
  font-size: 0.65rem;
  cursor: pointer;
}

.chat-sidebar__action:hover {
  color: #fff;
}

.chat-sidebar__action--danger:hover {
  color: #fca5a5;
}

.chat-sidebar__rename {
  display: grid;
  gap: 0.42rem;
}

.chat-sidebar__rename label {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.66rem;
}

.chat-sidebar__rename input {
  min-width: 0;
  width: 100%;
  min-height: 2.15rem;
  padding: 0.4rem 0.5rem;
  color: #fff;
  border: 1px solid rgba(167, 139, 250, 0.32);
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
}

.chat-sidebar__rename div {
  display: flex;
  gap: 0.45rem;
}

.chat-sidebar__rename button {
  padding: 0;
  color: rgba(255, 255, 255, 0.62);
  border: 0;
  background: transparent;
  font-size: 0.65rem;
  cursor: pointer;
}

@media (max-width: 900px) {
  .chat-sidebar {
    width: 100%;
    min-width: 0;
    max-height: none;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    padding: 0.58rem;
  }

  .chat-sidebar__new {
    min-height: 2.3rem;
    padding-inline: 0.65rem;
  }

  .chat-sidebar__list {
    grid-column: 1 / -1;
    flex-direction: row;
    overflow-x: auto;
  }

  .chat-sidebar__empty {
    display: none;
  }

  .chat-sidebar__item {
    min-width: min(260px, 78vw);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-sidebar__item {
    transition: none;
  }
}
</style>
