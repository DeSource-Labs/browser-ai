import { isAbortError } from '@desource/browser-ai';
import { useState } from 'react';
import { errorText } from '../component-utils.js';
import { useRewriterWorkflow, type RewriterResult, type RewriterRunOptions } from '../workflows.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import { TextTool } from './TextTool.js';

export interface RewriterProps {
  value?: string;
  onValueChange?(value: string): void;
  createOptions?: Omit<RewriterCreateOptions, 'monitor' | 'signal'>;
  runOptions?: RewriterRunOptions;
  autoInit?: boolean;
  disabled?: boolean;
  onResult?(result: RewriterResult): void;
  onProgress?: RewriterRunOptions['onProgress'];
  onError?(error: unknown): void;
}

export function Rewriter({
  value,
  onValueChange,
  createOptions = {},
  runOptions = {},
  autoInit = true,
  disabled = false,
  onResult,
  onProgress,
  onError
}: RewriterProps) {
  const api = useRewriterWorkflow();
  const [error, setError] = useState('');
  const output = api.output;
  return (
    <TextTool
      kind="rewriter"
      title="Rewriter"
      action="Rewrite"
      placeholder="Paste text to rewrite…"
      value={value}
      output={output || 'Rewritten text will appear here.'}
      outputText={output}
      renderOutput={(configuration) =>
        configuration.createOptions.format === 'plain-text' ? (
          output || 'Rewritten text will appear here.'
        ) : (
          <MarkdownRenderer content={output || 'Rewritten text will appear here.'} />
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
            onProgress: (progress: Parameters<NonNullable<RewriterRunOptions['onProgress']>>[0]) => {
              runOptions.onProgress?.(progress);
              onProgress?.(progress);
            }
          } as RewriterRunOptions;
          await api.rewriteStreamingToText(input, options);
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
