import { createPromptApi } from '@desource/browser-ai';
import { useController } from './useController.js';

export const usePromptApi = (options: Omit<LanguageModelCreateOptions, 'monitor' | 'signal'> = {}) =>
  useController(
    () => createPromptApi(options),
    (controller) => controller.configure(options)
  );
