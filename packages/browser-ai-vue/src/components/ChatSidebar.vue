<template>
  <aside class="chat-sidebar" aria-label="Saved conversations">
    <div class="chat-sidebar__heading">
      <span>Conversations</span>
      <span>{{ chats.length }}</span>
    </div>

    <button
      type="button"
      class="chat-sidebar__new"
      :disabled="disabled"
      data-browser-ai-action="create"
      @click="emit('create')"
    >
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
        :class="{
          'chat-sidebar__item--active': chat.id === activeChatId,
          'is-active': chat.id === activeChatId
        }"
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
            <button type="submit" :disabled="!renameDraft.trim()" data-browser-ai-action="save-rename">Save</button>
            <button type="button" data-browser-ai-action="cancel-rename" @click="cancelRename">Cancel</button>
          </div>
        </form>

        <template v-else>
          <button
            type="button"
            class="chat-sidebar__item-main"
            :disabled="disabled"
            data-browser-ai-action="select"
            @click="emit('select', chat.id)"
          >
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
