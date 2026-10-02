import { createRewriter } from '@desource/browser-ai';
import { useController } from './useController.js';

export const useRewriter = (options: Omit<RewriterCreateOptions, 'monitor' | 'signal'> = {}) =>
  useController(
    () => createRewriter(options),
    (controller) => controller.configure(options)
  );
