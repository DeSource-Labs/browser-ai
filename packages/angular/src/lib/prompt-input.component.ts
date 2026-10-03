import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  input,
  model,
  output,
  viewChild
} from '@angular/core';
import { PROMPT_FILE_ACCEPT } from '@desource/browser-ai';
import type { ChatAttachment } from './types';

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

@Component({
  selector: 'browser-ai-prompt-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="prompt-input">
      @if (attachments().length) {
        <div class="prompt-input__attachments">
          @for (attachment of attachments(); track attachment.id) {
            <div class="prompt-input__attachment">
              @if (attachment.type.startsWith('image/') && attachment.url) {
                <img [src]="attachment.url" [alt]="attachment.name" />
              } @else {
                <div class="prompt-input__file">{{ attachment.name }}</div>
              }
              <button
                class="prompt-input__remove"
                type="button"
                [attr.aria-label]="'Remove ' + attachment.name"
                (click)="remove(attachment.id)"
              >
                ×
              </button>
            </div>
          }
        </div>
      }
      <div class="prompt-input__row">
        @if (allowVoice()) {
          <button
            class="prompt-input__icon"
            type="button"
            aria-label="Start voice input"
            [disabled]="disabled()"
            (click)="voice.emit()"
          >
            ●
          </button>
        }
        @if (allowAttachments()) {
          <button
            class="prompt-input__icon"
            type="button"
            aria-label="Attach files"
            [disabled]="disabled()"
            (click)="fileInput().nativeElement.click()"
          >
            +
          </button>
          <input
            #attachmentInput
            class="prompt-input__file-input"
            type="file"
            multiple
            [accept]="accept()"
            [disabled]="disabled()"
            (change)="selectFiles($event)"
          />
        }
        <textarea
          class="prompt-input__field"
          rows="1"
          [value]="value()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          (input)="updateValue($event)"
          (keydown)="keyDown($event)"
        ></textarea>
        <button
          class="prompt-input__send"
          type="button"
          aria-label="Send prompt"
          [disabled]="disabled() || busy() || (!value().trim() && !attachments().length)"
          (click)="send.emit()"
        >
          Send
        </button>
      </div>
    </div>
  `
})
export class BrowserAiPromptInputComponent {
  readonly value = model('');
  readonly attachments = model<ChatAttachment[]>([]);
  readonly placeholder = input('Ask the assistant...');
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly sendOnEnter = input(true);
  readonly allowAttachments = input(false);
  readonly allowVoice = input(false);
  readonly accept = input(PROMPT_FILE_ACCEPT);
  readonly maxAttachments = input<number | undefined>(undefined);
  readonly send = output<void>();
  readonly voice = output<void>();
  readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('attachmentInput');
  private readonly createdUrls = new Set<string>();

  constructor(destroyRef: DestroyRef) {
    effect(() => {
      const active = new Set<string>();
      for (const attachment of this.attachments()) {
        if (attachment.url) active.add(attachment.url);
      }
      this.createdUrls.forEach((url) => {
        if (!active.has(url)) {
          URL.revokeObjectURL(url);
          this.createdUrls.delete(url);
        }
      });
    });
    destroyRef.onDestroy(() => {
      this.createdUrls.forEach((url) => URL.revokeObjectURL(url));
      this.createdUrls.clear();
    });
  }

  updateValue(event: Event) {
    this.value.set((event.currentTarget as HTMLTextAreaElement).value);
  }

  selectFiles(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const limit = this.maxAttachments();
    const available = limit == null ? Number.POSITIVE_INFINITY : Math.max(limit - this.attachments().length, 0);
    const selected = Array.from(input.files ?? [])
      .slice(0, available)
      .map((file) => {
        const url = URL.createObjectURL(file);
        this.createdUrls.add(url);
        return { id: createId(), file, url, name: file.name, type: file.type };
      });
    this.attachments.update((current) => [...current, ...selected]);
    input.value = '';
  }

  remove(id: string) {
    const attachment = this.attachments().find((item) => item.id === id);
    if (attachment?.url && this.createdUrls.has(attachment.url)) {
      URL.revokeObjectURL(attachment.url);
      this.createdUrls.delete(attachment.url);
    }
    this.attachments.update((current) => current.filter((item) => item.id !== id));
  }

  keyDown(event: KeyboardEvent) {
    if (
      !this.sendOnEnter() ||
      event.isComposing ||
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if ((this.value().trim() || this.attachments().length) && !this.disabled() && !this.busy()) this.send.emit();
  }
}
