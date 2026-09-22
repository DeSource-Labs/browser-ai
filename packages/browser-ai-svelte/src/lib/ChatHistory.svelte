<script lang="ts">
  import { createChatViewport, formatRelativeTime, toDateTime } from '@desource/browser-ai/conversation';
  import { afterUpdate } from 'svelte';
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  import type { ChatMessage } from './types.js';

  export let messages: ChatMessage[] = [];
  export let isTyping = false;
  export let autoScroll = true;
  let history: HTMLDivElement;
  let showLatest = false;
  let wasAuto = false;
  const viewport = createChatViewport();
  const jump = (force = false) => {
    showLatest = viewport.update(history, autoScroll, force);
  };
  afterUpdate(() => {
    jump(autoScroll && !wasAuto);
    wasAuto = autoScroll;
  });
</script>

<div class="chat-history-shell">
  <div
    bind:this={history}
    on:scroll={() => {
      showLatest = viewport.scroll(history);
    }}
    class="chat-history"
    role="log"
    aria-label="Chat messages"
    aria-live="polite"
  >
    {#if messages.length === 0}
      <div class="chat-history__empty">Start a private, on-device conversation.</div>
    {:else}
      {#each messages as message (message.id)}
        <article class={`chat-message chat-message--${message.role}`}>
          <header class="chat-message__header">
            <span class="chat-message__role">{message.role === 'user' ? 'You' : 'Local AI'}</span><time
              class="chat-message__time"
              datetime={toDateTime(message.timestamp)}>{formatRelativeTime(message.timestamp)}</time
            >
          </header>
          <div class="chat-message__content"><MarkdownRenderer content={message.content} /></div>
          {#if message.attachments?.length}
            <div class="chat-message__attachments">
              {#each message.attachments as attachment (attachment.id)}
                <div class="chat-message__attachment">
                  {#if attachment.type.startsWith('image/') && attachment.url}
                    <img src={attachment.url} alt={attachment.name} />
                  {:else}
                    <div class="chat-message__file">{attachment.name}</div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </article>
      {/each}
    {/if}
    {#if isTyping}<div class="chat-history__typing" role="status">Generating locally…</div>{/if}
  </div>
  {#if autoScroll && showLatest}<button type="button" class="chat-history__latest" on:click={() => jump(true)}
      >Latest response ↓</button
    >{/if}
</div>
