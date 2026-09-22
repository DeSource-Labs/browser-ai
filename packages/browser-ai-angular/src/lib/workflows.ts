import type { DestroyRef } from '@angular/core';
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
import { toAngularController } from './controllers/controller.js';
export { toAngularController as createAngularWorkflow } from './controllers/controller.js';
export const createAngularPromptWorkflow = (
  options: Parameters<typeof createPromptWorkflow>[0] = {},
  destroyRef?: DestroyRef
) => toAngularController(createPromptWorkflow(options), destroyRef);
export const createAngularSummarizerWorkflow = (destroyRef?: DestroyRef) =>
  toAngularController(createSummarizerWorkflow(), destroyRef);
export const createAngularWriterWorkflow = (destroyRef?: DestroyRef) =>
  toAngularController(createWriterWorkflow(), destroyRef);
export const createAngularRewriterWorkflow = (destroyRef?: DestroyRef) =>
  toAngularController(createRewriterWorkflow(), destroyRef);
export const createAngularTranslatorWorkflow = (
  options: Parameters<typeof createTranslatorWorkflow>[0] = undefined,
  destroyRef?: DestroyRef
) => toAngularController(createTranslatorWorkflow(options), destroyRef);
export const createAngularLanguageDetectorWorkflow = (
  options: Parameters<typeof createLanguageDetectorWorkflow>[0] = {},
  destroyRef?: DestroyRef
) => toAngularController(createLanguageDetectorWorkflow(options), destroyRef);
export const createAngularProofreaderWorkflow = (
  options: Parameters<typeof createProofreaderWorkflow>[0] = {},
  destroyRef?: DestroyRef
) => toAngularController(createProofreaderWorkflow(options), destroyRef);

export * from '@desource/browser-ai/chats';
import { createAiChats } from '@desource/browser-ai/chats';
export const createAngularAiChats = (tool: Parameters<typeof createAiChats>[0], destroyRef?: DestroyRef) =>
  toAngularController(createAiChats(tool), destroyRef);
