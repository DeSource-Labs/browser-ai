import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  BrowserAiChatHistoryComponent,
  BrowserAiChatSidebarComponent,
  BrowserAiLanguageDetectorComponent,
  BrowserAiMarkdownRendererComponent,
  BrowserAiPromptApiComponent,
  BrowserAiPromptInputComponent,
  BrowserAiProofreaderComponent,
  BrowserAiRewriterComponent,
  BrowserAiSummarizerComponent,
  BrowserAiTranslatorComponent,
  BrowserAiWriterComponent,
  createAngularWebMcp,
  type ChatMessage,
  type ChatSidebarItem
} from '../../src/public-api';
import {
  createDemoTaskTool,
  executeDemoTaskTool,
  createPersonTask,
  inspectDemoCapabilities,
  type DemoCapability,
  type DemoTask
} from '../../../../common/demo/capabilities';

@Component({
  selector: 'browser-ai-demo',
  standalone: true,
  imports: [
    BrowserAiChatHistoryComponent,
    BrowserAiChatSidebarComponent,
    BrowserAiLanguageDetectorComponent,
    BrowserAiMarkdownRendererComponent,
    BrowserAiPromptApiComponent,
    BrowserAiPromptInputComponent,
    BrowserAiProofreaderComponent,
    BrowserAiRewriterComponent,
    BrowserAiSummarizerComponent,
    BrowserAiTranslatorComponent,
    BrowserAiWriterComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="demo-shell">
      <header class="demo-hero">
        <p class="demo-kicker" data-testid="framework">Angular</p>
        <h1>Chrome AI, without the framework glue.</h1>
        <p>
          The complete Angular component, signal-controller, and service surface: Prompt API chat, six writing tools,
          multimodal attachments, and WebMCP.
        </p>
      </header>

      <section class="demo-capabilities" data-testid="api-capabilities" aria-label="Browser capabilities">
        @for (capability of capabilities(); track capability.name) {
          <div class="demo-capability">
            <span>{{ capability.name }}</span
            ><strong>{{ capability.availability }}</strong>
          </div>
        }
      </section>

      <div class="demo-grid">
        <section class="demo-card demo-card--prompt" data-component="PromptApi">
          <header>
            <h2>PromptApi</h2>
            <code>&lt;browser-ai-prompt-api /&gt;</code>
          </header>
          <browser-ai-prompt-api />
        </section>
        <section class="demo-card demo-card--tool" data-component="Summarizer">
          <header>
            <h2>Summarizer</h2>
            <code>&lt;browser-ai-summarizer /&gt;</code>
          </header>
          <browser-ai-summarizer [value]="summarizerText()" (valueChange)="summarizerText.set($event)" />
        </section>
        <section class="demo-card demo-card--tool" data-component="Writer">
          <header>
            <h2>Writer</h2>
            <code>&lt;browser-ai-writer /&gt;</code>
          </header>
          <browser-ai-writer [value]="writerText()" (valueChange)="writerText.set($event)" />
        </section>
        <section class="demo-card demo-card--tool" data-component="Rewriter">
          <header>
            <h2>Rewriter</h2>
            <code>&lt;browser-ai-rewriter /&gt;</code>
          </header>
          <browser-ai-rewriter [value]="rewriterText()" (valueChange)="rewriterText.set($event)" />
        </section>
        <section class="demo-card demo-card--tool" data-component="Translator">
          <header>
            <h2>Translator</h2>
            <code>&lt;browser-ai-translator /&gt;</code>
          </header>
          <browser-ai-translator
            sourceLanguage="en"
            targetLanguage="fr"
            [value]="translatorText()"
            (valueChange)="translatorText.set($event)"
          />
        </section>
        <section class="demo-card demo-card--tool" data-component="LanguageDetector">
          <header>
            <h2>LanguageDetector</h2>
            <code>&lt;browser-ai-language-detector /&gt;</code>
          </header>
          <browser-ai-language-detector [value]="detectorText()" (valueChange)="detectorText.set($event)" />
        </section>
        <section class="demo-card demo-card--tool" data-component="Proofreader">
          <header>
            <h2>Proofreader</h2>
            <code>&lt;browser-ai-proofreader /&gt;</code>
          </header>
          <browser-ai-proofreader [value]="proofreaderText()" (valueChange)="proofreaderText.set($event)" />
        </section>

        <div class="demo-primitives">
          <section class="demo-card" data-component="ChatHistory">
            <header>
              <h2>ChatHistory</h2>
              <code>&lt;browser-ai-chat-history /&gt;</code>
            </header>
            <browser-ai-chat-history [messages]="sampleMessages" />
          </section>
          <section class="demo-card" data-component="ChatSidebar">
            <header>
              <h2>ChatSidebar</h2>
              <code>&lt;browser-ai-chat-sidebar /&gt;</code>
            </header>
            <browser-ai-chat-sidebar [chats]="sampleChats" activeChatId="demo-chat" />
          </section>
          <section class="demo-card" data-component="PromptInput">
            <header>
              <h2>PromptInput</h2>
              <code>&lt;browser-ai-prompt-input /&gt;</code>
            </header>
            <browser-ai-prompt-input
              [value]="primitiveDraft()"
              (valueChange)="primitiveDraft.set($event)"
              [allowAttachments]="true"
              [allowVoice]="true"
              (send)="primitiveDraft.set('')"
            />
          </section>
          <section class="demo-card" data-component="MarkdownRenderer">
            <header>
              <h2>MarkdownRenderer</h2>
              <code>&lt;browser-ai-markdown /&gt;</code>
            </header>
            <browser-ai-markdown [content]="safeMarkdown" />
          </section>
        </div>

        <section class="demo-webmcp" data-testid="webmcp-demo">
          <div>
            <p class="demo-kicker">WebMCP in a real interface</p>
            <h2>Let an agent create a visible task—with validation and user-controlled registration.</h2>
            <p>
              The imperative tool mutates this list. The declarative form exposes the same action to a supporting agent.
            </p>
          </div>
          <p class="demo-webmcp__status" data-testid="webmcp-support">{{ webMcp.current().support.reason }}</p>
          <div class="demo-webmcp__actions">
            <button
              type="button"
              [disabled]="!webMcp.current().support.supported"
              data-testid="register-webmcp"
              (click)="registerTaskTool()"
            >
              {{ taskToolRegistered() ? 'Tool registered' : 'Register task tool' }}
            </button>
            <button
              type="button"
              [disabled]="!taskToolRegistered()"
              data-testid="execute-webmcp"
              (click)="executeTaskTool()"
            >
              Run task tool
            </button>
            <button type="button" [disabled]="!taskToolRegistered()" (click)="unregisterTaskTool()">Unregister</button>
          </div>
          <form
            class="demo-task-form"
            toolname="create_angular_demo_task_form"
            tooldescription="Create a task in the visible Angular Browser AI demo task list."
            data-testid="webmcp-form"
            (submit)="addPersonTask($event, title.value, $any(priority.value)); title.value = ''"
          >
            <input
              #title
              name="title"
              required
              maxlength="120"
              placeholder="Ship the framework adapters"
              toolparamdescription="Short title for the task to create."
            />
            <select #priority name="priority" toolparamdescription="Priority for the new task.">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
            </select>
            <button type="submit">Add task</button>
          </form>
          <ul class="demo-task-list" data-testid="task-list">
            @for (task of tasks(); track task.id) {
              <li>
                <span>{{ task.title }}</span
                ><span>{{ task.priority }} · {{ task.createdBy }}</span>
              </li>
            }
          </ul>
          @if (webMcpError()) {
            <p class="demo-error" role="alert">{{ webMcpError() }}</p>
          }
        </section>
      </div>
    </main>
  `
})
export class BrowserAiDemoComponent {
  readonly capabilities = signal<DemoCapability[]>([]);
  readonly summarizerText = signal(
    'Chrome can run compact language models directly in the browser. Data stays on the device.'
  );
  readonly writerText = signal('Write a two-sentence launch note for a private, on-device writing assistant.');
  readonly rewriterText = signal('This browser AI library is very easy and useful for developers.');
  readonly translatorText = signal('Private AI can run directly in your browser.');
  readonly detectorText = signal('Bonjour, comment allez-vous aujourd’hui?');
  readonly proofreaderText = signal('This sentence have two mistake.');
  readonly primitiveDraft = signal('');
  readonly safeMarkdown = '### Safe Markdown\n\nRendered locally with **HTML disabled**.';
  readonly sampleMessages: ChatMessage[] = [
    { id: 'message-1', role: 'assistant', content: 'Everything here renders **locally**.', timestamp: Date.now() }
  ];
  readonly sampleChats: ChatSidebarItem[] = [
    { id: 'demo-chat', title: 'Launch plan', preview: 'Private browser AI', updatedAt: Date.now() }
  ];
  readonly tasks = signal<DemoTask[]>([
    { id: 'seed-task', title: 'Review the multimodal Prompt API demo', priority: 'high', createdBy: 'person' }
  ]);
  readonly taskToolRegistered = signal(false);
  readonly webMcpError = signal('');
  readonly webMcp = createAngularWebMcp(inject(DestroyRef));

  constructor() {
    void inspectDemoCapabilities().then((capabilities) => this.capabilities.set(capabilities));
    this.webMcp.refreshSupport();
  }

  async registerTaskTool() {
    if (!this.webMcp.current().support.supported || this.taskToolRegistered()) return;
    this.webMcpError.set('');
    try {
      await this.webMcp.registerTool(
        createDemoTaskTool('Angular', (task) => this.tasks.update((tasks) => [...tasks, task]))
      );
      this.taskToolRegistered.set(true);
    } catch (error) {
      this.webMcpError.set(error instanceof Error ? error.message : 'WebMCP registration failed.');
    }
  }

  executeTaskTool() {
    return executeDemoTaskTool('Angular', this.webMcp).catch((error) =>
      this.webMcpError.set(error instanceof Error ? error.message : 'Tool execution failed.')
    );
  }

  unregisterTaskTool() {
    this.webMcp.unregisterTool('create_angular_demo_task');
    this.taskToolRegistered.set(false);
  }

  addPersonTask(event: Event, title: string, priority: DemoTask['priority']) {
    event.preventDefault();
    if (!title.trim()) return;
    this.tasks.update((tasks) => [...tasks, createPersonTask(title, priority)]);
  }
}
