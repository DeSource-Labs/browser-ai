import { isAbortError } from '@desource/browser-ai';
import { useState } from 'react';
import { errorText } from '../component-utils.js';
import { useProofreaderWorkflow, type ProofreaderResult, type ProofreaderRunOptions } from '../workflows.js';

import { TextTool } from './TextTool.js';

export interface ProofreaderProps {
  value?: string;
  onValueChange?(value: string): void;
  createOptions?: Omit<ProofreaderCreateOptions, 'monitor' | 'signal'>;
  runOptions?: ProofreaderRunOptions;
  autoInit?: boolean;
  disabled?: boolean;
  onResult?(result: ProofreaderResult): void;
  onProgress?: ProofreaderRunOptions['onProgress'];
  onError?(error: unknown): void;
}

export function Proofreader({
  value,
  onValueChange,
  createOptions = {},
  runOptions = {},
  autoInit = true,
  disabled = false,
  onResult,
  onProgress,
  onError
}: ProofreaderProps) {
  const api = useProofreaderWorkflow();
  const [error, setError] = useState('');
  const output = api.output;
  return (
    <TextTool
      kind="proofreader"
      title="Proofreader"
      action="Proofread"
      placeholder="Paste text to check grammar and spelling…"
      value={value}
      output={output || 'Corrected output will appear here.'}
      outputText={output}
      corrections={api.corrections}
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
            onProgress: (progress: Parameters<NonNullable<ProofreaderRunOptions['onProgress']>>[0]) => {
              runOptions.onProgress?.(progress);
              onProgress?.(progress);
            }
          } as ProofreaderRunOptions;
          const result = await api.proofreadWithDetails(input, options);
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
