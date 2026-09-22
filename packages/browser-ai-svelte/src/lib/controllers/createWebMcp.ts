import { createWebMcp as createCoreWebMcp } from '@desource/browser-ai';
import { toSvelteController } from './controller.js';

export const createWebMcp = () => toSvelteController(createCoreWebMcp());
