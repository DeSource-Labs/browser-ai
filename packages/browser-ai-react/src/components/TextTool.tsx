import { readTextSource } from '@desource/browser-ai';
import {
  createAutoRun,
  getTextToolSettings,
  parseToolSetting,
  resolveTextToolOptions,
  type TextToolKind,
  type TextToolConfiguration,
  type NormalizedProofreadCorrection
} from '@desource/browser-ai/workflows';
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { errorText, TEXT_FILE_ACCEPT } from '../component-utils.js';

export type { TextToolConfiguration } from '@desource/browser-ai/workflows';
export interface TextToolProps {
  kind?: TextToolKind;
  title: string;
  action: string;
  placeholder: string;
  value?: string;
  output: ReactNode;
  outputText?: string;
  renderOutput?(configuration: TextToolConfiguration): ReactNode;
  corrections?: readonly NormalizedProofreadCorrection[];
  availability: Availability | null;
  processing: string;
  downloadProgress?: number;
  inputUsage?: number | null;
  inputQuota?: number | null;
  progressState?: { phase: string; processedChunks?: number; totalChunks?: number };
  createOptions?: object;
  runOptions?: object;
  onCheckAvailability?(options: object): Promise<Availability>;
  onInterrupt?(): void;
  autoRun?: boolean;
  autoRunDelay?: number;
  onPrepare?(configuration: TextToolConfiguration): Promise<unknown>;
  disabled?: boolean;
  error?: string;
  onValueChange?(value: string): void;
  onRun(input: string, configuration: TextToolConfiguration): Promise<void>;
}

export function TextTool({
  kind,
  title,
  action,
  placeholder,
  value = '',
  output,
  outputText = '',
  renderOutput,
  corrections = [],
  availability,
  processing,
  downloadProgress = 0,
  inputUsage,
  inputQuota,
  progressState,
  createOptions = {},
  runOptions = {},
  onCheckAvailability,
  onInterrupt,
  autoRun = false,
  autoRunDelay = 650,
  onPrepare,
  disabled = false,
  error,
  onValueChange,
  onRun
}: TextToolProps) {
  const [input, setInput] = useState(value);
  const [autoEnabled, setAutoEnabled] = useState(autoRun);
  const runner = useRef<ReturnType<typeof createAutoRun> | null>(null);
  const runCallback = useRef(onRun);
  useEffect(() => {
    runCallback.current = onRun;
  }, [onRun]);
  useEffect(() => setAutoEnabled(autoRun), [autoRun]);
  const [fileError, setFileError] = useState('');
  const [copied, setCopied] = useState(false);
  const key = JSON.stringify([createOptions, runOptions]);
  const [selection, setSelection] = useState({ key, createOptions: {}, runOptions: {} } as TextToolConfiguration & {
    key: string;
  });
  const baseline = kind
    ? resolveTextToolOptions(kind, createOptions, runOptions)
    : { createOptions: { ...createOptions }, runOptions: { ...runOptions } };
  const configuration = {
    createOptions: { ...baseline.createOptions, ...(selection.key === key ? selection.createOptions : {}) },
    runOptions: { ...baseline.runOptions, ...(selection.key === key ? selection.runOptions : {}) }
  };
  const fields = kind ? getTextToolSettings(kind) : [];
  const availabilityKey = JSON.stringify(configuration.createOptions);
  const mounted = useRef(false);
  const fileRequest = useRef(0);
  const copyRequest = useRef(0);
  const inputRef = useRef(input);
  const busy = Boolean(processing);
  const blockedRef = useRef(disabled || busy);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);
  useEffect(() => {
    copyRequest.current += 1;
    setCopied(false);
  }, [outputText]);
  useEffect(() => {
    blockedRef.current = disabled || busy;
  }, [disabled, busy]);
  useEffect(() => {
    setInput(value);
    inputRef.current = value;
  }, [value]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      fileRequest.current += 1;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (onCheckAvailability) {
      setFileError('');
      void onCheckAvailability(JSON.parse(availabilityKey)).catch((caught: unknown) => {
        if (active) setFileError(errorText(caught));
      });
    }
    return () => {
      active = false;
    };
  }, [onCheckAvailability, availabilityKey]);

  const runKey = JSON.stringify(configuration);
  useEffect(() => {
    runner.current = createAutoRun(
      (text, options) => {
        setFileError('');
        return runCallback.current(text, options);
      },
      (caught) => setFileError(errorText(caught))
    );
    return () => {
      runner.current?.dispose();
      runner.current = null;
    };
  }, []);
  useEffect(() => {
    runner.current?.update({
      input,
      configuration: JSON.parse(runKey),
      enabled: kind === 'translator' && autoEnabled,
      available: availability,
      busy,
      disabled,
      delayMs: autoRunDelay
    });
  }, [input, runKey, kind, autoEnabled, availability, busy, disabled, autoRunDelay]);
  const interrupt = () => {
    runner.current?.stop();
    onInterrupt?.();
  };
  const swap = () => {
    runner.current?.stop();
    setSelection({
      key,
      createOptions: {
        ...configuration.createOptions,
        sourceLanguage: configuration.createOptions.targetLanguage,
        targetLanguage: configuration.createOptions.sourceLanguage
      },
      runOptions: configuration.runOptions
    });
  };
  const prepare = async () => {
    try {
      setFileError('');
      await onPrepare?.(configuration);
    } catch (caught) {
      setFileError(errorText(caught));
    }
  };
  const fileChanged = async (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.currentTarget;
    if (disabled || busy) return;
    const request = ++fileRequest.current;
    try {
      const blocks = await Promise.all(Array.from(target.files ?? []).map((file) => readTextSource(file)));
      if (!mounted.current || request !== fileRequest.current || blockedRef.current) return;
      const next = [inputRef.current, ...blocks].filter(Boolean).join('\n\n');
      inputRef.current = next;
      setInput(next);
      onValueChange?.(next);
      setFileError('');
    } catch (caught) {
      if (mounted.current && request === fileRequest.current) setFileError(errorText(caught, 'Could not read file.'));
    } finally {
      target.value = '';
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (input.trim() && !busy && !disabled)
      void runner.current?.runNow(input, configuration).catch((caught) => setFileError(errorText(caught)));
  };
  const copy = async () => {
    const request = ++copyRequest.current;
    try {
      await navigator.clipboard.writeText(outputText);
      if (mounted.current && request === copyRequest.current) {
        setCopied(true);
        setFileError('');
      }
    } catch (caught) {
      if (mounted.current && request === copyRequest.current)
        setFileError(errorText(caught, 'Could not copy the result.'));
    }
  };

  return (
    <form className="writing-tool" onSubmit={submit}>
      <div className="writing-tool__toolbar">
        <div className="writing-tool__toolbar-main">
          <strong>{title}</strong>
          <span className="writing-tool__status">{availability ?? 'checking'}</span>
        </div>
      </div>
      <div className="writing-tool__workspace">
        <section className="writing-tool__pane writing-tool__editor">
          <textarea
            value={input}
            placeholder={placeholder}
            disabled={disabled || busy}
            onChange={(event) => {
              inputRef.current = event.currentTarget.value;
              setInput(event.currentTarget.value);
              onValueChange?.(event.currentTarget.value);
            }}
          />
          <label className="writing-tool__ghost-button">
            Add text files
            <input
              hidden
              type="file"
              multiple
              accept={TEXT_FILE_ACCEPT}
              disabled={disabled || busy}
              onChange={fileChanged}
            />
          </label>
          {kind === 'translator' && (
            <div className="writing-tool__language-actions">
              <label>
                <input
                  type="checkbox"
                  checked={autoEnabled}
                  disabled={disabled || busy}
                  onChange={(event) => setAutoEnabled(event.currentTarget.checked)}
                />
                Auto translate
              </label>
              <button type="button" disabled={disabled || busy} onClick={swap}>
                Swap languages
              </button>
              {onPrepare && availability === 'downloadable' && (
                <button type="button" disabled={disabled || busy} onClick={() => void prepare()}>
                  Download pack
                </button>
              )}
            </div>
          )}
          {fields.length > 0 && (
            <details className="writing-tool__settings">
              <summary>Settings</summary>
              <div className="writing-tool__settings-grid">
                {fields.map((field) => {
                  const values = field.target === 'create' ? configuration.createOptions : configuration.runOptions;
                  const selected = values[field.key] ?? field.defaultValue;
                  const change = (raw: string | boolean) =>
                    setSelection((previous) => {
                      const own = previous.key === key ? previous : { key, createOptions: {}, runOptions: {} };
                      const group = field.target === 'create' ? 'createOptions' : 'runOptions';
                      return { ...own, [group]: { ...own[group], [field.key]: parseToolSetting(field, raw) } };
                    });
                  return (
                    <label key={`${field.target}.${field.key}`}>
                      {field.label}
                      {field.type === 'select' ? (
                        <select
                          disabled={disabled || busy}
                          value={String(selected)}
                          onChange={(event) => change(event.currentTarget.value)}
                        >
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          disabled={disabled || busy}
                          checked={Boolean(selected)}
                          onChange={(event) => change(event.currentTarget.checked)}
                        />
                      ) : field.type === 'textarea' ? (
                        <textarea
                          disabled={disabled || busy}
                          value={String(selected)}
                          onChange={(event) => change(event.currentTarget.value)}
                        />
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          disabled={disabled || busy}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={Array.isArray(selected) ? selected.join(', ') : String(selected)}
                          onChange={(event) => change(event.currentTarget.value)}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </details>
          )}
        </section>
        <section className="writing-tool__pane writing-tool__pane--output">
          <div className="writing-tool__output">{renderOutput ? renderOutput(configuration) : output}</div>
          {corrections.length > 0 && (
            <ul className="proofreader-tool__corrections" aria-label="Corrections">
              {corrections.map((correction, index) => (
                <li key={index}>
                  <del>{correction.original}</del> <ins>{correction.correction}</ins>
                  {correction.types.length > 0 && <span> {correction.types.join(', ')}</span>}
                  {correction.explanation && <p>{correction.explanation}</p>}
                </li>
              ))}
            </ul>
          )}
          {outputText && (
            <button type="button" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy output'}
            </button>
          )}
        </section>
      </div>
      {(error || fileError) && (
        <p className="writing-tool__error" role="alert">
          {error || fileError}
        </p>
      )}
      <footer className="writing-tool__footer">
        <span>
          {inputUsage ?? '—'} / {inputQuota ?? '—'} tokens
        </span>
        {busy && (
          <span role="status">
            {progressState?.phase ?? processing}
            {downloadProgress > 0 && downloadProgress < 100 ? ` ${Math.round(downloadProgress)}%` : ''}
            {progressState?.totalChunks ? ` ${progressState.processedChunks ?? 0}/${progressState.totalChunks}` : ''}
          </span>
        )}
        {busy && onInterrupt && (
          <button type="button" onClick={interrupt}>
            Stop
          </button>
        )}
        <button type="submit" data-browser-ai-action="run" disabled={disabled || busy || !input.trim()}>
          {busy ? 'Working…' : availability === 'downloadable' ? `Download & ${action.toLowerCase()}` : action}
        </button>
      </footer>
    </form>
  );
}
