import { useState } from 'react';
import type { ChatSidebarItem } from '../types.js';

export interface ChatSidebarProps {
  chats: ChatSidebarItem[];
  activeChatId: string | null;
  disabled?: boolean;
  onCreate?(): void;
  onSelect?(id: string): void;
  onRename?(id: string, title: string): void;
  onDelete?(id: string): void;
}

export function ChatSidebar({
  chats,
  activeChatId,
  disabled = false,
  onCreate,
  onSelect,
  onRename,
  onDelete
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const beginRename = (chat: ChatSidebarItem) => {
    setEditingId(chat.id);
    setDraft(chat.title);
  };
  const saveRename = (id: string) => {
    const title = draft.trim();
    if (!title) return;
    onRename?.(id, title);
    setEditingId(null);
    setDraft('');
  };

  return (
    <aside className="chat-sidebar" aria-label="Saved conversations">
      <button type="button" disabled={disabled} data-browser-ai-action="create" onClick={onCreate}>
        New chat
      </button>
      <div className="chat-sidebar__list">
        {chats.map((chat) => (
          <article
            className={chat.id === activeChatId ? 'chat-sidebar__item is-active' : 'chat-sidebar__item'}
            key={chat.id}
          >
            {editingId === chat.id ? (
              <form
                className="chat-sidebar__rename"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveRename(chat.id);
                }}
              >
                <label htmlFor={`rename-${chat.id}`}>Conversation name</label>
                <input
                  id={`rename-${chat.id}`}
                  value={draft}
                  maxLength={80}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                />
                <button type="submit" data-browser-ai-action="save-rename" disabled={disabled || !draft.trim()}>
                  Save
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  data-browser-ai-action="cancel-rename"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  disabled={disabled}
                  data-browser-ai-action="select"
                  onClick={() => onSelect?.(chat.id)}
                >
                  {chat.title}
                </button>
                {onRename && (
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Rename ${chat.title}`}
                    onClick={() => beginRename(chat)}
                  >
                    Rename
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Delete ${chat.title}`}
                    onClick={() => onDelete(chat.id)}
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}
