import { isAbortError } from '@desource/browser-ai';
import { useState } from 'react';
import { errorText } from '../component-utils.js';
import { useWriterWorkflow, type WriterResult, type WriterRunOptions } from '../workflows.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import { TextTool } from './TextTool.js';

export interface WriterProps {
  value?: string;
  onValueChange?(value: string): void;
  createOptions?: Omit<WriterCreateOptions, 'monitor' | 'signal'>;
  runOptions?: WriterRunOptions;
  autoInit?: boolean;
  disabled?: boolean;
  onResult?(result: WriterResult): void;
  onProgress?: WriterRunOptions['onProgress'];
  onError?(error: unknown): void;
}

export function Writer({
  value,
  onValueChange,
  createOptions = {},
  runOptions = {},
  autoInit = true,
  disabled = false,
  onResult,
  onProgress,
  onError
}: WriterProps) {
  const api = useWriterWorkflow();
  const [error, setError] = useState('');
  const output = api.output;
  return (
    <TextTool
      kind="writer"
      title="Writer"
      action="Write"
      placeholder="Describe what you want to write…"
      value={value}
      output={output || 'Generated draft will appear here.'}
      outputText={output}
      renderOutput={(configuration) =>
        configuration.createOptions.format === 'plain-text' ? (
          output || 'Generated draft will appear here.'
        ) : (
          <MarkdownRenderer content={output || 'Generated draft will appear here.'} />
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
            onProgress: (progress: Parameters<NonNullable<WriterRunOptions['onProgress']>>[0]) => {
              runOptions.onProgress?.(progress);
              onProgress?.(progress);
            }
          } as WriterRunOptions;
          await api.writeStreamingToText(input, options);
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
