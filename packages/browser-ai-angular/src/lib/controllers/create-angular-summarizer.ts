import type { DestroyRef } from '@angular/core';
import { createSummarizer } from '@desource/browser-ai';
import { toAngularController } from './controller';

export const createAngularSummarizer = (
  options: Omit<SummarizerCreateOptions, 'monitor' | 'signal'> = {},
  destroyRef?: DestroyRef
) => toAngularController(createSummarizer(options), destroyRef);
