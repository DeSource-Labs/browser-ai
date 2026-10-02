import { createLanguageDetector as createCoreLanguageDetector } from '@desource/browser-ai';
import { toSvelteController } from './controller.js';

export const createLanguageDetector = (options: Omit<LanguageDetectorCreateOptions, 'monitor' | 'signal'> = {}) =>
  toSvelteController(createCoreLanguageDetector(options));
