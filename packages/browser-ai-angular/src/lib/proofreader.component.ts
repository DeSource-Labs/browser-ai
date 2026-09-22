import { isAbortError } from '@desource/browser-ai';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, input, model, output } from '@angular/core';
import {
  createAngularProofreaderWorkflow,
  type ProofreaderResult,
  type ProofreaderRunOptions,
  type TextToolConfiguration
} from './workflows';
import { errorText } from './component-utils';
import { BrowserAiTextToolComponent } from './text-tool.component';

@Component({
  selector: 'browser-ai-proofreader',
  standalone: true,
  imports: [BrowserAiTextToolComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <browser-ai-text-tool
      #editor
      kind="proofreader"
      title="Proofreader"
      action="Proofread"
      placeholder="Paste text to check grammar and spelling…"
      [(value)]="value"
      [result]="resultText() || 'Corrected output will appear here.'"
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
      [corrections]="api.current().corrections"
      [error]="error()"
      [disabled]="disabled()"
      (configuredRun)="execute($event.input, $event.configuration)"
    >
    </browser-ai-text-tool>
  `
})
export class BrowserAiProofreaderComponent {
  readonly value = model('');
  readonly options = input<Omit<ProofreaderCreateOptions, 'monitor' | 'signal'>>({});
  readonly runOptions = input<ProofreaderRunOptions>({});
  readonly autoInit = input(true);
  readonly disabled = input(false);
  readonly result = output<ProofreaderResult>();
  readonly progress = output<Parameters<NonNullable<ProofreaderRunOptions['onProgress']>>[0]>();
  readonly requestError = output<unknown>();
  readonly error = model('');
  readonly api;
  readonly resultText = computed(() => this.api.current().output);
  readonly checkAvailability = (options: object) =>
    this.api.requestAvailability(options as ProofreaderCreateCoreOptions);
  constructor(destroyRef: DestroyRef) {
    this.api = createAngularProofreaderWorkflow({}, destroyRef);
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
        onProgress: (progress: Parameters<NonNullable<ProofreaderRunOptions['onProgress']>>[0]) => {
          this.runOptions().onProgress?.(progress);
          this.progress.emit(progress);
        }
      } as ProofreaderRunOptions;
      this.result.emit(await this.api.proofreadWithDetails(value, options));
    } catch (error) {
      if (isAbortError(error)) return;
      this.error.set(errorText(error, 'Browser AI request failed.'));
      this.requestError.emit(error);
    }
  }
}
