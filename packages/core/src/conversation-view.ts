import type { BrowserAiAttachment } from './attachments.js';
import type { ConversationMessage } from './conversation.js';

/** Preview metadata belongs to the UI and is never written to conversation storage. */
export interface ConversationAttachmentView {
  id: string;
  name: string;
  type: string;
  file?: File;
  url?: string;
}
export interface ConversationMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  attachments?: ConversationAttachmentView[];
}

export const conversationAttachments = (attachments: readonly ConversationAttachmentView[]): BrowserAiAttachment[] =>
  attachments.map(({ id, name, type, file }) => {
    if (!file) throw new TypeError(`Attachment “${name}” has no backing File.`);
    return { id, name, type, value: file };
  });

export const conversationMessages = (messages: readonly ConversationMessageView[]): ConversationMessage[] =>
  messages.map(({ attachments, timestamp, ...message }) => {
    const files = attachments?.filter(({ file }) => file);
    return {
      ...message,
      timestamp: timestamp ?? Date.now(),
      ...(files?.length ? { attachments: conversationAttachments(files) } : {})
    };
  });

/** Retains visible Blob URLs and display-only initial metadata; never revokes caller-owned URLs. */
export const createConversationView = (initialMessages: readonly ConversationMessageView[] = []) => {
  const urls = new Map<Blob, string>();
  const initialPreviews = new Map<string, { attachments: ConversationAttachmentView[]; order: Map<string, number> }>();
  for (const message of initialMessages) {
    const attachments = message.attachments;
    if (!attachments?.some(({ file }) => !file)) continue;
    initialPreviews.set(message.id, {
      attachments: attachments.filter(({ file }) => !file).map((attachment) => ({ ...attachment })),
      order: new Map(attachments.map(({ id }, index) => [id, index]))
    });
  }
  return {
    messages(messages: readonly ConversationMessage[]): ConversationMessageView[] {
      const visible = new Set(
        messages.flatMap((message) => message.attachments?.map((attachment) => attachment.value) ?? [])
      );
      urls.forEach((url, blob) => {
        if (!visible.has(blob)) {
          URL.revokeObjectURL(url);
          urls.delete(blob);
        }
      });
      return messages.map(({ attachments, ...message }) => {
        const mapped: ConversationAttachmentView[] =
          attachments?.map((attachment, index) => {
            const blob = typeof Blob !== 'undefined' && attachment.value instanceof Blob ? attachment.value : undefined;
            const file = typeof File !== 'undefined' && attachment.value instanceof File ? attachment.value : undefined;
            if (blob && !urls.has(blob)) urls.set(blob, URL.createObjectURL(blob));
            return {
              id: attachment.id ?? `${message.id}-${index}`,
              name: attachment.name ?? file?.name ?? 'Attachment',
              type: attachment.type ?? blob?.type ?? '',
              ...(file ? { file } : {}),
              ...(blob ? { url: urls.get(blob) } : {})
            };
          }) ?? [];
        const previews = initialPreviews.get(message.id);
        if (previews) {
          const ids = new Set(mapped.map(({ id }) => id));
          for (const attachment of previews.attachments) {
            if (ids.has(attachment.id)) continue;
            mapped.push({ ...attachment });
            ids.add(attachment.id);
          }
          mapped.sort(
            (left, right) =>
              (previews.order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
              (previews.order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
          );
        }
        return { ...message, ...(mapped.length ? { attachments: mapped } : {}) };
      });
    },
    dispose() {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      initialPreviews.clear();
    }
  };
};

type ChatViewport = Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>;
/** Keep reading position stable while output streams; jump only when already at the end. */
export const createChatViewport = () => {
  let pinned = true;
  let unseen = false;
  return {
    scroll(element: ChatViewport) {
      pinned = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
      if (pinned) unseen = false;
      return unseen;
    },
    update(element: ChatViewport | null | undefined, enabled = true, force = false) {
      if (!enabled || !element) return false;
      if (force || pinned) {
        element.scrollTop = element.scrollHeight;
        pinned = true;
        unseen = false;
      } else unseen = true;
      return unseen;
    }
  };
};

export const formatRelativeTime = (timestamp?: number, now = Date.now()) => {
  if (timestamp === undefined || !Number.isFinite(timestamp) || Math.abs(timestamp) > 8.64e15) return 'just now';

  const elapsedSeconds = Math.max(Math.floor((now - timestamp) / 1000), 0);
  if (elapsedSeconds < 60) return 'just now';

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

export const toDateTime = (timestamp?: number) => {
  const valid = timestamp !== undefined && Number.isFinite(timestamp) && Math.abs(timestamp) <= 8.64e15;
  return new Date(valid ? timestamp : Date.now()).toISOString();
};
