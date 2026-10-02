import { isAbortError } from '@desource/browser-ai';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, input, model, output } from '@angular/core';
import {
  createAngularLanguageDetectorWorkflow,
  type LanguageDetectorResult,
  type LanguageDetectorRunOptions,
  type TextToolConfiguration
} from './workflows';
import { errorText } from './component-utils';
import { BrowserAiTextToolComponent } from './text-tool.component';

@Component({
  selector: 'browser-ai-language-detector',
  standalone: true,
  imports: [BrowserAiTextToolComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <browser-ai-text-tool
      #editor
      kind="language-detector"
      title="Language detector"
      action="Detect"
      placeholder="Paste text to identify its language…"
      [(value)]="value"
      [result]="resultText() || 'Language results will appear here.'"
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
    >
    </browser-ai-text-tool>
  `
})
export class BrowserAiLanguageDetectorComponent {
  readonly value = model('');
  readonly options = input<Omit<LanguageDetectorCreateOptions, 'monitor' | 'signal'>>({});
  readonly runOptions = input<LanguageDetectorRunOptions>({});
  readonly autoInit = input(true);
  readonly disabled = input(false);
  readonly result = output<LanguageDetectorResult>();
  readonly progress = output<Parameters<NonNullable<LanguageDetectorRunOptions['onProgress']>>[0]>();
  readonly requestError = output<unknown>();
  readonly error = model('');
  readonly api;
  readonly resultText = computed(() =>
    this.api
      .current()
      .results.map((item) => `${item.name} (${item.detectedLanguage}): ${Math.round(item.confidence * 100)}%`)
      .join('\n')
  );
  readonly checkAvailability = (options: object) =>
    this.api.requestAvailability(options as LanguageDetectorCreateCoreOptions);
  constructor(destroyRef: DestroyRef) {
    this.api = createAngularLanguageDetectorWorkflow({}, destroyRef);
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
        onProgress: (progress: Parameters<NonNullable<LanguageDetectorRunOptions['onProgress']>>[0]) => {
          this.runOptions().onProgress?.(progress);
          this.progress.emit(progress);
        }
      } as LanguageDetectorRunOptions;
      this.result.emit(await this.api.detectWithDetails(value, options));
    } catch (error) {
      if (isAbortError(error)) return;
      this.error.set(errorText(error, 'Browser AI request failed.'));
      this.requestError.emit(error);
    }
  }
}
