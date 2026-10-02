import type { DestroyRef } from '@angular/core';
import { createWriter } from '@desource/browser-ai';
import { toAngularController } from './controller';

export const createAngularWriter = (
  options: Omit<WriterCreateOptions, 'monitor' | 'signal'> = {},
  destroyRef?: DestroyRef
) => toAngularController(createWriter(options), destroyRef);
