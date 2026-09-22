export { PROMPT_FILE_ACCEPT, TEXT_FILE_ACCEPT } from '@desource/browser-ai';

export const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export const errorText = (error: unknown, fallback = 'Browser AI request failed.') =>
  error instanceof Error ? error.message : fallback;
