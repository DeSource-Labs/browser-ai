import type { DestroyRef } from '@angular/core';
import { createProofreader } from '@desource/browser-ai';
import { toAngularController } from './controller';

export const createAngularProofreader = (
  options: Omit<ProofreaderCreateOptions, 'monitor' | 'signal'> = {},
  destroyRef?: DestroyRef
) => toAngularController(createProofreader(options), destroyRef);
