<script lang="ts">
  import { PROMPT_FILE_ACCEPT } from '@desource/browser-ai';
  import {
    createConversation,
    createConversationView,
    conversationAttachments,
    conversationMessages,
    type ConversationOptions
  } from '@desource/browser-ai/conversation';
  import { onDestroy, onMount } from 'svelte';
  import { errorMessage } from './error-message.js';
  import ChatHistory from './ChatHistory.svelte';
  import ChatSidebar from './ChatSidebar.svelte';
  import PromptInput from './PromptInput.svelte';
  import type { ChatAttachment, ChatMessage } from './types.js';
  export let chatKey: string = 'prompt-api';
  export let modelOptions: LanguageModelCreateCoreOptions = {};
  export let systemPrompt: string = '';
  export let autoInit: boolean = true;
  export let autoCreate: boolean = true;
  export let streaming: boolean = true;
  export let promptOptions: ConversationOptions['promptOptions'] = undefined;
  export let maxMessages: number | undefined = undefined;
  export let contextStrategy: ConversationOptions['contextStrategy'] = 'summarize';
  export let contextSummaryMode: ConversationOptions['contextSummaryMode'] = 'cache-first';
  export let contextBudgetRatio: number = 0.88;
  export let contextSummaryChunkBudgetRatio: number = 0.18;
  export let contextSummaryMaxCharacters: number = 0;
  export let contextSummaryTimeoutMs: number = 15_000;
  export let contextSummaryBackgroundTimeoutMs: number = 60_000;
  export let autoCompactContext: boolean = true;
  export let contextCompactionThresholdRatio: number = 0.22;
  export let contextCompactionSummaryMode: ConversationOptions['contextCompactionSummaryMode'] = 'eager';
  export let placeholder: string = 'Ask the assistant...';
  export let allowAttachments: boolean = true;
  export let allowVoice: boolean = false;
  export let sendOnEnter: boolean = true;
  export let clearOnSend: boolean = true;
  export let accept: string = PROMPT_FILE_ACCEPT;
  export let maxAttachments: number | undefined = 6;
  export let disabled: boolean = false;
  export let initialMessages: ChatMessage[] = [];
  export let onMessagesChange: ((messages: ChatMessage[]) => void) | undefined = undefined;
  export let onError: ((error: unknown) => void) | undefined = undefined;
  export let onVoice: (() => void) | undefined = undefined;
  const api = createConversation({ chatKey, initialMessages: conversationMessages(initialMessages) });
  const view = createConversationView(initialMessages);
  let state = api.state.getSnapshot();
  const unsubscribe = api.state.subscribe(() => {
    state = api.state.getSnapshot();
  });
  let draft = '';
  let attachments: ChatAttachment[] = [];
  let error = '';
  let pendingDelete: string | null = null;
  $: displayedError = error || (state.error == null ? '' : errorMessage(state.error, 'Browser AI request failed.'));
  $: api.configure({
    modelOptions,
    systemPrompt,
    autoInit,
    autoCreate,
    streaming,
    promptOptions,
    maxMessages,
    contextStrategy,
    contextSummaryMode,
    contextBudgetRatio,
    contextSummaryChunkBudgetRatio,
    contextSummaryMaxCharacters,
    contextSummaryTimeoutMs,
    contextSummaryBackgroundTimeoutMs,
    autoCompactContext,
    contextCompactionThresholdRatio,
    contextCompactionSummaryMode
  });
  $: messages = view.messages(state.messages);
  $: onMessagesChange?.(messages);
  $: chatItems = state.chats.map((chat) => ({ ...chat, preview: chat.messages[chat.messages.length - 1]?.content }));
  $: activeChat = state.chats.find((chat) => chat.id === state.activeChatId);
  const run = async (operation: () => Promise<unknown>) => {
    error = '';
    try {
      await operation();
    } catch (caught) {
      error = errorMessage(caught, 'Browser AI request failed.');
      onError?.(caught);
    }
  };
  onMount(() => {
    void run(api.load);
  });
  onDestroy(() => {
    unsubscribe();
    api.dispose();
    view.dispose();
  });
  const send = () => {
    if (disabled || state.isProcessing || (!draft.trim() && !attachments.length)) return;
    void run(async () => {
      const sentDraft = draft;
      const sentAttachments = attachments;
      const response = await api.send(sentDraft.trim(), conversationAttachments(sentAttachments));
      if (response !== null && clearOnSend) {
        if (draft === sentDraft) draft = '';
        attachments = attachments.filter((attachment) => !sentAttachments.includes(attachment));
      }
    });
  };
  const deleteChat = () => {
    const id = pendingDelete;
    pendingDelete = null;
    if (id) void run(() => api.deleteChat(id));
  };
</script>

<div class="prompt-api">
  <ChatSidebar
    chats={chatItems}
    activeChatId={state.activeChatId}
    disabled={disabled || state.isProcessing}
    onCreate={() => void run(() => api.createChat())}
    onSelect={(id) => void run(() => api.selectChat(id))}
    onRename={(id, title) => void run(() => api.renameChat(id, title))}
    onDelete={(id) => {
      pendingDelete = id;
    }}
  />
  <div class="prompt-api__main">
    <header class="prompt-api__header">
      <h3 class="prompt-api__title">{activeChat?.title ?? 'New chat'}</h3>
      <span class="prompt-api__availability">{state.availability ?? 'checking'}</span>
      <span class="prompt-api__meta"
        >Tokens: {state.contextUsage ?? 0} used / {state.contextWindowAvailable ?? '—'} left</span
      >
      <button type="button" disabled={disabled || state.isProcessing} on:click={() => void run(api.clear)}
        >Clear chat</button
      >
      {#if state.isProcessing}<button type="button" on:click={api.interrupt}>Stop</button>{/if}
    </header>
    {#if state.downloadProgress > 0 && state.downloadProgress < 100}
      <progress value={state.downloadProgress} max="100" aria-label="Model download progress"></progress>
    {/if}
    {#if state.contextRestoreState.phase === 'summarizing'}<p role="status">
        Compressing earlier messages locally…
      </p>{/if}
    <ChatHistory {messages} isTyping={state.processing === 'send'} />
    {#if displayedError}<p class="prompt-api__error" role="alert">{displayedError}</p>{/if}
    <PromptInput
      value={draft}
      {attachments}
      {placeholder}
      {allowAttachments}
      {allowVoice}
      {sendOnEnter}
      {accept}
      {maxAttachments}
      {disabled}
      busy={state.isProcessing}
      onValueChange={(value) => (draft = value)}
      onAttachmentsChange={(value) => (attachments = value)}
      onSend={send}
      {onVoice}
    />
  </div>
  {#if pendingDelete}<div class="prompt-api__overlay" role="dialog" aria-modal="true" aria-label="Delete chat?">
      <div class="prompt-api__dialog">
        <h4>Delete chat?</h4>
        <p>This removes its locally saved history.</p>
        <button
          type="button"
          on:click={() => {
            pendingDelete = null;
          }}>Cancel</button
        >
        <button type="button" on:click={deleteChat}>Delete</button>
      </div>
    </div>{/if}
</div>
