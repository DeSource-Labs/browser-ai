import { createProofreader } from '@desource/browser-ai';
import { useController } from './useController.js';

export const useProofreader = (options: Omit<ProofreaderCreateOptions, 'monitor' | 'signal'> = {}) =>
  useController(
    () => createProofreader(options),
    (controller) => controller.configure(options)
  );
