import { createWriter as createCoreWriter } from '@desource/browser-ai';
import { toSvelteController } from './controller.js';

export const createWriter = (options: Omit<WriterCreateOptions, 'monitor' | 'signal'> = {}) =>
  toSvelteController(createCoreWriter(options));
