import { createTranslatorWorkflow } from '@desource/browser-ai/workflows';
import { useWorkflow } from './useWorkflow';

export type {
  TranslatorAvailability,
  TranslatorProcessingState,
  TranslatorCreateCore,
  TranslatorCreate,
  TranslatorRunNativeOptions,
  TranslatorChunking,
  TranslatorProgressPhase,
  TranslatorLanguageOption,
  TranslatorProgressState,
  TranslatorChunkResult,
  TranslatorResult,
  TranslatorRunOptions,
  TranslatorBatchItem,
  TranslatorBatchOptions
} from '@desource/browser-ai/workflows';
export { TRANSLATOR_LANGUAGE_OPTIONS, getTranslatorLanguageName } from '@desource/browser-ai/workflows';

export function useTranslator(...args: Parameters<typeof createTranslatorWorkflow>) {
  return useWorkflow(createTranslatorWorkflow(...args));
}
