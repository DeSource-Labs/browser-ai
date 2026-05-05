import { defineNuxtModule, createResolver, addImports, addComponent } from '@nuxt/kit';
import type { NuxtModule } from '@nuxt/schema';
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
    // Transpile runtime
    nuxt.options.build.transpile.push(runtimeDir);

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: '@desource/browser-ai-nuxt' });
    });

    // Add imports
    if (options.helpers) {
      const shared = resolve(runtimeDir, 'shared');
      addImports([
        { name: 'useAiChats', from: shared },
        { name: 'usePromptApi', from: shared },
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
        { name: 'PromptAttachment', from: shared, type: true },
        { name: 'UsePromptApiOptions', from: shared, type: true }
      ]);
    }

    if (options.component) {
      [
        ['PromptApi', 'PromptApi'],
        ['BrowserAiPromptApi', 'PromptApi'],
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
