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
import { toSvelteController } from './controllers/controller.js';
export { toSvelteController as createBrowserAiWorkflow } from './controllers/controller.js';
export const createSveltePromptWorkflow = (...args: Parameters<typeof createPromptWorkflow>) =>
  toSvelteController(createPromptWorkflow(...args));
export const createSvelteSummarizerWorkflow = (...args: Parameters<typeof createSummarizerWorkflow>) =>
  toSvelteController(createSummarizerWorkflow(...args));
export const createSvelteWriterWorkflow = (...args: Parameters<typeof createWriterWorkflow>) =>
  toSvelteController(createWriterWorkflow(...args));
export const createSvelteRewriterWorkflow = (...args: Parameters<typeof createRewriterWorkflow>) =>
  toSvelteController(createRewriterWorkflow(...args));
export const createSvelteTranslatorWorkflow = (...args: Parameters<typeof createTranslatorWorkflow>) =>
  toSvelteController(createTranslatorWorkflow(...args));
export const createSvelteLanguageDetectorWorkflow = (...args: Parameters<typeof createLanguageDetectorWorkflow>) =>
  toSvelteController(createLanguageDetectorWorkflow(...args));
export const createSvelteProofreaderWorkflow = (...args: Parameters<typeof createProofreaderWorkflow>) =>
  toSvelteController(createProofreaderWorkflow(...args));

export * from '@desource/browser-ai/chats';
import { createAiChats } from '@desource/browser-ai/chats';
export const createSvelteAiChats = (...args: Parameters<typeof createAiChats>) =>
  toSvelteController(createAiChats(...args));
