import type { DestroyRef } from '@angular/core';
import { createRewriter } from '@desource/browser-ai';
import { toAngularController } from './controller';

export const createAngularRewriter = (
  options: Omit<RewriterCreateOptions, 'monitor' | 'signal'> = {},
  destroyRef?: DestroyRef
) => toAngularController(createRewriter(options), destroyRef);
