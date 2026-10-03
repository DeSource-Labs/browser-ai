import { useRewriterWorkflow, type RewriterResult, type RewriterRunOptions } from '../workflows.js';
import { WorkflowTextTool } from './WorkflowTextTool.js';

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

export function Rewriter(props: Readonly<RewriterProps>) {
  const api = useRewriterWorkflow();
  const output = api.output;
  return (
    <WorkflowTextTool
      {...props}
      api={api}
      kind="rewriter"
      title="Rewriter"
      action="Rewrite"
      placeholder="Paste text to rewrite…"
      output={output}
      emptyOutput="Rewritten text will appear here."
      markdown
      run={async (input, options: RewriterRunOptions) => {
        await api.rewriteStreamingToText(input, options);
        return api.state.getSnapshot().lastResult;
      }}
    />
  );
}
