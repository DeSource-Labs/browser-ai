import { createProofreaderWorkflow } from '@desource/browser-ai/workflows';
import { useWorkflow } from './useWorkflow';

export type {
  ProofreaderAvailability,
  ProofreaderProcessingState,
  ProofreaderCreateCore,
  ProofreaderCreate,
  ProofreaderRunNativeOptions,
  ProofreaderLargeInputStrategy,
  ProofreaderCorrectionType,
  ProofreaderProgressPhase,
  ProofreaderProgressState,
  NormalizedProofreadCorrection,
  ProofreaderChunkResult,
  ProofreaderResult,
  ProofreaderRunOptions,
  ProofreaderBatchItem,
  ProofreaderBatchOptions,
  ProofreaderTextSegment
} from '@desource/browser-ai/workflows';
export { PROOFREADER_LANGUAGE_OPTIONS, getProofreaderLanguageName } from '@desource/browser-ai/workflows';

export function useProofreader(...args: Parameters<typeof createProofreaderWorkflow>) {
  return useWorkflow(createProofreaderWorkflow(...args));
}
