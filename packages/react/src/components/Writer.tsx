import { useWriterWorkflow, type WriterResult, type WriterRunOptions } from '../workflows.js';
import { WorkflowTextTool } from './WorkflowTextTool.js';

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

export function Writer(props: Readonly<WriterProps>) {
  const api = useWriterWorkflow();
  const output = api.output;
  return (
    <WorkflowTextTool
      {...props}
      api={api}
      kind="writer"
      title="Writer"
      action="Write"
      placeholder="Describe what you want to write…"
      output={output}
      emptyOutput="Generated draft will appear here."
      markdown
      run={async (input, options: WriterRunOptions) => {
        await api.writeStreamingToText(input, options);
        return api.state.getSnapshot().lastResult;
      }}
    />
  );
}
