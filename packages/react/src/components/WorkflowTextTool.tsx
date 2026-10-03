import { isAbortError } from '@desource/browser-ai';
import { useState } from 'react';
import { errorText } from '../component-utils.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import { TextTool, type TextToolProps } from './TextTool.js';

type WorkflowDisplay = Pick<
  TextToolProps,
  'availability' | 'processing' | 'downloadProgress' | 'inputUsage' | 'inputQuota' | 'progressState'
> & {
  requestAvailability(options: object): Promise<Availability>;
  interrupt(): void;
};

interface WorkflowTextToolProps<Progress, RunOptions extends object, Result> extends Pick<
  TextToolProps,
  | 'kind'
  | 'title'
  | 'action'
  | 'placeholder'
  | 'value'
  | 'onValueChange'
  | 'createOptions'
  | 'disabled'
  | 'corrections'
  | 'autoRun'
  | 'autoRunDelay'
  | 'onPrepare'
> {
  api: WorkflowDisplay;
  output: string;
  emptyOutput: string;
  markdown?: boolean;
  autoInit?: boolean;
  runOptions?: RunOptions & { onProgress?: (progress: Progress) => void };
  run(input: string, options: RunOptions): Promise<Result | null>;
  onResult?(result: Result): void;
  onProgress?(progress: Progress): void;
  onError?(error: unknown): void;
}

export function WorkflowTextTool<Progress, RunOptions extends object, Result>({
  api,
  output,
  emptyOutput,
  markdown = false,
  autoInit = true,
  runOptions,
  run,
  onResult,
  onProgress,
  onError,
  ...props
}: WorkflowTextToolProps<Progress, RunOptions, Result>) {
  const [error, setError] = useState('');
  const display = output || emptyOutput;
  return (
    <TextTool
      {...props}
      output={display}
      outputText={output}
      renderOutput={
        markdown
          ? (configuration) =>
              configuration.createOptions.format === 'plain-text' ? display : <MarkdownRenderer content={display} />
          : undefined
      }
      availability={api.availability}
      processing={api.processing}
      downloadProgress={api.downloadProgress}
      inputUsage={api.inputUsage}
      inputQuota={api.inputQuota}
      progressState={api.progressState}
      runOptions={runOptions}
      onCheckAvailability={autoInit ? api.requestAvailability : undefined}
      onInterrupt={api.interrupt}
      error={error}
      onRun={async (input, configuration) => {
        try {
          setError('');
          const options = {
            ...configuration.runOptions,
            createOptions: configuration.createOptions,
            onProgress: (progress: Progress) => {
              runOptions?.onProgress?.(progress);
              onProgress?.(progress);
            }
          } as RunOptions;
          const result = await run(input, options);
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
