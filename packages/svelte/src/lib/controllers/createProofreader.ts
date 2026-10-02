import { createProofreader as createCoreProofreader } from '@desource/browser-ai';
import { toSvelteController } from './controller.js';

export const createProofreader = (options: Omit<ProofreaderCreateOptions, 'monitor' | 'signal'> = {}) =>
  toSvelteController(createCoreProofreader(options));
