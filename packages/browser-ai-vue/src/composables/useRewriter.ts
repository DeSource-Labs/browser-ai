import { createRewriterWorkflow } from '@desource/browser-ai/workflows';
import { useWorkflow } from './useWorkflow';

export type {
  RewriterAvailability,
  RewriterProcessingState,
  RewriterCreateCore,
  RewriterCreate,
  RewriterRunNativeOptions,
  RewriterFitStrategy,
  RewriterProgressPhase,
  RewriterProgressState,
  RewriterResult,
  RewriterRunOptions,
  RewriterBatchItem,
  RewriterBatchOptions
} from '@desource/browser-ai/workflows';

export function useRewriter() {
  return useWorkflow(createRewriterWorkflow());
}
