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
export type WriterAvailability = Availability;
export type WriterProcessingState = WritingAssistantProcessingState<'write'>;
export type WriterCreateCore = WriterCreateCoreOptions;
export type WriterCreate = Omit<WriterCreateOptions, 'signal' | 'monitor'>;
export type WriterRunNativeOptions = Omit<WriterWriteOptions, 'signal'>;
export type WriterFitStrategy = WritingAssistantFitStrategy;
export type WriterProgressPhase = WritingAssistantProgressPhase<'writing'>;
export type WriterProgressState = WritingAssistantProgressState<'writing'>;
export type WriterResult = WritingAssistantResult;
export type WriterRunOptions = WritingAssistantRunOptions<WriterCreate, WriterRunNativeOptions, WriterProgressState>;
export type WriterBatchItem = WritingAssistantBatchItem<WriterRunNativeOptions>;
export type WriterBatchOptions = WritingAssistantBatchOptions<
  WriterCreate,
  WriterRunNativeOptions,
  WriterProgressState
>;
type GlobalWithWriter = typeof globalThis & {
  Writer?: typeof Writer;
};
const getWriter = () => {
  return (globalThis as GlobalWithWriter).Writer;
};
const getCreateCoreOptions = (options: WriterCreate = {}): WriterCreateCoreOptions => {
  const { sharedContext: _sharedContext, ...coreOptions } = options;
  return coreOptions;
};
export function createWriterWorkflow() {
  const assistant = createWritingWorkflow<
    Writer,
    WriterCreate,
    WriterCreateCoreOptions,
    WriterRunNativeOptions,
    'writing',
    'write',
    WriterProgressState
  >({
    getConstructor: getWriter,
    getCreateCoreOptions,
    getDefaultCreateOptions: () => ({}),
    activePhase: 'writing',
    operationState: 'write',
    unavailableMessage: 'Writer is unavailable with the provided options.',
    uninitializedMessage: 'Writer is not initialized. Call create() first or enable autoCreate.',
    unsupportedMessage: 'Writer is not available in this browser context.',
    budgetExceededMessage: (usage, budget) =>
      `Writer input uses ${usage} tokens, which exceeds the configured budget of ${budget}. Shorten the task/context or enable context fitting.`,
    run: (writer, input, options) => writer.write(input, options),
    runStreaming: (writer, input, options) => writer.writeStreaming(input, options)
  });
  return projectWorkflow(
    assistant.state,
    () => ({
      writer: assistant.state.getSnapshot().model,
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
      write: assistant.run,
      writeWithDetails: assistant.runWithDetails,
      writeStreaming: assistant.runStreaming,
      writeStreamingToText: assistant.runStreamingToText,
      writeMany: assistant.runMany,
      interrupt: assistant.interrupt
    }
  );
}
