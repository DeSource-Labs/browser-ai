import { createSummarizerWorkflow } from '@desource/browser-ai/workflows';
import { useWorkflow } from './useWorkflow';

export type {
  SummarizerAvailability,
  SummarizerProcessingState,
  SummarizerCreateCore,
  SummarizerCreate,
  SummarizerRunNativeOptions,
  SummarizerProgressPhase,
  SummarizerProgressState,
  SummarizerChunkResult,
  SummarizerResult,
  SummarizerRunOptions
} from '@desource/browser-ai/workflows';

export function useSummarizer(...args: Parameters<typeof createSummarizerWorkflow>) {
  return useWorkflow(createSummarizerWorkflow(...args));
}
