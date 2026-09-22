import { createTranslator } from '@desource/browser-ai';
import { useController } from './useController.js';

export const useTranslator = (options: Omit<TranslatorCreateOptions, 'monitor' | 'signal'>) =>
  useController(
    () => createTranslator(options),
    (controller) => controller.configure(options)
  );
