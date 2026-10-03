import { isAbortError } from '@desource/browser-ai';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, input, model, output } from '@angular/core';
import {
  createAngularRewriterWorkflow,
  type RewriterResult,
  type RewriterRunOptions,
  type TextToolConfiguration
} from './workflows';
import { errorText } from './component-utils';
import { BrowserAiTextToolComponent } from './text-tool.component';
import { BrowserAiMarkdownRendererComponent } from './markdown-renderer.component';

@Component({
  selector: 'browser-ai-rewriter',
  standalone: true,
  imports: [BrowserAiTextToolComponent, BrowserAiMarkdownRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <browser-ai-text-tool
      #editor
      kind="rewriter"
      title="Rewriter"
      action="Rewrite"
      placeholder="Paste text to rewrite…"
      [(value)]="value"
      [result]="resultText() || 'Rewritten text will appear here.'"
      [outputText]="resultText()"
      [availability]="api.current().availability"
      [processing]="api.current().processing"
      [downloadProgress]="api.current().downloadProgress"
      [inputUsage]="api.current().inputUsage"
      [inputQuota]="api.current().inputQuota"
      [progressState]="api.current().progressState"
      [createOptions]="this.options()"
      [runOptions]="runOptions()"
      [onCheckAvailability]="autoInit() ? checkAvailability : undefined"
      [onInterrupt]="api.interrupt"
      [error]="error()"
      [disabled]="disabled()"
      (configuredRun)="execute($event.input, $event.configuration)"
      [customOutput]="true"
    >
      <div browserAiOutput>
        @if (editor.configuration().createOptions['format'] === 'plain-text') {
          <pre>{{ resultText() || 'Rewritten text will appear here.' }}</pre>
        } @else {
          <browser-ai-markdown [content]="resultText() || 'Rewritten text will appear here.'" />
        }
      </div>
    </browser-ai-text-tool>
  `
})
export class BrowserAiRewriterComponent {
  readonly value = model('');
  readonly options = input<Omit<RewriterCreateOptions, 'monitor' | 'signal'>>({});
  readonly runOptions = input<RewriterRunOptions>({});
  readonly autoInit = input(true);
  readonly disabled = input(false);
  readonly result = output<RewriterResult>();
  readonly progress = output<Parameters<NonNullable<RewriterRunOptions['onProgress']>>[0]>();
  readonly requestError = output<unknown>();
  readonly error = model('');
  readonly api;
  readonly resultText = computed(() => this.api.current().output);
  readonly checkAvailability = (options: object) => this.api.requestAvailability(options as RewriterCreateCoreOptions);
  constructor(destroyRef: DestroyRef) {
    this.api = createAngularRewriterWorkflow(destroyRef);
  }
  async execute(
    value: string,
    configuration: TextToolConfiguration = {
      createOptions: { ...this.options() },
      runOptions: { ...this.runOptions() }
    }
  ) {
    try {
      this.error.set('');
      const options = {
        ...configuration.runOptions,
        createOptions: configuration.createOptions,
        onProgress: (progress: Parameters<NonNullable<RewriterRunOptions['onProgress']>>[0]) => {
          this.runOptions().onProgress?.(progress);
          this.progress.emit(progress);
        }
      } as RewriterRunOptions;
      await this.api.rewriteStreamingToText(value, options);
      const result = this.api.state.getSnapshot().lastResult;
      if (result) this.result.emit(result);
    } catch (error) {
      if (isAbortError(error)) return;
      this.error.set(errorText(error, 'Browser AI request failed.'));
      this.requestError.emit(error);
    }
  }
}
