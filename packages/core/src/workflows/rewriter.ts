import { projectWorkflow } from './state.js';
import {
  createWritingWorkflow,
  type WritingAssistantBatchItem,
  type WritingAssistantBatchOptions,
  type WritingAssistantFitStrategy,
  type WritingAssistantProcessingState,
  type WritingAssistantProgressPhase,
  type WritingAssistantProgressState,
  type WritingAssistantResult,
  type WritingAssistantRunOptions
} from './writing.js';
export type RewriterAvailability = Availability;
export type RewriterProcessingState = WritingAssistantProcessingState<'rewrite'>;
export type RewriterCreateCore = RewriterCreateCoreOptions;
export type RewriterCreate = Omit<RewriterCreateOptions, 'signal' | 'monitor'>;
export type RewriterRunNativeOptions = Omit<RewriterRewriteOptions, 'signal'>;
export type RewriterFitStrategy = WritingAssistantFitStrategy;
export type RewriterProgressPhase = WritingAssistantProgressPhase<'rewriting'>;
export type RewriterProgressState = WritingAssistantProgressState<'rewriting'>;
export type RewriterResult = WritingAssistantResult;
export type RewriterRunOptions = WritingAssistantRunOptions<
  RewriterCreate,
  RewriterRunNativeOptions,
  RewriterProgressState
>;
export type RewriterBatchItem = WritingAssistantBatchItem<RewriterRunNativeOptions>;
export type RewriterBatchOptions = WritingAssistantBatchOptions<
  RewriterCreate,
  RewriterRunNativeOptions,
  RewriterProgressState
>;
type GlobalWithRewriter = typeof globalThis & {
  Rewriter?: typeof Rewriter;
};
const getRewriter = () => {
  return (globalThis as GlobalWithRewriter).Rewriter;
};
const getCreateCoreOptions = (options: RewriterCreate = {}): RewriterCreateCoreOptions => {
  const { sharedContext: _sharedContext, ...coreOptions } = options;
  return coreOptions;
};
export function createRewriterWorkflow() {
  const assistant = createWritingWorkflow<
    Rewriter,
    RewriterCreate,
    RewriterCreateCoreOptions,
    RewriterRunNativeOptions,
    'rewriting',
    'rewrite',
    RewriterProgressState
  >({
    getConstructor: getRewriter,
    getCreateCoreOptions,
    getDefaultCreateOptions: () => ({}),
    activePhase: 'rewriting',
    operationState: 'rewrite',
    unavailableMessage: 'Rewriter is unavailable with the provided options.',
    uninitializedMessage: 'Rewriter is not initialized. Call create() first or enable autoCreate.',
    unsupportedMessage: 'Rewriter is not available in this browser context.',
    budgetExceededMessage: (usage, budget) =>
      `Rewriter input uses ${usage} tokens, which exceeds the configured budget of ${budget}. Shorten the text/context or enable context fitting.`,
    run: (rewriter, input, options) => rewriter.rewrite(input, options),
    runStreaming: (rewriter, input, options) => rewriter.rewriteStreaming(input, options)
  });
  return projectWorkflow(
    assistant.state,
    () => ({
      rewriter: assistant.state.getSnapshot().model,
      processing: assistant.state.getSnapshot().processing,
      availability: assistant.state.getSnapshot().availability,
      downloadProgress: assistant.state.getSnapshot().downloadProgress,
      inputUsage: assistant.state.getSnapshot().inputUsage,
      inputQuota: assistant.state.getSnapshot().inputQuota,
      inputQuotaAvailable: assistant.state.getSnapshot().inputQuotaAvailable,
      output: assistant.state.getSnapshot().output,
      error: assistant.state.getSnapshot().error,
      progressState: assistant.state.getSnapshot().progressState,
      lastResult: assistant.state.getSnapshot().lastResult,
      isReady: assistant.state.getSnapshot().isReady,
      isProcessing: assistant.state.getSnapshot().isProcessing
    }),
    {
      checkAvailability: assistant.checkAvailability,
      requestAvailability: assistant.requestAvailability,
      init: assistant.init,
      create: assistant.create,
      destroy: assistant.destroy,
      dispose: assistant.dispose,
      measureInputUsage: assistant.measureInputUsage,
      rewrite: assistant.run,
      rewriteWithDetails: assistant.runWithDetails,
      rewriteStreaming: assistant.runStreaming,
      rewriteStreamingToText: assistant.runStreamingToText,
      rewriteMany: assistant.runMany,
      interrupt: assistant.interrupt
    }
  );
}
