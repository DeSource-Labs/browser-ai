import { useCallback } from 'react';
import { useTranslatorWorkflow, type TranslatorResult, type TranslatorRunOptions } from '../workflows.js';

import { WorkflowTextTool } from './WorkflowTextTool.js';

export interface TranslatorProps {
  value?: string;
  onValueChange?(value: string): void;
  createOptions?: Partial<Omit<TranslatorCreateOptions, 'monitor' | 'signal'>>;
  runOptions?: TranslatorRunOptions;
  autoInit?: boolean;
  autoTranslate?: boolean;
  debounceMs?: number;
  disabled?: boolean;
  sourceLanguage?: string;
  targetLanguage?: string;
  onResult?(result: TranslatorResult): void;
  onProgress?: TranslatorRunOptions['onProgress'];
  onError?(error: unknown): void;
}

export function Translator({
  createOptions = {},
  sourceLanguage = 'en',
  targetLanguage = 'es',
  autoTranslate = true,
  debounceMs = 650,
  ...props
}: TranslatorProps) {
  const api = useTranslatorWorkflow({ sourceLanguage, targetLanguage, ...createOptions });
  const checkAvailability = api.requestAvailability;
  const requestAvailability = useCallback(
    (options: object) => checkAvailability(options as TranslatorCreateCoreOptions),
    [checkAvailability]
  );
  return (
    <WorkflowTextTool
      {...props}
      api={{ ...api, requestAvailability }}
      kind="translator"
      autoRun={autoTranslate}
      autoRunDelay={debounceMs}
      onPrepare={(configuration) => api.create(configuration.createOptions as unknown as TranslatorCreateCoreOptions)}
      title="Translator"
      action="Translate"
      placeholder="Paste text to translate locally…"
      output={api.output}
      emptyOutput="Translation will appear here."
      createOptions={{ sourceLanguage, targetLanguage, ...createOptions }}
      run={async (input, options: TranslatorRunOptions) => {
        await api.translateStreamingToText(input, options);
        return api.state.getSnapshot().lastResult;
      }}
    />
  );
}
