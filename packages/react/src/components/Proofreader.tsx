import { useProofreaderWorkflow, type ProofreaderResult, type ProofreaderRunOptions } from '../workflows.js';
import { WorkflowTextTool } from './WorkflowTextTool.js';

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

export function Proofreader(props: ProofreaderProps) {
  const api = useProofreaderWorkflow();
  const output = api.output;
  return (
    <WorkflowTextTool
      {...props}
      api={api}
      kind="proofreader"
      title="Proofreader"
      action="Proofread"
      placeholder="Paste text to check grammar and spelling…"
      output={output}
      emptyOutput="Corrected output will appear here."
      corrections={api.corrections}
      run={api.proofreadWithDetails}
    />
  );
}
