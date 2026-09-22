import { isAbortError } from '@desource/browser-ai';
import { useCallback, useState } from 'react';
import { errorText } from '../component-utils.js';
import { useTranslatorWorkflow, type TranslatorResult, type TranslatorRunOptions } from '../workflows.js';

import { TextTool } from './TextTool.js';

export interface TranslatorProps {
  value?: string;
  onValueChange?(value: string): void;
  createOptions?: Partial<Omit<TranslatorCreateOptions, 'monitor' | 'signal'>>;
  runOptions?: TranslatorRunOptions;
  autoInit?: boolean;
  autoTranslate?: boolean;
  debounceMs?: number;
  disabled?: boolean;
  sourceLanguage?: string;
  targetLanguage?: string;
  onResult?(result: TranslatorResult): void;
  onProgress?: TranslatorRunOptions['onProgress'];
  onError?(error: unknown): void;
}

export function Translator({
  value,
  onValueChange,
  createOptions = {},
  runOptions = {},
  sourceLanguage = 'en',
  targetLanguage = 'es',
  autoInit = true,
  autoTranslate = true,
  debounceMs = 650,
  disabled = false,
  onResult,
  onProgress,
  onError
}: TranslatorProps) {
  const api = useTranslatorWorkflow({ sourceLanguage, targetLanguage, ...createOptions });
  const checkAvailability = api.requestAvailability;
  const requestAvailability = useCallback(
    (options: object) => checkAvailability(options as TranslatorCreateCoreOptions),
    [checkAvailability]
  );
  const [error, setError] = useState('');
  const output = api.output;
  return (
    <TextTool
      kind="translator"
      autoRun={autoTranslate}
      autoRunDelay={debounceMs}
      onPrepare={(configuration) => api.create(configuration.createOptions as unknown as TranslatorCreateCoreOptions)}
      title="Translator"
      action="Translate"
      placeholder="Paste text to translate locally…"
      value={value}
      output={output || 'Translation will appear here.'}
      outputText={output}
      availability={api.availability}
      processing={api.processing}
      downloadProgress={api.downloadProgress}
      inputUsage={api.inputUsage}
      inputQuota={api.inputQuota}
      progressState={api.progressState}
      createOptions={{ sourceLanguage, targetLanguage, ...createOptions }}
      runOptions={runOptions}
      onCheckAvailability={autoInit ? requestAvailability : undefined}
      onInterrupt={api.interrupt}
      disabled={disabled}
      error={error}
      onValueChange={onValueChange}
      onRun={async (input, configuration) => {
        try {
          setError('');
          const options = {
            ...configuration.runOptions,
            createOptions: configuration.createOptions,
            onProgress: (progress: Parameters<NonNullable<TranslatorRunOptions['onProgress']>>[0]) => {
              runOptions.onProgress?.(progress);
              onProgress?.(progress);
            }
          } as TranslatorRunOptions;
          await api.translateStreamingToText(input, options);
          const result = api.state.getSnapshot().lastResult;
          if (result) onResult?.(result);
        } catch (caught) {
          if (isAbortError(caught)) return;
          setError(errorText(caught));
          onError?.(caught);
        }
      }}
    />
  );
}
