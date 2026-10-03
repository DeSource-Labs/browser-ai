import type { DestroyRef } from '@angular/core';
import { createPromptApi } from '@desource/browser-ai';
import { toAngularController } from './controller';

export const createAngularPromptApi = (
  options: Omit<LanguageModelCreateOptions, 'monitor' | 'signal'> = {},
  destroyRef?: DestroyRef
) => toAngularController(createPromptApi(options), destroyRef);
