import { createLanguageDetector } from '@desource/browser-ai';
import { useController } from './useController.js';

export const useLanguageDetector = (options: Omit<LanguageDetectorCreateOptions, 'monitor' | 'signal'> = {}) =>
  useController(
    () => createLanguageDetector(options),
    (controller) => controller.configure(options)
  );
