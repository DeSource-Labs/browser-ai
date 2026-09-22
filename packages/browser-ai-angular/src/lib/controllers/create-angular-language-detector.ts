import type { DestroyRef } from '@angular/core';
import { createLanguageDetector } from '@desource/browser-ai';
import { toAngularController } from './controller';

export const createAngularLanguageDetector = (
  options: Omit<LanguageDetectorCreateOptions, 'monitor' | 'signal'> = {},
  destroyRef?: DestroyRef
) => toAngularController(createLanguageDetector(options), destroyRef);
