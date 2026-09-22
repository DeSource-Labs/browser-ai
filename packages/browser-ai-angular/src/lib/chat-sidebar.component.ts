import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { ChatSidebarItem } from './types';

@Component({
  selector: 'browser-ai-chat-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="chat-sidebar" aria-label="Saved conversations">
      <button type="button" [disabled]="disabled()" data-browser-ai-action="create" (click)="create.emit()">
        New chat
      </button>
      <div class="chat-sidebar__list">
        @for (chat of chats(); track chat.id) {
          <article class="chat-sidebar__item" [class.is-active]="chat.id === activeChatId()">
            @if (editingId() === chat.id) {
              <form class="chat-sidebar__rename" (submit)="saveRename($event, chat.id)">
                <label [for]="'rename-' + chat.id">Conversation name</label>
                <input
                  [id]="'rename-' + chat.id"
                  [value]="renameDraft()"
                  maxlength="80"
                  (input)="updateRename($event)"
                />
                <button
                  type="submit"
                  [disabled]="disabled() || !renameDraft().trim()"
                  data-browser-ai-action="save-rename"
                >
                  Save
                </button>
                <button
                  type="button"
                  [disabled]="disabled()"
                  data-browser-ai-action="cancel-rename"
                  (click)="cancelRename()"
                >
                  Cancel
                </button>
              </form>
            } @else {
              <button
                type="button"
                [disabled]="disabled()"
                data-browser-ai-action="select"
                (click)="select.emit(chat.id)"
              >
                {{ chat.title }}
              </button>
              <button
                type="button"
                [disabled]="disabled()"
                [attr.aria-label]="'Rename ' + chat.title"
                (click)="beginRename(chat)"
              >
                Rename
              </button>
              <button
                type="button"
                [disabled]="disabled()"
                [attr.aria-label]="'Delete ' + chat.title"
                (click)="delete.emit(chat.id)"
              >
                ×
              </button>
            }
          </article>
        }
      </div>
    </aside>
  `
})
export class BrowserAiChatSidebarComponent {
  readonly chats = input<readonly ChatSidebarItem[]>([]);
  readonly activeChatId = input<string | null>(null);
  readonly disabled = input(false);
  readonly create = output<void>();
  readonly select = output<string>();
  readonly rename = output<{ id: string; title: string }>();
  readonly delete = output<string>();
  readonly editingId = signal<string | null>(null);
  readonly renameDraft = signal('');

  beginRename(chat: ChatSidebarItem) {
    this.editingId.set(chat.id);
    this.renameDraft.set(chat.title);
  }

  updateRename(event: Event) {
    this.renameDraft.set((event.currentTarget as HTMLInputElement).value);
  }

  cancelRename() {
    this.editingId.set(null);
    this.renameDraft.set('');
  }

  saveRename(event: Event, id: string) {
    event.preventDefault();
    const title = this.renameDraft().trim();
    if (!title) return;
    this.rename.emit({ id, title });
    this.cancelRename();
  }
}
