import { defineNuxtModule, createResolver, isNuxtMajorVersion, addPlugin, addImports, addComponent } from '@nuxt/kit';
import type { NuxtModule } from '@nuxt/schema';
import { fileURLToPath } from 'url';

export interface ModuleOptions {
  css?: boolean; // Whether to include default CSS, default true
  component?: boolean; // Whether to register the component, default true
  directive?: boolean; // Whether to register the directive, default true
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
    directive: true,
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

    // Add runtime plugin before the router plugin
    // https://github.com/nuxt/framework/issues/9130
    nuxt.hook('modules:done', () => {
      if (!isNuxtMajorVersion(2, nuxt) && options.directive) {
        addPlugin(resolve(runtimeDir, 'plugin.browser-ai'));
      }
    });
    // Add imports
    if (options.helpers) {
      const shared = resolve(runtimeDir, 'shared');
      addImports([
        { name: 'usePromptApi', from: shared },
        { name: 'LLMAvailability', from: shared, type: true },
        { name: 'LLMCreateCoreOptions', from: shared, type: true },
        { name: 'LLMProcessingState', from: shared, type: true },
        { name: 'LLMPrompt', from: shared, type: true },
        { name: 'LLMPromptOptions', from: shared, type: true },
        { name: 'UsePromptApiOptions', from: shared, type: true }
      ]);
    }
    // // Add component
    // if (options.component) {
    //   const componentDir = resolve(runtimeDir, 'component');
    //   addComponent({
    //     name: 'tbd',
    //     filePath: componentDir,
    //     mode: 'client'
    //   });
    // }
    // // Add CSS
    // if (options.css) {
    //   nuxt.options.css.unshift('@desource/browser-ai-vue/assets/lib.css');
    // }
  }
});

export default module;
