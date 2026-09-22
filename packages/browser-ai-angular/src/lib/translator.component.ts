import { isAbortError } from '@desource/browser-ai';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, input, model, output } from '@angular/core';
import {
  createAngularTranslatorWorkflow,
  type TranslatorResult,
  type TranslatorRunOptions,
  type TextToolConfiguration
} from './workflows';
import { errorText } from './component-utils';
import { BrowserAiTextToolComponent } from './text-tool.component';

@Component({
  selector: 'browser-ai-translator',
  standalone: true,
  imports: [BrowserAiTextToolComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <browser-ai-text-tool
      #editor
      kind="translator"
      [autoRun]="autoTranslate()"
      [autoRunDelay]="debounceMs()"
      [onPrepare]="prepare"
      title="Translator"
      action="Translate"
      placeholder="Paste text to translate locally…"
      [(value)]="value"
      [result]="resultText() || 'Translation will appear here.'"
      [outputText]="resultText()"
      [availability]="api.current().availability"
      [processing]="api.current().processing"
      [downloadProgress]="api.current().downloadProgress"
      [inputUsage]="api.current().inputUsage"
      [inputQuota]="api.current().inputQuota"
      [progressState]="api.current().progressState"
      [createOptions]="this.createOptions()"
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
export class BrowserAiTranslatorComponent {
  readonly value = model('');
  readonly options = input<Partial<Omit<TranslatorCreateOptions, 'monitor' | 'signal'>>>({});
  readonly runOptions = input<TranslatorRunOptions>({});
  readonly autoInit = input(true);
  readonly autoTranslate = input(true);
  readonly debounceMs = input(650);
  readonly disabled = input(false);
  readonly sourceLanguage = input('en');
  readonly targetLanguage = input('es');
  readonly createOptions = computed(() => ({
    sourceLanguage: this.sourceLanguage(),
    targetLanguage: this.targetLanguage(),
    ...this.options()
  }));
  readonly result = output<TranslatorResult>();
  readonly progress = output<Parameters<NonNullable<TranslatorRunOptions['onProgress']>>[0]>();
  readonly requestError = output<unknown>();
  readonly error = model('');
  readonly api;
  readonly resultText = computed(() => this.api.current().output);
  readonly prepare = (configuration: TextToolConfiguration) =>
    this.api.create(configuration.createOptions as unknown as TranslatorCreateCoreOptions);
  readonly checkAvailability = (options: object) =>
    this.api.requestAvailability(options as TranslatorCreateCoreOptions);
  constructor(destroyRef: DestroyRef) {
    this.api = createAngularTranslatorWorkflow(
      { sourceLanguage: this.sourceLanguage(), targetLanguage: this.targetLanguage(), ...this.options() },
      destroyRef
    );
  }
  async execute(
    value: string,
    configuration: TextToolConfiguration = {
      createOptions: { ...this.createOptions() },
      runOptions: { ...this.runOptions() }
    }
  ) {
    try {
      this.error.set('');
      const options = {
        ...configuration.runOptions,
        createOptions: configuration.createOptions,
        onProgress: (progress: Parameters<NonNullable<TranslatorRunOptions['onProgress']>>[0]) => {
          this.runOptions().onProgress?.(progress);
          this.progress.emit(progress);
        }
      } as TranslatorRunOptions;
      await this.api.translateStreamingToText(value, options);
      const result = this.api.state.getSnapshot().lastResult;
      if (result) this.result.emit(result);
    } catch (error) {
      if (isAbortError(error)) return;
      this.error.set(errorText(error, 'Browser AI request failed.'));
      this.requestError.emit(error);
    }
  }
}
