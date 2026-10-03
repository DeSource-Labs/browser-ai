import { createWebMcp } from '@desource/browser-ai';
import { useController } from './useController.js';

export const useWebMcp = () => useController(createWebMcp);
