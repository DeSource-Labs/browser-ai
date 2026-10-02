import { isAbortError } from '@desource/browser-ai';
import { useState } from 'react';
import { errorText } from '../component-utils.js';
import {
  useLanguageDetectorWorkflow,
  type LanguageDetectorResult,
  type LanguageDetectorRunOptions
} from '../workflows.js';

import { TextTool } from './TextTool.js';

export interface LanguageDetectorProps {
  value?: string;
  onValueChange?(value: string): void;
  createOptions?: Omit<LanguageDetectorCreateOptions, 'monitor' | 'signal'>;
  runOptions?: LanguageDetectorRunOptions;
  autoInit?: boolean;
  disabled?: boolean;
  onResult?(result: LanguageDetectorResult): void;
  onProgress?: LanguageDetectorRunOptions['onProgress'];
  onError?(error: unknown): void;
}

export function LanguageDetector({
  value,
  onValueChange,
  createOptions = {},
  runOptions = {},
  autoInit = true,
  disabled = false,
  onResult,
  onProgress,
  onError
}: LanguageDetectorProps) {
  const api = useLanguageDetectorWorkflow();
  const [error, setError] = useState('');
  const output = api.results
    .map((item) => `${item.name} (${item.detectedLanguage}): ${Math.round(item.confidence * 100)}%`)
    .join('\n');
  return (
    <TextTool
      kind="language-detector"
      title="Language detector"
      action="Detect"
      placeholder="Paste text to identify its language…"
      value={value}
      output={output || 'Language results will appear here.'}
      outputText={output}
      availability={api.availability}
      processing={api.processing}
      downloadProgress={api.downloadProgress}
      inputUsage={api.inputUsage}
      inputQuota={api.inputQuota}
      progressState={api.progressState}
      createOptions={createOptions}
      runOptions={runOptions}
      onCheckAvailability={autoInit ? api.requestAvailability : undefined}
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
            onProgress: (progress: Parameters<NonNullable<LanguageDetectorRunOptions['onProgress']>>[0]) => {
              runOptions.onProgress?.(progress);
              onProgress?.(progress);
            }
          } as LanguageDetectorRunOptions;
          const result = await api.detectWithDetails(input, options);
          onResult?.(result);
        } catch (caught) {
          if (isAbortError(caught)) return;
          setError(errorText(caught));
          onError?.(caught);
        }
      }}
    />
  );
}
