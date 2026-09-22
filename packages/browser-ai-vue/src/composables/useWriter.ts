import { createWriterWorkflow } from '@desource/browser-ai/workflows';
import { useWorkflow } from './useWorkflow';

export type {
  WriterAvailability,
  WriterProcessingState,
  WriterCreateCore,
  WriterCreate,
  WriterRunNativeOptions,
  WriterFitStrategy,
  WriterProgressPhase,
  WriterProgressState,
  WriterResult,
  WriterRunOptions,
  WriterBatchItem,
  WriterBatchOptions
} from '@desource/browser-ai/workflows';

export function useWriter() {
  return useWorkflow(createWriterWorkflow());
}
