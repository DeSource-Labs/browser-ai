<script lang="ts">
  import type { ChatSidebarItem } from './types.js';

  export let chats: ChatSidebarItem[] = [];
  export let activeChatId: string | null = null;
  export let disabled = false;
  export let onCreate: () => void = () => undefined;
  export let onSelect: (id: string) => void = () => undefined;
  export let onRename: (id: string, title: string) => void = () => undefined;
  export let onDelete: (id: string) => void = () => undefined;

  let editingId: string | null = null;
  let renameDraft = '';
  const beginRename = (chat: ChatSidebarItem) => {
    editingId = chat.id;
    renameDraft = chat.title;
  };
  const saveRename = (id: string) => {
    const title = renameDraft.trim();
    if (!title) return;
    onRename(id, title);
    editingId = null;
    renameDraft = '';
  };
</script>

<aside class="chat-sidebar" aria-label="Saved conversations">
  <button type="button" {disabled} data-browser-ai-action="create" on:click={onCreate}>New chat</button>
  <div class="chat-sidebar__list">
    {#each chats as chat (chat.id)}
      <article class:chat-sidebar__item={true} class:is-active={chat.id === activeChatId}>
        {#if editingId === chat.id}
          <form class="chat-sidebar__rename" on:submit|preventDefault={() => saveRename(chat.id)}>
            <label for={`rename-${chat.id}`}>Conversation name</label>
            <input id={`rename-${chat.id}`} bind:value={renameDraft} maxlength="80" />
            <button type="submit" {disabled} data-browser-ai-action="save-rename">Save</button>
            <button type="button" {disabled} data-browser-ai-action="cancel-rename" on:click={() => (editingId = null)}
              >Cancel</button
            >
          </form>
        {:else}
          <button type="button" {disabled} data-browser-ai-action="select" on:click={() => onSelect(chat.id)}
            >{chat.title}</button
          >
          <button type="button" {disabled} aria-label={`Rename ${chat.title}`} on:click={() => beginRename(chat)}
            >Rename</button
          >
          <button type="button" {disabled} aria-label={`Delete ${chat.title}`} on:click={() => onDelete(chat.id)}
            >×</button
          >
        {/if}
      </article>
    {/each}
  </div>
</aside>
