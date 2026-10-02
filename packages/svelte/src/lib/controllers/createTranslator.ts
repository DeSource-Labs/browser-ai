import { createTranslator as createCoreTranslator } from '@desource/browser-ai';
import { toSvelteController } from './controller.js';

export const createTranslator = (options: Omit<TranslatorCreateOptions, 'monitor' | 'signal'>) =>
  toSvelteController(createCoreTranslator(options));
