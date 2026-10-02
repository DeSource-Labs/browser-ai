import type { DestroyRef } from '@angular/core';
import { createWebMcp } from '@desource/browser-ai';
import { toAngularController } from './controller';

export const createAngularWebMcp = (destroyRef?: DestroyRef) => toAngularController(createWebMcp(), destroyRef);
