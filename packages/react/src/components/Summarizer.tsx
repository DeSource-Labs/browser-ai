import { isAbortError } from '@desource/browser-ai';
import { useState } from 'react';
import { errorText } from '../component-utils.js';
import { useSummarizerWorkflow, type SummarizerResult, type SummarizerRunOptions } from '../workflows.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import { TextTool } from './TextTool.js';

export interface SummarizerProps {
  value?: string;
  onValueChange?(value: string): void;
  createOptions?: Omit<SummarizerCreateOptions, 'monitor' | 'signal'>;
  runOptions?: SummarizerRunOptions;
  autoInit?: boolean;
  disabled?: boolean;
  onResult?(result: SummarizerResult): void;
  onProgress?: SummarizerRunOptions['onProgress'];
  onError?(error: unknown): void;
}

export function Summarizer({
  value,
  onValueChange,
  createOptions = {},
  runOptions = {},
  autoInit = true,
  disabled = false,
  onResult,
  onProgress,
  onError
}: SummarizerProps) {
  const api = useSummarizerWorkflow();
  const [error, setError] = useState('');
  const output = api.output;
  return (
    <TextTool
      kind="summarizer"
      title="Summarizer"
      action="Summarize"
      placeholder="Paste an article, notes, or transcript…"
      value={value}
      output={output || 'Summary output will appear here.'}
      outputText={output}
      renderOutput={(configuration) =>
        configuration.createOptions.format === 'plain-text' ? (
          output || 'Summary output will appear here.'
        ) : (
          <MarkdownRenderer content={output || 'Summary output will appear here.'} />
        )
      }
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
            onProgress: (progress: Parameters<NonNullable<SummarizerRunOptions['onProgress']>>[0]) => {
              runOptions.onProgress?.(progress);
              onProgress?.(progress);
            }
          } as SummarizerRunOptions;
          const result = await api.summarizeWithDetails(input, options);
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
