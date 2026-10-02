export * from '@desource/browser-ai/workflows';
import {
  createPromptWorkflow,
  createSummarizerWorkflow,
  createWriterWorkflow,
  createRewriterWorkflow,
  createTranslatorWorkflow,
  createLanguageDetectorWorkflow,
  createProofreaderWorkflow
} from '@desource/browser-ai/workflows';
import { useController } from './hooks/useController.js';
export { useController as useBrowserAiWorkflow } from './hooks/useController.js';
export const usePromptWorkflow = (...args: Parameters<typeof createPromptWorkflow>) =>
  useController(() => createPromptWorkflow(...args));
export const useSummarizerWorkflow = (...args: Parameters<typeof createSummarizerWorkflow>) =>
  useController(() => createSummarizerWorkflow(...args));
export const useWriterWorkflow = (...args: Parameters<typeof createWriterWorkflow>) =>
  useController(() => createWriterWorkflow(...args));
export const useRewriterWorkflow = (...args: Parameters<typeof createRewriterWorkflow>) =>
  useController(() => createRewriterWorkflow(...args));
export const useTranslatorWorkflow = (...args: Parameters<typeof createTranslatorWorkflow>) =>
  useController(() => createTranslatorWorkflow(...args));
export const useLanguageDetectorWorkflow = (...args: Parameters<typeof createLanguageDetectorWorkflow>) =>
  useController(() => createLanguageDetectorWorkflow(...args));
export const useProofreaderWorkflow = (...args: Parameters<typeof createProofreaderWorkflow>) =>
  useController(() => createProofreaderWorkflow(...args));

export * from '@desource/browser-ai/chats';
import { createAiChats } from '@desource/browser-ai/chats';
export const useAiChats = (...args: Parameters<typeof createAiChats>) => useController(() => createAiChats(...args));
