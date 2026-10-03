import type { WriterFitStrategy } from '../composables/useWriter';

export interface WritingAssistantProps<Tone, Format, Length> {
  modelValue?: string;
  placeholder?: string;
  contextPlaceholder?: string;
  emptyOutputMessage?: string;
  tone?: Tone;
  format?: Format;
  length?: Length;
  sharedContext?: string;
  context?: string;
  outputLanguage?: string;
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  autoInit?: boolean;
  autoCreate?: boolean;
  stripHtml?: boolean;
  fitStrategy?: WriterFitStrategy;
  stream?: boolean;
  renderMarkdown?: boolean;
  disabled?: boolean;
}

export const writingAssistantDefaults = {
  modelValue: '',
  sharedContext: '',
  context: '',
  outputLanguage: '',
  expectedInputLanguages: undefined,
  expectedContextLanguages: undefined,
  autoInit: true,
  autoCreate: true,
  stripHtml: true,
  fitStrategy: 'truncate-context' as const,
  stream: true,
  renderMarkdown: true,
  disabled: false
};
