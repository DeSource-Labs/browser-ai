import { createPromptWorkflow } from '@desource/browser-ai/workflows';
import { useWorkflow } from './useWorkflow';

export type {
  LLMAvailability,
  LLMPromptOptions,
  LLMProcessingState,
  LLMCreateCoreOptions,
  LLMCreateOptions,
  LLMCloneOptions,
  LLMSamplingMode,
  LLMPrompt,
  LLMContextStrategy,
  LLMContextSummaryMode,
  LLMContextRestorePhase,
  LLMContextRestoreState,
  LLMContextMessageMetadata,
  LLMContextSummaryRecord,
  LLMRestoreSessionOptions,
  LLMRestoreSessionResult,
  UsePromptApiOptions,
  LLMTemporaryPromptOptions,
  LLMStructuredPromptOptions
} from '@desource/browser-ai/workflows';

export function usePromptApi(...args: Parameters<typeof createPromptWorkflow>) {
  return useWorkflow(createPromptWorkflow(...args));
}
