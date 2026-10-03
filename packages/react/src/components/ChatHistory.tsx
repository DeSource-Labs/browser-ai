import { createChatViewport, formatRelativeTime, toDateTime } from '@desource/browser-ai/conversation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';

export interface ChatHistoryProps {
  messages: ChatMessage[];
  isTyping?: boolean;
  autoScroll?: boolean;
}

export function ChatHistory({ messages, isTyping = false, autoScroll = true }: ChatHistoryProps) {
  const history = useRef<HTMLDivElement>(null);
  const [viewport] = useState(createChatViewport);
  const [showLatest, setShowLatest] = useState(false);
  const lastContent = messages[messages.length - 1]?.content;
  const jump = useCallback(
    (force = false) => setShowLatest(viewport.update(history.current, autoScroll, force)),
    [viewport, autoScroll]
  );
  useEffect(() => jump(), [messages.length, lastContent, isTyping, jump]);
  useEffect(() => jump(true), [jump]);
  return (
    <div className="chat-history-shell">
      <div
        ref={history}
        onScroll={(event) => setShowLatest(viewport.scroll(event.currentTarget))}
        className="chat-history"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="chat-history__empty">Start a private, on-device conversation.</div>
        ) : (
          messages.map((message) => (
            <article className={`chat-message chat-message--${message.role}`} key={message.id}>
              <header className="chat-message__header">
                <span className="chat-message__role">{message.role === 'user' ? 'You' : 'Local AI'}</span>
                <time className="chat-message__time" dateTime={toDateTime(message.timestamp)}>
                  {formatRelativeTime(message.timestamp)}
                </time>
              </header>
              <div className="chat-message__content">
                <MarkdownRenderer content={message.content} />
              </div>
              {message.attachments?.length ? (
                <div className="chat-message__attachments">
                  {message.attachments.map((attachment) => (
                    <div className="chat-message__attachment" key={attachment.id}>
                      {attachment.type.startsWith('image/') && attachment.url ? (
                        <img src={attachment.url} alt={attachment.name} />
                      ) : (
                        <div className="chat-message__file">{attachment.name}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
        {isTyping && (
          <div className="chat-history__typing" role="status">
            Generating locally…
          </div>
        )}
      </div>
      {autoScroll && showLatest && (
        <button type="button" className="chat-history__latest" onClick={() => jump(true)}>
          Latest response ↓
        </button>
      )}
    </div>
  );
}
