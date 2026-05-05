import { defineNuxtModule, createResolver, addImports, addComponent } from '@nuxt/kit';
import type { NuxtModule } from '@nuxt/schema';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'url';

export interface ModuleOptions {
  css?: boolean; // Whether to include default CSS, default true
  component?: boolean; // Whether to register the component, default true
  helpers?: boolean; // Whether to register shared helpers and types, default true
}

const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'browserAi',
    compatibility: {
      nuxt: '>=3.0.0'
    }
  },
  defaults: {
    css: true,
    component: true,
    helpers: true
  },
  async setup(options, nuxt) {
    // Configure transpilation
    const { resolve } = createResolver(import.meta.url);
    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url));
    const resolveRuntime = (name: string) => {
      const jsPath = resolve(runtimeDir, `${name}.js`);
      if (existsSync(jsPath)) return jsPath;

      const tsPath = resolve(runtimeDir, `${name}.ts`);
      if (existsSync(tsPath)) return tsPath;

      return resolve(runtimeDir, name);
    };
    // Transpile runtime
    nuxt.options.build.transpile.push(runtimeDir);

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: '@desource/browser-ai-nuxt' });
    });

    // Add imports
    if (options.helpers) {
      const shared = resolveRuntime('shared');
      addImports([
        { name: 'useAiChats', from: shared },
        { name: 'usePromptApi', from: shared },
        { name: 'useRewriter', from: shared },
        { name: 'useSummarizer', from: shared },
        { name: 'useLanguageDetector', from: shared },
        { name: 'useTranslator', from: shared },
        { name: 'useWriter', from: shared },
        { name: 'LANGUAGE_DETECTOR_LANGUAGE_OPTIONS', from: shared },
        { name: 'getLanguageDetectorLanguageName', from: shared },
        { name: 'TRANSLATOR_LANGUAGE_OPTIONS', from: shared },
        { name: 'getTranslatorLanguageName', from: shared },
        { name: 'AiChatMessage', from: shared, type: true },
        { name: 'AiChatRecord', from: shared, type: true },
        { name: 'AiChatSummaryRecord', from: shared, type: true },
        { name: 'AiChatTool', from: shared, type: true },
        { name: 'ChatAttachment', from: shared, type: true },
        { name: 'ChatMessage', from: shared, type: true },
        { name: 'ChatSidebarItem', from: shared, type: true },
        { name: 'LLMAvailability', from: shared, type: true },
        { name: 'LLMCreateOptions', from: shared, type: true },
        { name: 'LLMCreateCoreOptions', from: shared, type: true },
        { name: 'LLMContextMessageMetadata', from: shared, type: true },
        { name: 'LLMContextRestorePhase', from: shared, type: true },
        { name: 'LLMContextRestoreState', from: shared, type: true },
        { name: 'LLMContextSummaryMode', from: shared, type: true },
        { name: 'LLMContextSummaryRecord', from: shared, type: true },
        { name: 'LLMContextStrategy', from: shared, type: true },
        { name: 'LLMProcessingState', from: shared, type: true },
        { name: 'LLMPrompt', from: shared, type: true },
        { name: 'LLMPromptOptions', from: shared, type: true },
        { name: 'LLMRestoreSessionOptions', from: shared, type: true },
        { name: 'LLMRestoreSessionResult', from: shared, type: true },
        { name: 'LLMTemporaryPromptOptions', from: shared, type: true },
        { name: 'LanguageDetectorAvailability', from: shared, type: true },
        { name: 'LanguageDetectorBatchItem', from: shared, type: true },
        { name: 'LanguageDetectorBatchOptions', from: shared, type: true },
        { name: 'LanguageDetectorChunkResult', from: shared, type: true },
        { name: 'LanguageDetectorCreate', from: shared, type: true },
        { name: 'LanguageDetectorCreateCore', from: shared, type: true },
        { name: 'LanguageDetectorLanguageOption', from: shared, type: true },
        { name: 'LanguageDetectorLargeInputStrategy', from: shared, type: true },
        { name: 'LanguageDetectorProcessingState', from: shared, type: true },
        { name: 'LanguageDetectorProgressPhase', from: shared, type: true },
        { name: 'LanguageDetectorProgressState', from: shared, type: true },
        { name: 'LanguageDetectorResult', from: shared, type: true },
        { name: 'LanguageDetectorRunNativeOptions', from: shared, type: true },
        { name: 'LanguageDetectorRunOptions', from: shared, type: true },
        { name: 'NormalizedLanguageDetectionResult', from: shared, type: true },
        { name: 'PromptAttachment', from: shared, type: true },
        { name: 'RewriterAvailability', from: shared, type: true },
        { name: 'RewriterBatchItem', from: shared, type: true },
        { name: 'RewriterBatchOptions', from: shared, type: true },
        { name: 'RewriterCreate', from: shared, type: true },
        { name: 'RewriterCreateCore', from: shared, type: true },
        { name: 'RewriterFitStrategy', from: shared, type: true },
        { name: 'RewriterProcessingState', from: shared, type: true },
        { name: 'RewriterProgressPhase', from: shared, type: true },
        { name: 'RewriterProgressState', from: shared, type: true },
        { name: 'RewriterResult', from: shared, type: true },
        { name: 'RewriterRunNativeOptions', from: shared, type: true },
        { name: 'RewriterRunOptions', from: shared, type: true },
        { name: 'SummarizerAvailability', from: shared, type: true },
        { name: 'SummarizerChunkResult', from: shared, type: true },
        { name: 'SummarizerCreate', from: shared, type: true },
        { name: 'SummarizerCreateCore', from: shared, type: true },
        { name: 'SummarizerProcessingState', from: shared, type: true },
        { name: 'SummarizerProgressPhase', from: shared, type: true },
        { name: 'SummarizerProgressState', from: shared, type: true },
        { name: 'SummarizerResult', from: shared, type: true },
        { name: 'SummarizerRunNativeOptions', from: shared, type: true },
        { name: 'SummarizerRunOptions', from: shared, type: true },
        { name: 'TranslatorAvailability', from: shared, type: true },
        { name: 'TranslatorBatchItem', from: shared, type: true },
        { name: 'TranslatorBatchOptions', from: shared, type: true },
        { name: 'TranslatorChunking', from: shared, type: true },
        { name: 'TranslatorChunkResult', from: shared, type: true },
        { name: 'TranslatorCreate', from: shared, type: true },
        { name: 'TranslatorCreateCore', from: shared, type: true },
        { name: 'TranslatorLanguageOption', from: shared, type: true },
        { name: 'TranslatorProcessingState', from: shared, type: true },
        { name: 'TranslatorProgressPhase', from: shared, type: true },
        { name: 'TranslatorProgressState', from: shared, type: true },
        { name: 'TranslatorResult', from: shared, type: true },
        { name: 'TranslatorRunNativeOptions', from: shared, type: true },
        { name: 'TranslatorRunOptions', from: shared, type: true },
        { name: 'WriterAvailability', from: shared, type: true },
        { name: 'WriterBatchItem', from: shared, type: true },
        { name: 'WriterBatchOptions', from: shared, type: true },
        { name: 'WriterCreate', from: shared, type: true },
        { name: 'WriterCreateCore', from: shared, type: true },
        { name: 'WriterFitStrategy', from: shared, type: true },
        { name: 'WriterProcessingState', from: shared, type: true },
        { name: 'WriterProgressPhase', from: shared, type: true },
        { name: 'WriterProgressState', from: shared, type: true },
        { name: 'WriterResult', from: shared, type: true },
        { name: 'WriterRunNativeOptions', from: shared, type: true },
        { name: 'WriterRunOptions', from: shared, type: true },
        { name: 'UsePromptApiOptions', from: shared, type: true }
      ]);
    }

    if (options.component) {
      [
        ['PromptApi', 'PromptApi'],
        ['LanguageDetector', 'LanguageDetector'],
        ['Rewriter', 'Rewriter'],
        ['Summarizer', 'Summarizer'],
        ['Translator', 'Translator'],
        ['Writer', 'Writer'],
        ['BrowserAiLanguageDetector', 'LanguageDetector'],
        ['BrowserAiPromptApi', 'PromptApi'],
        ['BrowserAiRewriter', 'Rewriter'],
        ['BrowserAiSummarizer', 'Summarizer'],
        ['BrowserAiTranslator', 'Translator'],
        ['BrowserAiWriter', 'Writer'],
        ['BrowserAiChatHistory', 'ChatHistory'],
        ['BrowserAiChatSidebar', 'ChatSidebar'],
        ['BrowserAiPromptInput', 'PromptInput'],
      ].forEach(([name, exportName]) => {
        addComponent({
          name,
          export: exportName,
          filePath: '@desource/browser-ai-vue',
          mode: 'client'
        });
      });
    }

    if (options.css) {
      nuxt.options.css.unshift('@desource/browser-ai-vue/assets/lib.css');
    }
  }
});

export default module;
