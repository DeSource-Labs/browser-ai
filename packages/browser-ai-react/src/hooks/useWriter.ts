import { createWriter } from '@desource/browser-ai';
import { useController } from './useController.js';

export const useWriter = (options: Omit<WriterCreateOptions, 'monitor' | 'signal'> = {}) =>
  useController(
    () => createWriter(options),
    (controller) => controller.configure(options)
  );
