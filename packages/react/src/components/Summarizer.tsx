import { useSummarizerWorkflow, type SummarizerResult, type SummarizerRunOptions } from '../workflows.js';
import { WorkflowTextTool } from './WorkflowTextTool.js';

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

export function Summarizer(props: SummarizerProps) {
  const api = useSummarizerWorkflow();
  const output = api.output;
  return (
    <WorkflowTextTool
      {...props}
      api={api}
      kind="summarizer"
      title="Summarizer"
      action="Summarize"
      placeholder="Paste an article, notes, or transcript…"
      output={output}
      emptyOutput="Summary output will appear here."
      markdown
      run={api.summarizeWithDetails}
    />
  );
}
