import { createLanguageDetectorWorkflow } from '@desource/browser-ai/workflows';
import { useWorkflow } from './useWorkflow';

export type {
  LanguageDetectorAvailability,
  LanguageDetectorProcessingState,
  LanguageDetectorCreateCore,
  LanguageDetectorCreate,
  LanguageDetectorRunNativeOptions,
  LanguageDetectorLargeInputStrategy,
  LanguageDetectorProgressPhase,
  LanguageDetectorLanguageOption,
  NormalizedLanguageDetectionResult,
  LanguageDetectorProgressState,
  LanguageDetectorChunkResult,
  LanguageDetectorResult,
  LanguageDetectorRunOptions,
  LanguageDetectorBatchItem,
  LanguageDetectorBatchOptions
} from '@desource/browser-ai/workflows';
export { LANGUAGE_DETECTOR_LANGUAGE_OPTIONS, getLanguageDetectorLanguageName } from '@desource/browser-ai/workflows';

export function useLanguageDetector(...args: Parameters<typeof createLanguageDetectorWorkflow>) {
  return useWorkflow(createLanguageDetectorWorkflow(...args));
}
