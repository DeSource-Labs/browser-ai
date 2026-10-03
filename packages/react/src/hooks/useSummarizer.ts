import { createSummarizer } from '@desource/browser-ai';
import { useController } from './useController.js';

export const useSummarizer = (options: Omit<SummarizerCreateOptions, 'monitor' | 'signal'> = {}) =>
  useController(
    () => createSummarizer(options),
    (controller) => controller.configure(options)
  );
