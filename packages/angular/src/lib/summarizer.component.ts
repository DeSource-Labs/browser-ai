import { isAbortError } from '@desource/browser-ai';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, input, model, output } from '@angular/core';
import {
  createAngularSummarizerWorkflow,
  type SummarizerResult,
  type SummarizerRunOptions,
  type TextToolConfiguration
} from './workflows';
import { errorText } from './component-utils';
import { BrowserAiTextToolComponent } from './text-tool.component';
import { BrowserAiMarkdownRendererComponent } from './markdown-renderer.component';

@Component({
  selector: 'browser-ai-summarizer',
  standalone: true,
  imports: [BrowserAiTextToolComponent, BrowserAiMarkdownRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <browser-ai-text-tool
      #editor
      kind="summarizer"
      title="Summarizer"
      action="Summarize"
      placeholder="Paste an article, notes, or transcript…"
      [(value)]="value"
      [result]="resultText() || 'Summary output will appear here.'"
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
          <pre>{{ resultText() || 'Summary output will appear here.' }}</pre>
        } @else {
          <browser-ai-markdown [content]="resultText() || 'Summary output will appear here.'" />
        }
      </div>
    </browser-ai-text-tool>
  `
})
export class BrowserAiSummarizerComponent {
  readonly value = model('');
  readonly options = input<Omit<SummarizerCreateOptions, 'monitor' | 'signal'>>({});
  readonly runOptions = input<SummarizerRunOptions>({});
  readonly autoInit = input(true);
  readonly disabled = input(false);
  readonly result = output<SummarizerResult>();
  readonly progress = output<Parameters<NonNullable<SummarizerRunOptions['onProgress']>>[0]>();
  readonly requestError = output<unknown>();
  readonly error = model('');
  readonly api;
  readonly resultText = computed(() => this.api.current().output);
  readonly checkAvailability = (options: object) =>
    this.api.requestAvailability(options as SummarizerCreateCoreOptions);
  constructor(destroyRef: DestroyRef) {
    this.api = createAngularSummarizerWorkflow(destroyRef);
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
        onProgress: (progress: Parameters<NonNullable<SummarizerRunOptions['onProgress']>>[0]) => {
          this.runOptions().onProgress?.(progress);
          this.progress.emit(progress);
        }
      } as SummarizerRunOptions;
      this.result.emit(await this.api.summarizeWithDetails(value, options));
    } catch (error) {
      if (isAbortError(error)) return;
      this.error.set(errorText(error, 'Browser AI request failed.'));
      this.requestError.emit(error);
    }
  }
}
