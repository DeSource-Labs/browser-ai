import { createSummarizer as createCoreSummarizer } from '@desource/browser-ai';
import { toSvelteController } from './controller.js';

export const createSummarizer = (options: Omit<SummarizerCreateOptions, 'monitor' | 'signal'> = {}) =>
  toSvelteController(createCoreSummarizer(options));
