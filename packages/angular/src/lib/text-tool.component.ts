import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked
} from '@angular/core';
import { readTextSource, TEXT_FILE_ACCEPT } from '@desource/browser-ai';
import {
  createAutoRun,
  getTextToolSettings,
  parseToolSetting,
  resolveTextToolOptions,
  type NormalizedProofreadCorrection,
  type TextToolConfiguration,
  type TextToolKind,
  type ToolSetting
} from '@desource/browser-ai/workflows';

@Component({
  selector: 'browser-ai-text-tool',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="writing-tool" (submit)="submit($event)">
      <div class="writing-tool__toolbar">
        <div class="writing-tool__toolbar-main">
          <strong>{{ title() }}</strong
          ><span class="writing-tool__status">{{ availability() ?? 'checking' }}</span>
        </div>
      </div>
      <div class="writing-tool__workspace">
        <section class="writing-tool__pane writing-tool__editor">
          <textarea
            [value]="value()"
            [placeholder]="placeholder()"
            [disabled]="disabled() || busy()"
            (input)="updateValue($event)"
          ></textarea>
          <label class="writing-tool__ghost-button">
            Add text files<input
              hidden
              type="file"
              multiple
              [accept]="textFileAccept"
              [disabled]="disabled() || busy()"
              (change)="filesChanged($event)"
            />
          </label>
          @if (kind() === 'translator') {
            <div class="writing-tool__language-actions">
              <label
                ><input
                  type="checkbox"
                  [checked]="autoEnabled()"
                  [disabled]="disabled() || busy()"
                  (change)="autoEnabled.set($any($event.target).checked)"
                />Auto translate</label
              >
              <button type="button" [disabled]="disabled() || busy()" (click)="swap()">Swap languages</button>
              @if (onPrepare() && availability() === 'downloadable') {
                <button type="button" [disabled]="disabled() || busy()" (click)="prepare()">Download pack</button>
              }
            </div>
          }
          @if (fields().length) {
            <details class="writing-tool__settings">
              <summary>Settings</summary>
              <div class="writing-tool__settings-grid">
                @for (field of fields(); track field.target + '.' + field.key) {
                  <label>
                    {{ field.label }}
                    @if (field.type === 'select') {
                      <select
                        [disabled]="disabled() || busy()"
                        [value]="settingText(field)"
                        (change)="changeSetting(field, $event)"
                      >
                        @for (option of field.options ?? []; track option.value) {
                          <option [value]="option.value" [selected]="option.value === settingText(field)">
                            {{ option.label }}
                          </option>
                        }
                      </select>
                    } @else if (field.type === 'checkbox') {
                      <input
                        type="checkbox"
                        [disabled]="disabled() || busy()"
                        [checked]="settingChecked(field)"
                        (change)="changeSetting(field, $event)"
                      />
                    } @else if (field.type === 'textarea') {
                      <textarea
                        [disabled]="disabled() || busy()"
                        [value]="settingText(field)"
                        (input)="changeSetting(field, $event)"
                      ></textarea>
                    } @else {
                      <input
                        [type]="field.type === 'number' ? 'number' : 'text'"
                        [disabled]="disabled() || busy()"
                        [attr.min]="field.min"
                        [attr.max]="field.max"
                        [attr.step]="field.step"
                        [value]="settingText(field)"
                        (input)="changeSetting(field, $event)"
                      />
                    }
                  </label>
                }
              </div>
            </details>
          }
        </section>
        <section class="writing-tool__pane writing-tool__pane--output">
          <div class="writing-tool__output">
            @if (customOutput()) {
              <ng-content />
            } @else {
              <pre>{{ result() }}</pre>
            }
          </div>
          @if (corrections().length) {
            <ul class="proofreader-tool__corrections" aria-label="Corrections">
              @for (correction of corrections(); track $index) {
                <li>
                  <del>{{ correction.original }}</del> <ins>{{ correction.correction }}</ins>
                  @if (correction.types.length) {
                    <span> {{ correction.types.join(', ') }}</span>
                  }
                  @if (correction.explanation) {
                    <p>{{ correction.explanation }}</p>
                  }
                </li>
              }
            </ul>
          }
          @if (copyText()) {
            <button type="button" [disabled]="disabled() || busy()" (click)="copy()">
              {{ copied() ? 'Copied' : 'Copy output' }}
            </button>
          }
        </section>
      </div>
      @if (error() || fileError() || availabilityError()) {
        <p class="writing-tool__error" role="alert">{{ error() || fileError() || availabilityError() }}</p>
      }
      <footer class="writing-tool__footer">
        <span>{{ inputUsage() ?? '—' }} / {{ inputQuota() ?? '—' }} tokens</span>
        @if (busy()) {
          <span role="status">
            {{ progressState()?.phase ?? processing() }}
            @if (downloadProgress() > 0 && downloadProgress() < 100) {
              {{ roundedDownloadProgress() }}%
            }
            @if (progressState()?.totalChunks) {
              {{ progressState()?.processedChunks ?? 0 }}/{{ progressState()?.totalChunks }}
            }
          </span>
          @if (onInterrupt()) {
            <button type="button" [disabled]="disabled()" (click)="interrupt()">Stop</button>
          }
        }
        <button type="submit" data-browser-ai-action="run" [disabled]="disabled() || busy() || !value().trim()">
          {{
            busy() ? 'Working…' : availability() === 'downloadable' ? 'Download & ' + action().toLowerCase() : action()
          }}
        </button>
      </footer>
    </form>
  `
})
export class BrowserAiTextToolComponent {
  readonly title = input.required<string>();
  readonly action = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly kind = input<TextToolKind>();
  readonly value = model('');
  readonly result = input('');
  readonly outputText = input<string>();
  readonly renderMarkdown = input(true);
  readonly customOutput = input(false);
  readonly corrections = input<readonly NormalizedProofreadCorrection[]>([]);
  readonly availability = input<Availability | null>(null);
  readonly processing = input('');
  readonly downloadProgress = input(0);
  readonly inputUsage = input<number | null>();
  readonly inputQuota = input<number | null>();
  readonly progressState = input<{ phase: string; processedChunks?: number; totalChunks?: number }>();
  readonly createOptions = input<object>({});
  readonly runOptions = input<object>({});
  readonly onCheckAvailability = input<(options: object) => Promise<Availability>>();
  readonly onInterrupt = input<() => void>();
  readonly autoRun = input(false);
  readonly autoRunDelay = input(650);
  readonly autoEnabled = signal(false);
  readonly onPrepare = input<(configuration: TextToolConfiguration) => Promise<unknown>>();
  readonly error = input('');
  readonly disabled = input(false);
  readonly run = output<string>();
  readonly configuredRun = output<{ input: string; configuration: TextToolConfiguration }>();
  readonly textFileAccept = TEXT_FILE_ACCEPT;
  readonly fileError = signal('');
  readonly availabilityError = signal('');
  readonly copied = signal(false);
  readonly busy = computed(() => Boolean(this.processing()));
  readonly roundedDownloadProgress = computed(() => Math.round(this.downloadProgress()));
  readonly copyText = computed(() => this.outputText() ?? this.result());
  private readonly optionKey = computed(() => JSON.stringify([this.kind(), this.createOptions(), this.runOptions()]));
  private readonly selection = signal<TextToolConfiguration & { key: string }>({
    key: '',
    createOptions: {},
    runOptions: {}
  });
  readonly fields = computed(() => {
    const kind = this.kind();
    return kind ? getTextToolSettings(kind) : [];
  });
  readonly configuration = computed<TextToolConfiguration>(() => {
    const kind = this.kind();
    const baseline = kind
      ? resolveTextToolOptions(kind, this.createOptions(), this.runOptions())
      : { createOptions: { ...this.createOptions() }, runOptions: { ...this.runOptions() } };
    const selection = this.selection();
    return selection.key === this.optionKey()
      ? {
          createOptions: { ...baseline.createOptions, ...selection.createOptions },
          runOptions: { ...baseline.runOptions, ...selection.runOptions }
        }
      : baseline;
  });
  private readonly availabilityKey = computed(() => JSON.stringify(this.configuration().createOptions));
  private destroyed = false;
  private fileRequest = 0;
  private availabilityRequest = 0;
  private copyRequest = 0;

  private readonly runner = createAutoRun(
    (value, configuration) => {
      this.fileError.set('');
      this.run.emit(value);
      this.configuredRun.emit({ input: value, configuration });
    },
    (error) => this.fileError.set(error instanceof Error ? error.message : 'Could not complete the request.')
  );
  constructor() {
    effect(() => this.autoEnabled.set(this.autoRun()));
    effect(() =>
      this.runner.update({
        input: this.value(),
        configuration: this.configuration(),
        enabled: this.kind() === 'translator' && this.autoEnabled(),
        available: this.availability(),
        busy: this.busy(),
        disabled: this.disabled(),
        delayMs: this.autoRunDelay()
      })
    );
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.runner.dispose();
      this.fileRequest += 1;
      this.availabilityRequest += 1;
      this.copyRequest += 1;
    });
    effect(() => {
      const key = this.optionKey();
      untracked(() => this.selection.set({ key, createOptions: {}, runOptions: {} }));
    });
    effect(() => {
      if (this.disabled() || this.busy()) this.fileRequest += 1;
    });
    effect(() => {
      const check = this.onCheckAvailability();
      const key = this.availabilityKey();
      const request = ++this.availabilityRequest;
      this.availabilityError.set('');
      if (check)
        untracked(() => {
          void this.checkAvailability(check, key, request);
        });
    });
    effect(() => {
      this.copyText();
      this.copyRequest += 1;
      this.copied.set(false);
    });
  }

  private async checkAvailability(check: (options: object) => Promise<Availability>, key: string, request: number) {
    try {
      await check(JSON.parse(key));
    } catch (error) {
      if (
        !this.destroyed &&
        request === this.availabilityRequest &&
        check === this.onCheckAvailability() &&
        key === this.availabilityKey()
      )
        this.availabilityError.set(error instanceof Error ? error.message : String(error));
    }
  }

  private settingValue(field: ToolSetting) {
    const configuration = this.configuration();
    return (
      (field.target === 'create' ? configuration.createOptions : configuration.runOptions)[field.key] ??
      field.defaultValue
    );
  }

  settingText(field: ToolSetting) {
    const value = this.settingValue(field);
    return Array.isArray(value) ? value.join(', ') : String(value);
  }

  settingChecked(field: ToolSetting) {
    return Boolean(this.settingValue(field));
  }

  changeSetting(field: ToolSetting, event: Event) {
    if (this.disabled() || this.busy()) return;
    const input = event.currentTarget as HTMLInputElement;
    const raw = field.type === 'checkbox' ? input.checked : input.value;
    const group = field.target === 'create' ? 'createOptions' : 'runOptions';
    const key = this.optionKey();
    this.selection.update((previous) => {
      const selection = previous.key === key ? previous : { key, createOptions: {}, runOptions: {} };
      return { ...selection, [group]: { ...selection[group], [field.key]: parseToolSetting(field, raw) } };
    });
  }

  updateValue(event: Event) {
    if (!this.disabled() && !this.busy()) this.value.set((event.currentTarget as HTMLTextAreaElement).value);
  }

  async filesChanged(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const request = ++this.fileRequest;
    try {
      if (this.disabled() || this.busy()) return;
      const blocks = await Promise.all(Array.from(input.files ?? []).map((file) => readTextSource(file)));
      if (this.destroyed || request !== this.fileRequest || this.disabled() || this.busy()) return;
      this.value.set([this.value(), ...blocks].filter(Boolean).join('\n\n'));
      this.fileError.set('');
    } catch (error) {
      if (!this.destroyed && request === this.fileRequest && !this.disabled() && !this.busy()) {
        this.fileError.set(error instanceof Error ? error.message : 'Could not read the selected file.');
      }
    } finally {
      input.value = '';
    }
  }

  async copy() {
    if (this.disabled() || this.busy() || !this.copyText()) return;
    const request = ++this.copyRequest;
    const text = this.copyText();
    try {
      await navigator.clipboard.writeText(text);
      if (!this.destroyed && request === this.copyRequest && this.copyText() === text) this.copied.set(true);
    } catch (error) {
      if (!this.destroyed && request === this.copyRequest && this.copyText() === text) {
        this.fileError.set(error instanceof Error ? error.message : 'Could not copy the result.');
      }
    }
  }

  interrupt() {
    this.runner.stop();
    this.onInterrupt()?.();
  }
  swap() {
    this.runner.stop();
    const configuration = this.configuration();
    this.selection.set({
      key: this.optionKey(),
      createOptions: {
        ...configuration.createOptions,
        sourceLanguage: configuration.createOptions.targetLanguage,
        targetLanguage: configuration.createOptions.sourceLanguage
      },
      runOptions: configuration.runOptions
    });
  }
  async prepare() {
    this.fileError.set('');
    try {
      await this.onPrepare()?.(this.configuration());
    } catch (error) {
      this.fileError.set(error instanceof Error ? error.message : 'Could not prepare the language pair.');
    }
  }

  submit(event: Event) {
    event.preventDefault();
    const value = this.value().trim();
    if (value && !this.busy() && !this.disabled()) {
      const configuration = this.configuration();
      this.fileError.set('');
      void this.runner.runNow(value, configuration);
    }
  }
}
