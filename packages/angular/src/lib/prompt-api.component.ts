import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  input,
  model,
  output,
  type OnInit,
  type OnChanges
} from '@angular/core';
import { PROMPT_FILE_ACCEPT } from '@desource/browser-ai';
import {
  createConversation,
  createConversationView,
  conversationAttachments,
  conversationMessages,
  type ConversationOptions
} from '@desource/browser-ai/conversation';
import { toAngularController, type AngularBrowserAiController } from './controllers/controller';
import { BrowserAiChatHistoryComponent } from './chat.component';
import { BrowserAiChatSidebarComponent } from './chat-sidebar.component';
import { BrowserAiPromptInputComponent } from './prompt-input.component';
import type { ChatAttachment, ChatMessage } from './types';

@Component({
  selector: 'browser-ai-prompt-api',
  standalone: true,
  imports: [BrowserAiChatHistoryComponent, BrowserAiChatSidebarComponent, BrowserAiPromptInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="prompt-api">
      <browser-ai-chat-sidebar
        [chats]="api.current().chats"
        [activeChatId]="api.current().activeChatId"
        [disabled]="disabled() || api.isProcessing()"
        (create)="createChat()"
        (select)="selectChat($event)"
        (rename)="renameChat($event.id, $event.title)"
        (delete)="pendingDelete.set($event)"
      />
      <div class="prompt-api__main">
        <header class="prompt-api__header">
          <h3 class="prompt-api__title">{{ activeTitle() }}</h3>
          <span class="prompt-api__availability">{{ api.current().availability ?? 'checking' }}</span>
          <span class="prompt-api__meta"
            >Tokens: {{ api.current().contextUsage ?? 0 }} used /
            {{ api.current().contextWindowAvailable ?? '—' }} left</span
          >
          <button type="button" [disabled]="disabled() || api.isProcessing()" (click)="clear()">Clear chat</button>
          @if (api.isProcessing()) {
            <button type="button" (click)="api.interrupt()">Stop</button>
          }
        </header>
        @if (api.current().downloadProgress > 0 && api.current().downloadProgress < 100) {
          <progress [value]="api.current().downloadProgress" max="100" aria-label="Model download progress"></progress>
        }
        @if (api.current().contextRestoreState.phase === 'summarizing') {
          <p role="status">Compressing earlier messages locally…</p>
        }
        <browser-ai-chat-history [messages]="messages()" [isTyping]="api.current().processing === 'send'" />
        @if (errorText()) {
          <p class="prompt-api__error" role="alert">{{ errorText() }}</p>
        }
        <browser-ai-prompt-input
          [(value)]="draft"
          [(attachments)]="attachments"
          [placeholder]="placeholder()"
          [allowAttachments]="allowAttachments()"
          [allowVoice]="allowVoice()"
          [sendOnEnter]="sendOnEnter()"
          [accept]="accept()"
          [maxAttachments]="maxAttachments()"
          [disabled]="disabled()"
          [busy]="api.isProcessing()"
          (send)="send()"
          (voice)="voice.emit()"
        />
      </div>
      @if (pendingDelete()) {
        <div class="prompt-api__overlay" role="dialog" aria-modal="true" aria-label="Delete chat?">
          <div class="prompt-api__dialog">
            <h4>Delete chat?</h4>
            <p>This removes its locally saved history.</p>
            <button type="button" (click)="pendingDelete.set(null)">Cancel</button>
            <button type="button" (click)="deleteChat()">Delete</button>
          </div>
        </div>
      }
    </div>
  `
})
export class BrowserAiPromptApiComponent implements OnInit, OnChanges {
  readonly chatKey = input<string>('prompt-api');
  readonly modelOptions = input<LanguageModelCreateCoreOptions>({});
  readonly systemPrompt = input<string>('');
  readonly autoInit = input<boolean>(true);
  readonly autoCreate = input<boolean>(true);
  readonly streaming = input<boolean>(true);
  readonly promptOptions = input<ConversationOptions['promptOptions']>(undefined);
  readonly maxMessages = input<number | undefined>(undefined);
  readonly contextStrategy = input<ConversationOptions['contextStrategy']>('summarize');
  readonly contextSummaryMode = input<ConversationOptions['contextSummaryMode']>('cache-first');
  readonly contextBudgetRatio = input<number>(0.88);
  readonly contextSummaryChunkBudgetRatio = input<number>(0.18);
  readonly contextSummaryMaxCharacters = input<number>(0);
  readonly contextSummaryTimeoutMs = input<number>(15_000);
  readonly contextSummaryBackgroundTimeoutMs = input<number>(60_000);
  readonly autoCompactContext = input<boolean>(true);
  readonly contextCompactionThresholdRatio = input<number>(0.22);
  readonly contextCompactionSummaryMode = input<ConversationOptions['contextCompactionSummaryMode']>('eager');
  readonly placeholder = input<string>('Ask the assistant...');
  readonly allowAttachments = input<boolean>(true);
  readonly allowVoice = input<boolean>(false);
  readonly sendOnEnter = input<boolean>(true);
  readonly clearOnSend = input<boolean>(true);
  readonly accept = input<string>(PROMPT_FILE_ACCEPT);
  readonly maxAttachments = input<number | undefined>(6);
  readonly disabled = input<boolean>(false);
  readonly messages = model<ChatMessage[]>([]);
  readonly initialMessages = input<ChatMessage[] | undefined>(undefined);
  readonly draft = model('');
  readonly attachments = model<ChatAttachment[]>([]);
  readonly pendingDelete = model<string | null>(null);
  readonly error = model('');
  readonly requestError = output<unknown>();
  readonly voice = output<void>();
  private view?: ReturnType<typeof createConversationView>;
  private controller?: AngularBrowserAiController<ReturnType<typeof createConversation>>;
  constructor(private readonly destroyRef: DestroyRef) {
    destroyRef.onDestroy(() => this.view?.dispose());
  }
  get api() {
    return (this.controller ??= toAngularController(
      createConversation({
        ...this.configuration(),
        chatKey: this.chatKey(),
        initialMessages: conversationMessages(this.initialMessages() ?? this.messages())
      }),
      this.destroyRef
    ));
  }
  private configuration(): ConversationOptions {
    return {
      modelOptions: this.modelOptions(),
      systemPrompt: this.systemPrompt(),
      autoInit: this.autoInit(),
      autoCreate: this.autoCreate(),
      streaming: this.streaming(),
      promptOptions: this.promptOptions(),
      maxMessages: this.maxMessages(),
      contextStrategy: this.contextStrategy(),
      contextSummaryMode: this.contextSummaryMode(),
      contextBudgetRatio: this.contextBudgetRatio(),
      contextSummaryChunkBudgetRatio: this.contextSummaryChunkBudgetRatio(),
      contextSummaryMaxCharacters: this.contextSummaryMaxCharacters(),
      contextSummaryTimeoutMs: this.contextSummaryTimeoutMs(),
      contextSummaryBackgroundTimeoutMs: this.contextSummaryBackgroundTimeoutMs(),
      autoCompactContext: this.autoCompactContext(),
      contextCompactionThresholdRatio: this.contextCompactionThresholdRatio(),
      contextCompactionSummaryMode: this.contextCompactionSummaryMode()
    };
  }
  ngOnChanges() {
    this.controller?.configure(this.configuration());
  }
  ngOnInit() {
    this.view = createConversationView(this.initialMessages() ?? this.messages());
    const view = this.view;
    const unsubscribe = this.api.state.subscribe(() => this.messages.set(view.messages(this.api.current().messages)));
    this.destroyRef.onDestroy(unsubscribe);
    void this.run(this.api.load);
  }
  activeTitle() {
    return this.api.current().chats.find((chat) => chat.id === this.api.current().activeChatId)?.title ?? 'New chat';
  }
  errorText() {
    const error = this.error() || this.api.current().error;
    return error instanceof Error ? error.message : error ? String(error) : '';
  }
  private async run(operation: () => Promise<unknown>) {
    this.error.set('');
    try {
      await operation();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Browser AI request failed.');
      this.requestError.emit(error);
    }
  }
  async send() {
    if (this.disabled() || this.api.isProcessing() || (!this.draft().trim() && !this.attachments().length)) return;
    await this.run(async () => {
      const draft = this.draft();
      const attachments = this.attachments();
      const result = await this.api.send(draft.trim(), conversationAttachments(attachments));
      if (result !== null && this.clearOnSend()) {
        if (this.draft() === draft) this.draft.set('');
        this.attachments.update((current) => current.filter((attachment) => !attachments.includes(attachment)));
      }
    });
  }
  createChat() {
    return this.run(() => this.api.createChat());
  }
  selectChat(id: string) {
    return this.run(() => this.api.selectChat(id));
  }
  renameChat(id: string, title: string) {
    return this.run(() => this.api.renameChat(id, title));
  }
  clear() {
    return this.run(this.api.clear);
  }
  deleteChat() {
    const id = this.pendingDelete();
    this.pendingDelete.set(null);
    return id ? this.run(() => this.api.deleteChat(id)) : Promise.resolve();
  }
}
