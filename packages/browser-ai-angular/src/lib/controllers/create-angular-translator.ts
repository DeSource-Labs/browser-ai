import type { DestroyRef } from '@angular/core';
import { createTranslator } from '@desource/browser-ai';
import { toAngularController } from './controller';

export const createAngularTranslator = (
  options: Omit<TranslatorCreateOptions, 'monitor' | 'signal'>,
  destroyRef?: DestroyRef
) => toAngularController(createTranslator(options), destroyRef);
