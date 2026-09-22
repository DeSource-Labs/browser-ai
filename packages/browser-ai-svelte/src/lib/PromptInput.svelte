<script lang="ts">
  import { PROMPT_FILE_ACCEPT } from '@desource/browser-ai';
  import { onDestroy } from 'svelte';
  import type { ChatAttachment } from './types.js';

  export let value = '';
  export let attachments: ChatAttachment[] = [];
  export let placeholder = 'Ask the assistant...';
  export let disabled = false;
  export let busy = false;
  export let sendOnEnter = true;
  export let allowAttachments = false;
  export let allowVoice = false;
  export let accept = PROMPT_FILE_ACCEPT;
  export let maxAttachments: number | undefined = undefined;
  export let onSend: () => void = () => undefined;
  export let onVoice: () => void = () => undefined;
  export let onValueChange: (value: string) => void = () => undefined;
  export let onAttachmentsChange: (attachments: ChatAttachment[]) => void = () => undefined;

  const createId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Ownership bookkeeping never drives rendered state.
  const createdUrls = new Set<string>();
  onDestroy(() => {
    createdUrls.forEach((url) => URL.revokeObjectURL(url));
    createdUrls.clear();
  });
  $: {
    const activeUrls = new Set(attachments.flatMap((attachment) => (attachment.url ? [attachment.url] : [])));
    createdUrls.forEach((url) => {
      if (!activeUrls.has(url)) {
        URL.revokeObjectURL(url);
        createdUrls.delete(url);
      }
    });
  }

  const selectFiles = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    const available =
      maxAttachments == null ? Number.POSITIVE_INFINITY : Math.max(maxAttachments - attachments.length, 0);
    const next = Array.from(target.files ?? [])
      .slice(0, available)
      .map((file) => {
        const url = URL.createObjectURL(file);
        createdUrls.add(url);
        return { id: createId(), file, url, name: file.name, type: file.type };
      });
    attachments = [...attachments, ...next];
    onAttachmentsChange(attachments);
    target.value = '';
  };

  const remove = (id: string) => {
    const item = attachments.find((attachment) => attachment.id === id);
    if (item?.url && createdUrls.has(item.url)) {
      URL.revokeObjectURL(item.url);
      createdUrls.delete(item.url);
    }
    attachments = attachments.filter((attachment) => attachment.id !== id);
    onAttachmentsChange(attachments);
  };

  const keydown = (event: KeyboardEvent) => {
    if (
      !sendOnEnter ||
      event.isComposing ||
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if ((value.trim() || attachments.length) && !busy && !disabled) onSend();
  };
</script>

<div class="prompt-input">
  {#if attachments.length}
    <div class="prompt-input__attachments">
      {#each attachments as attachment (attachment.id)}
        <div class="prompt-input__attachment">
          {#if attachment.type.startsWith('image/') && attachment.url}
            <img src={attachment.url} alt={attachment.name} />
          {:else}
            <div class="prompt-input__file">{attachment.name}</div>
          {/if}
          <button
            class="prompt-input__remove"
            type="button"
            aria-label={`Remove ${attachment.name}`}
            on:click={() => remove(attachment.id)}>×</button
          >
        </div>
      {/each}
    </div>
  {/if}
  <div class="prompt-input__row">
    {#if allowVoice}
      <button class="prompt-input__icon" type="button" {disabled} aria-label="Start voice input" on:click={onVoice}
        >●</button
      >
    {/if}
    {#if allowAttachments}
      <label class="prompt-input__icon" aria-label="Attach files"
        >+<input
          class="prompt-input__file-input"
          type="file"
          multiple
          {accept}
          {disabled}
          on:change={selectFiles}
        /></label
      >
    {/if}
    <textarea
      class="prompt-input__field"
      rows="1"
      bind:value
      {placeholder}
      {disabled}
      on:input={() => onValueChange(value)}
      on:keydown={keydown}></textarea>
    <button
      class="prompt-input__send"
      type="button"
      disabled={disabled || busy || (!value.trim() && !attachments.length)}
      aria-label="Send prompt"
      on:click={onSend}>Send</button
    >
  </div>
</div>
