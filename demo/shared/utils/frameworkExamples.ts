import type { ApiUsageExample, Tool } from '../types';

const componentNames: Record<Exclude<Tool, 'webmcp'>, string> = {
  'prompt-api': 'PromptApi',
  summarizer: 'Summarizer',
  writer: 'Writer',
  rewriter: 'Rewriter',
  translator: 'Translator',
  'language-detector': 'LanguageDetector',
  proofreader: 'Proofreader'
};

const angularNames: Record<Exclude<Tool, 'webmcp'>, string> = {
  'prompt-api': 'BrowserAiPromptApiComponent',
  summarizer: 'BrowserAiSummarizerComponent',
  writer: 'BrowserAiWriterComponent',
  rewriter: 'BrowserAiRewriterComponent',
  translator: 'BrowserAiTranslatorComponent',
  'language-detector': 'BrowserAiLanguageDetectorComponent',
  proofreader: 'BrowserAiProofreaderComponent'
};

const angularSelectors: Record<Exclude<Tool, 'webmcp'>, string> = {
  'prompt-api': 'browser-ai-prompt-api',
  summarizer: 'browser-ai-summarizer',
  writer: 'browser-ai-writer',
  rewriter: 'browser-ai-rewriter',
  translator: 'browser-ai-translator sourceLanguage="en" targetLanguage="fr"',
  'language-detector': 'browser-ai-language-detector',
  proofreader: 'browser-ai-proofreader'
};

const coreFactories: Record<Exclude<Tool, 'webmcp'>, { factory: string; options: string; call: string }> = {
  'prompt-api': { factory: 'createPromptApi', options: '', call: 'prompt("Reply in one sentence.")' },
  summarizer: {
    factory: 'createSummarizer',
    options: '',
    call: 'summarize("The team shipped offline search. Next week, we will improve keyboard navigation.")'
  },
  writer: { factory: 'createWriter', options: '', call: 'write("Draft a launch note.")' },
  rewriter: {
    factory: 'createRewriter',
    options: '',
    call: 'rewrite("Our new search feature works without a network connection.")'
  },
  translator: {
    factory: 'createTranslator',
    options: '{ sourceLanguage: "en", targetLanguage: "fr" }',
    call: 'translate("Your changes are saved on this device.")'
  },
  'language-detector': { factory: 'createLanguageDetector', options: '', call: 'detect("Bonjour tout le monde")' },
  proofreader: { factory: 'createProofreader', options: '', call: 'proofread("This sentence have a mistake.")' }
};

const componentProps = (tool: Tool, framework: 'vue' | 'react' | 'svelte') => {
  if (tool !== 'translator') return '';
  if (framework === 'vue') return ' source-language="en" target-language="fr"';
  return ' sourceLanguage="en" targetLanguage="fr"';
};

export function getFrameworkExamples(tool: Tool): ApiUsageExample[] {
  if (tool === 'webmcp') {
    return [
      {
        label: 'React',
        title: 'React hook',
        description:
          'Register from an effect, read current cart values, and remove the tool when the component unmounts.',
        code: `import { useEffect } from "react";
import { useWebMcp } from "@desource/browser-ai-react";

export function CartTools({ total, currency }: { total: number; currency: string }) {
  const { registerTool, registeredTools } = useWebMcp();

  useEffect(() => {
    const registration = new AbortController();
    void registerTool({
      name: "get_cart_total",
      description: "Return the current cart total.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => ({ total, currency })
    }, { signal: registration.signal }).catch(error => {
      if (!registration.signal.aborted) console.error(error);
    });
    return () => registration.abort();
  }, [registerTool, total, currency]);

  return <p>{registeredTools.length} cart tool registered</p>;
}`
      },
      {
        label: 'Svelte',
        title: 'Svelte controller',
        description: 'Register on mount and dispose the controller with the owning Svelte component.',
        code: `<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { createWebMcp } from "@desource/browser-ai-svelte";

  let { total, currency } = $props<{ total: number; currency: string }>();
  const tools = createWebMcp();
  const { state } = tools;
  onDestroy(tools.dispose);
  onMount(() => {
    void tools.registerTool({
      name: "get_cart_total",
      description: "Return the current cart total.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => ({ total, currency })
    }).catch(console.error);
  });
</script>

<p>{$state.registeredTools.length} cart tool registered</p>`
      },
      {
        label: 'Angular',
        title: 'Angular signal controller',
        description: 'Pass the component DestroyRef to the headless factory so registrations share its lifetime.',
        code: `import { Component, DestroyRef, inject, input, type OnInit } from "@angular/core";
import { createAngularWebMcp } from "@desource/browser-ai-angular/controllers";

@Component({
  selector: "app-cart-tools",
  standalone: true,
  template: \`<p>{{ tools.current().registeredTools.length }} cart tool registered</p>\`
})
export class CartToolsComponent implements OnInit {
  readonly total = input.required<number>();
  readonly currency = input.required<string>();
  readonly tools = createAngularWebMcp(inject(DestroyRef));

  ngOnInit() {
    void this.tools.registerTool({
      name: "get_cart_total",
      description: "Return the current cart total.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => ({ total: this.total(), currency: this.currency() })
    }).catch(console.error);
  }
}`
      },
      {
        label: 'TypeScript core',
        title: 'No framework required',
        description:
          'Read your application state inside the executor. Call the returned cleanup when the cart screen is removed.',
        code: `import { createWebMcp } from "@desource/browser-ai";

export function mountCartTools(readCart: () => { total: number; currency: string }) {
  const tools = createWebMcp();
  void tools.registerTool({
    name: "get_cart_total",
    description: "Return the current cart total.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => readCart()
  }).catch(console.error);

  return () => tools.dispose();
}`
      }
    ];
  }

  const name = componentNames[tool];
  const angularName = angularNames[tool];
  const angularSelector = angularSelectors[tool];
  const core = coreFactories[tool];
  return [
    {
      label: 'Vue',
      title: 'Vue component',
      description: 'Use the ready-made component or the matching use* composable.',
      code: `<script setup lang="ts">
import { ${name} } from "@desource/browser-ai-vue";
import "@desource/browser-ai-vue/assets/lib.css";
</script>

<template><${name}${componentProps(tool, 'vue')} /></template>`
    },
    {
      label: 'React',
      title: 'React component',
      description: 'The matching hook exposes the same core operations for a custom interface.',
      code: `import { ${name} } from "@desource/browser-ai-react";
import "@desource/browser-ai-react/assets/lib.css";

export function Feature() {
  return <${name}${componentProps(tool, 'react')} />;
}`
    },
    {
      label: 'Svelte',
      title: 'Svelte component',
      description: 'Use the component or its create* controller with a readable state store.',
      code: `<script lang="ts">
  import { ${name} } from "@desource/browser-ai-svelte";
  import "@desource/browser-ai-svelte/assets/lib.css";
</script>

<${name}${componentProps(tool, 'svelte')} />`
    },
    {
      label: 'Angular',
      title: 'Angular standalone component',
      description: 'Standalone components pair with signal controllers and BrowserAiService.',
      code: `import { Component } from "@angular/core";
import { ${angularName} } from "@desource/browser-ai-angular";
import "@desource/browser-ai-angular/assets/lib.css";

@Component({
  standalone: true,
  imports: [${angularName}],
  template: \`<${angularSelector} />\`
})
export class FeatureComponent {}`
    },
    {
      label: 'Nuxt',
      title: 'Nuxt auto-import',
      description: 'The Nuxt module registers the Vue component on the client and protects SSR.',
      code: `export default defineNuxtConfig({
  modules: ["@desource/browser-ai-nuxt"]
});

// app/pages/feature.vue
<template><${name}${componentProps(tool, 'vue')} /></template>`
    },
    {
      label: 'TypeScript core',
      title: 'Framework-neutral controller',
      description: 'Start from a real click, handle browser errors, and release the native session after the result.',
      code: `import { ${core.factory} } from "@desource/browser-ai";

const button = document.createElement("button");
const output = document.createElement("pre");
button.textContent = "Run ${name}";
document.body.append(button, output);

button.addEventListener("click", async () => {
  button.disabled = true;
  const api = ${core.factory}(${core.options});
  try {
    const result = await api.${core.call};
    output.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  } catch (error) {
    output.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    api.dispose();
    button.disabled = false;
  }
});`
    }
  ];
}
