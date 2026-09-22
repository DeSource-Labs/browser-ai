import { PROMPT_FILE_ACCEPT } from '@desource/browser-ai';
import {
  createConversation,
  createConversationView,
  conversationAttachments,
  conversationMessages,
  type ConversationOptions
} from '@desource/browser-ai/conversation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorText } from '../component-utils.js';
import { useController } from '../hooks/useController.js';
import type { ChatAttachment, ChatMessage } from '../types.js';
import { ChatHistory } from './ChatHistory.js';
import { ChatSidebar } from './ChatSidebar.js';
import { PromptInput } from './PromptInput.js';

export interface PromptApiProps extends Omit<ConversationOptions, 'initialMessages'> {
  initialMessages?: ChatMessage[];
  placeholder?: string;
  allowAttachments?: boolean;
  allowVoice?: boolean;
  sendOnEnter?: boolean;
  clearOnSend?: boolean;
  accept?: string;
  maxAttachments?: number;
  disabled?: boolean;
  onMessagesChange?(messages: ChatMessage[]): void;
  onError?(error: unknown): void;
  onVoice?(): void;
}

export function PromptApi({
  initialMessages = [],
  placeholder,
  allowAttachments = true,
  allowVoice = false,
  sendOnEnter = true,
  clearOnSend = true,
  accept = PROMPT_FILE_ACCEPT,
  maxAttachments = 6,
  disabled = false,
  onMessagesChange,
  onError,
  onVoice,
  ...options
}: PromptApiProps) {
  const previousOptions = useRef(options);
  const api = useController(
    () => createConversation({ ...options, initialMessages: conversationMessages(initialMessages) }),
    (controller) => {
      controller.configure({
        ...Object.fromEntries(Object.keys(previousOptions.current).map((key) => [key, undefined])),
        ...options
      });
      previousOptions.current = options;
    }
  );
  const [view] = useState(() => createConversationView(initialMessages));
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const messages = useMemo(() => view.messages(api.messages), [view, api.messages]);
  const errorCallback = useRef(onError);
  useEffect(() => {
    errorCallback.current = onError;
  }, [onError]);
  const report = useCallback((caught: unknown) => {
    setError(errorText(caught));
    errorCallback.current?.(caught);
  }, []);
  const run = async (operation: () => Promise<unknown>) => {
    setError('');
    try {
      await operation();
    } catch (caught) {
      report(caught);
    }
  };
  const load = api.load;
  useEffect(() => {
    void load().catch(report);
    return () => view.dispose();
  }, [load, report, view]);
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);
  const send = async () => {
    if (disabled || api.isProcessing || (!draft.trim() && !attachments.length)) return;
    await run(async () => {
      const selected = conversationAttachments(attachments);
      const result = await api.send(draft.trim(), selected);
      if (result !== null && clearOnSend) {
        setDraft((current) => (current === draft ? '' : current));
        setAttachments((current) => current.filter((attachment) => !attachments.includes(attachment)));
      }
    });
  };
  const selectedChat = api.chats.find((chat) => chat.id === api.activeChatId);
  const requestError = error || (api.error == null ? '' : errorText(api.error));
  return (
    <div className="prompt-api">
      <ChatSidebar
        chats={api.chats.map((chat) => ({ ...chat, preview: chat.messages[chat.messages.length - 1]?.content }))}
        activeChatId={api.activeChatId}
        disabled={disabled || api.isProcessing}
        onCreate={() => void run(() => api.createChat())}
        onSelect={(id) => void run(() => api.selectChat(id))}
        onRename={(id, title) => void run(() => api.renameChat(id, title))}
        onDelete={setPendingDelete}
      />
      <div className="prompt-api__main">
        <header className="prompt-api__header">
          <h3 className="prompt-api__title">{selectedChat?.title ?? 'New chat'}</h3>
          <span className="prompt-api__availability">{api.availability ?? 'checking'}</span>
          <span className="prompt-api__meta">
            Tokens: {api.contextUsage ?? 0} used / {api.contextWindowAvailable ?? '—'} left
          </span>
          {api.modelProcessing === 'create' && (
            <progress aria-label="Model download progress" value={api.downloadProgress} max={100} />
          )}
          <button type="button" disabled={disabled || api.isProcessing} onClick={() => void run(api.clear)}>
            Clear chat
          </button>
          {api.isProcessing && (
            <button type="button" onClick={api.interrupt}>
              Stop
            </button>
          )}
        </header>
        {api.contextRestoreState.phase === 'summarizing' && <p role="status">Compressing earlier messages locally…</p>}
        <ChatHistory messages={messages} isTyping={api.processing === 'send'} />
        {requestError && (
          <p className="prompt-api__error" role="alert">
            {requestError}
          </p>
        )}
        <PromptInput
          value={draft}
          attachments={attachments}
          placeholder={placeholder}
          allowAttachments={allowAttachments}
          allowVoice={allowVoice}
          sendOnEnter={sendOnEnter}
          accept={accept}
          maxAttachments={maxAttachments}
          disabled={disabled}
          busy={api.isProcessing}
          onChange={setDraft}
          onAttachmentsChange={setAttachments}
          onSend={() => void send()}
          onVoice={onVoice}
        />
      </div>
      {pendingDelete && (
        <div className="prompt-api__overlay" role="dialog" aria-modal="true" aria-label="Delete chat?">
          <div className="prompt-api__dialog">
            <h4>Delete chat?</h4>
            <p>This removes its locally saved history.</p>
            <button type="button" onClick={() => setPendingDelete(null)}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const id = pendingDelete;
                setPendingDelete(null);
                void run(() => api.deleteChat(id));
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
