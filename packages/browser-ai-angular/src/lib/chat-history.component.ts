import { createChatViewport, formatRelativeTime, toDateTime } from '@desource/browser-ai/conversation';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  signal,
  viewChild
} from '@angular/core';
import { BrowserAiMarkdownRendererComponent } from './markdown-renderer.component';
import type { ChatMessage } from './types';

@Component({
  selector: 'browser-ai-chat-history',
  standalone: true,
  imports: [BrowserAiMarkdownRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chat-history-shell">
      <div
        #history
        (scroll)="handleScroll()"
        class="chat-history"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        @if (!messages().length) {
          <div class="chat-history__empty">Start a private, on-device conversation.</div>
        } @else {
          @for (message of messages(); track message.id) {
            <article
              class="chat-message"
              [class.chat-message--user]="message.role === 'user'"
              [class.chat-message--assistant]="message.role === 'assistant'"
            >
              <header class="chat-message__header">
                <span class="chat-message__role">{{ message.role === 'user' ? 'You' : 'Local AI' }}</span
                ><time class="chat-message__time" [attr.datetime]="toDateTime(message.timestamp)">{{
                  formatRelativeTime(message.timestamp)
                }}</time>
              </header>
              <div class="chat-message__content"><browser-ai-markdown [content]="message.content" /></div>
              @if (message.attachments?.length) {
                <div class="chat-message__attachments">
                  @for (attachment of message.attachments; track attachment.id) {
                    <div class="chat-message__attachment">
                      @if (attachment.type.startsWith('image/') && attachment.url) {
                        <img [src]="attachment.url" [alt]="attachment.name" />
                      } @else {
                        <div class="chat-message__file">{{ attachment.name }}</div>
                      }
                    </div>
                  }
                </div>
              }
            </article>
          }
        }
        @if (isTyping()) {
          <div class="chat-history__typing" role="status">Generating locally…</div>
        }
      </div>
      @if (autoScroll() && showLatest()) {
        <button type="button" class="chat-history__latest" (click)="jump(true)">Latest response ↓</button>
      }
    </div>
  `
})
export class BrowserAiChatHistoryComponent {
  readonly messages = input<ChatMessage[]>([]);
  readonly isTyping = input(false);
  readonly autoScroll = input(true);
  readonly showLatest = signal(false);
  readonly history = viewChild<ElementRef<HTMLDivElement>>('history');
  readonly formatRelativeTime = formatRelativeTime;
  readonly toDateTime = toDateTime;
  private readonly viewport = createChatViewport();
  private wasAuto = false;
  constructor() {
    afterRenderEffect(() => {
      this.messages();
      this.isTyping();
      this.jump(this.autoScroll() && !this.wasAuto);
      this.wasAuto = this.autoScroll();
    });
  }
  handleScroll() {
    const element = this.history()?.nativeElement;
    if (element) this.showLatest.set(this.viewport.scroll(element));
  }
  jump(force = false) {
    this.showLatest.set(this.viewport.update(this.history()?.nativeElement, this.autoScroll(), force));
  }
}
