import { type ChangeEvent, type KeyboardEvent, useEffect, useRef } from 'react';
import { createId, PROMPT_FILE_ACCEPT } from '../component-utils.js';
import type { ChatAttachment } from '../types.js';

export interface PromptInputProps {
  value: string;
  attachments?: ChatAttachment[];
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  sendOnEnter?: boolean;
  allowAttachments?: boolean;
  allowVoice?: boolean;
  accept?: string;
  maxAttachments?: number;
  onChange(value: string): void;
  onAttachmentsChange?(attachments: ChatAttachment[]): void;
  onSend(): void;
  onVoice?(): void;
}

export function PromptInput({
  value,
  attachments = [],
  placeholder = 'Ask the assistant...',
  disabled = false,
  busy = false,
  sendOnEnter = true,
  allowAttachments = false,
  allowVoice = false,
  accept = PROMPT_FILE_ACCEPT,
  maxAttachments,
  onChange,
  onAttachmentsChange,
  onSend,
  onVoice
}: PromptInputProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const createdUrls = useRef(new Set<string>());

  useEffect(
    () => () => {
      createdUrls.current.forEach((url) => URL.revokeObjectURL(url));
      createdUrls.current.clear();
    },
    []
  );
  useEffect(() => {
    const active = new Set(attachments.flatMap((attachment) => (attachment.url ? [attachment.url] : [])));
    createdUrls.current.forEach((url) => {
      if (!active.has(url)) {
        URL.revokeObjectURL(url);
        createdUrls.current.delete(url);
      }
    });
  }, [attachments]);

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const available =
      maxAttachments == null ? Number.POSITIVE_INFINITY : Math.max(maxAttachments - attachments.length, 0);
    const next = Array.from(event.currentTarget.files ?? [])
      .slice(0, available)
      .map((file) => {
        const url = URL.createObjectURL(file);
        createdUrls.current.add(url);
        return { id: createId(), file, url, name: file.name, type: file.type };
      });
    onAttachmentsChange?.([...attachments, ...next]);
    event.currentTarget.value = '';
  };
  const remove = (id: string) => {
    const item = attachments.find((attachment) => attachment.id === id);
    if (item?.url && createdUrls.current.has(item.url)) {
      URL.revokeObjectURL(item.url);
      createdUrls.current.delete(item.url);
    }
    onAttachmentsChange?.(attachments.filter((attachment) => attachment.id !== id));
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      !sendOnEnter ||
      event.nativeEvent.isComposing ||
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

  return (
    <div className="prompt-input">
      {attachments.length > 0 && (
        <div className="prompt-input__attachments">
          {attachments.map((attachment) => (
            <div className="prompt-input__attachment" key={attachment.id}>
              {attachment.type.startsWith('image/') && attachment.url ? (
                <img src={attachment.url} alt={attachment.name} />
              ) : (
                <div className="prompt-input__file">{attachment.name}</div>
              )}
              <button
                className="prompt-input__remove"
                type="button"
                aria-label={`Remove ${attachment.name}`}
                onClick={() => remove(attachment.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="prompt-input__row">
        {allowVoice && (
          <button
            className="prompt-input__icon"
            type="button"
            disabled={disabled}
            aria-label="Start voice input"
            onClick={onVoice}
          >
            ●
          </button>
        )}
        {allowAttachments && (
          <>
            <button
              className="prompt-input__icon"
              type="button"
              disabled={disabled}
              aria-label="Attach files"
              onClick={() => fileInput.current?.click()}
            >
              +
            </button>
            <input
              ref={fileInput}
              className="prompt-input__file-input"
              type="file"
              multiple
              accept={accept}
              disabled={disabled}
              onChange={selectFiles}
            />
          </>
        )}
        <textarea
          className="prompt-input__field"
          rows={1}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={keyDown}
        />
        <button
          className="prompt-input__send"
          type="button"
          aria-label="Send prompt"
          disabled={disabled || busy || (!value.trim() && attachments.length === 0)}
          onClick={onSend}
        >
          Send
        </button>
      </div>
    </div>
  );
}
