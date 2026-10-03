import { createRewriter as createCoreRewriter } from '@desource/browser-ai';
import { toSvelteController } from './controller.js';

export const createRewriter = (options: Omit<RewriterCreateOptions, 'monitor' | 'signal'> = {}) =>
  toSvelteController(createCoreRewriter(options));
