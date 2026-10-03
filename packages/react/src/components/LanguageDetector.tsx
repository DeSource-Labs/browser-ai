import {
  useLanguageDetectorWorkflow,
  type LanguageDetectorResult,
  type LanguageDetectorRunOptions
} from '../workflows.js';
import { WorkflowTextTool } from './WorkflowTextTool.js';

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

export function LanguageDetector(props: LanguageDetectorProps) {
  const api = useLanguageDetectorWorkflow();
  const output = api.results
    .map((item) => `${item.name} (${item.detectedLanguage}): ${Math.round(item.confidence * 100)}%`)
    .join('\n');
  return (
    <WorkflowTextTool
      {...props}
      api={api}
      kind="language-detector"
      title="Language detector"
      action="Detect"
      placeholder="Paste text to identify its language…"
      output={output}
      emptyOutput="Language results will appear here."
      run={api.detectWithDetails}
    />
  );
}
