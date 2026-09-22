import { createPromptApi as createCorePromptApi } from '@desource/browser-ai';
import { toSvelteController } from './controller.js';

export const createPromptApi = (options: Omit<LanguageModelCreateOptions, 'monitor' | 'signal'> = {}) =>
  toSvelteController(createCorePromptApi(options));
